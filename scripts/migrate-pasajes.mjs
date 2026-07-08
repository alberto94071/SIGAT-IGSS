import { neon } from "@neondatabase/serverless";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DB = process.env.DATABASE_URL;
if (!DB) throw new Error("DATABASE_URL no definida");
const sql = neon(DB);

async function main() {
  await sql`ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS nombre_secretaria_unidad TEXT NOT NULL DEFAULT 'Elesinda Gabriela Rodriguez Orozco'`;
  await sql`ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS cargo_secretaria_unidad TEXT NOT NULL DEFAULT 'Secretaria "A"'`;
  console.log("✓ Columnas nuevas en configuracion (DPD-23)");

  await sql`
    CREATE TABLE IF NOT EXISTS pasajes_afiliados (
      id               SERIAL PRIMARY KEY,
      afiliacion       TEXT NOT NULL UNIQUE,
      dpi              TEXT,
      nombre           TEXT NOT NULL,
      calidad          TEXT,
      edad             INTEGER,
      sexo             TEXT,
      direccion        TEXT,
      telefono         TEXT,
      fallecido        TEXT,
      numero_patronal  TEXT,
      patrono          TEXT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS pasajes_tarifario (
      id             SERIAL PRIMARY KEY,
      punto_partida  TEXT NOT NULL,
      destino        TEXT NOT NULL,
      valor_ida      DOUBLE PRECISION NOT NULL,
      creado_por     INTEGER REFERENCES usuarios(id),
      created_at     TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS pasajes_solicitudes (
      id               SERIAL PRIMARY KEY,
      numero           INTEGER NOT NULL UNIQUE,
      fecha            TEXT NOT NULL,
      afiliacion       TEXT NOT NULL,
      nombre_afiliado  TEXT NOT NULL,
      direccion        TEXT,
      tramo            TEXT NOT NULL,
      punto_partida    TEXT NOT NULL,
      destino          TEXT NOT NULL,
      lugar_especifico TEXT,
      especialidad     TEXT,
      caso_concluido   BOOLEAN NOT NULL DEFAULT false,
      fecha_cita       TEXT,
      observaciones    TEXT,
      estado           TEXT NOT NULL DEFAULT 'Pendiente DPD-23',
      creado_por       INTEGER REFERENCES usuarios(id),
      created_at       TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
    )
  `;
  await sql`ALTER TABLE pasajes_solicitudes ADD COLUMN IF NOT EXISTS lugar_especifico TEXT`;
  await sql`ALTER TABLE pasajes_solicitudes ADD COLUMN IF NOT EXISTS especialidad TEXT`;
  await sql`ALTER TABLE pasajes_solicitudes ADD COLUMN IF NOT EXISTS caso_concluido BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE pasajes_solicitudes ADD COLUMN IF NOT EXISTS fecha_cita TEXT`;
  await sql`
    CREATE TABLE IF NOT EXISTS pasajes_pagos (
      id               SERIAL PRIMARY KEY,
      formulario_no    INTEGER NOT NULL UNIQUE,
      solicitud_id     INTEGER REFERENCES pasajes_solicitudes(id),
      fecha_pago       TEXT NOT NULL,
      afiliacion       TEXT NOT NULL,
      nombre_afiliado  TEXT NOT NULL,
      calidad          TEXT,
      dpi              TEXT,
      numero_patronal  TEXT,
      patrono          TEXT,
      punto_partida    TEXT NOT NULL,
      destino          TEXT NOT NULL,
      ida              BOOLEAN NOT NULL DEFAULT true,
      vuelta           BOOLEAN NOT NULL DEFAULT true,
      valor_pasaje     DOUBLE PRECISION NOT NULL,
      observaciones    TEXT,
      fecha_cita       TEXT,
      poliza_no        INTEGER,
      cheque_no        TEXT,
      vale_id          INTEGER REFERENCES vales_caja_chica(id),
      creado_por       INTEGER REFERENCES usuarios(id),
      created_at       TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
    )
  `;
  await sql`ALTER TABLE pasajes_pagos ADD COLUMN IF NOT EXISTS solicitud_id INTEGER REFERENCES pasajes_solicitudes(id)`;
  console.log("✓ Tablas pasajes_afiliados, pasajes_tarifario, pasajes_solicitudes, pasajes_pagos");

  const tarifas = JSON.parse(readFileSync(join(__dirname, "data/pasajes-tarifario.json"), "utf-8"));
  const { rows } = await sql`SELECT COUNT(*)::int AS n FROM pasajes_tarifario`;
  if (rows[0].n === 0) {
    for (const t of tarifas) {
      await sql`INSERT INTO pasajes_tarifario (punto_partida, destino, valor_ida) VALUES (${t.punto_partida}, ${t.destino}, ${t.valor_ida})`;
    }
    console.log(`✓ ${tarifas.length} tarifas insertadas`);
  } else {
    console.log("… pasajes_tarifario ya tiene datos, se omite el seed");
  }

  // El archivo con los datos reales de afiliados (DPI, nombre, dirección, teléfono)
  // no se versiona en el repositorio por ser información personal. Colócalo en
  // scripts/data/pasajes-afiliados.json antes de correr esta migración si necesitas
  // volver a poblar la tabla desde cero; si ya existe en la base de datos, este paso
  // se omite.
  const afiliadosPath = join(__dirname, "data/pasajes-afiliados.json");
  if (existsSync(afiliadosPath)) {
    const afiliados = JSON.parse(readFileSync(afiliadosPath, "utf-8"));
    let insertados = 0;
    const CHUNK = 200;
    for (let i = 0; i < afiliados.length; i += CHUNK) {
      const chunk = afiliados.slice(i, i + CHUNK);
      await Promise.all(chunk.map(a =>
        sql`INSERT INTO pasajes_afiliados
              (afiliacion, dpi, nombre, calidad, edad, sexo, direccion, telefono, fallecido, numero_patronal, patrono)
            VALUES
              (${a.afiliacion}, ${a.dpi}, ${a.nombre}, ${a.calidad}, ${a.edad}, ${a.sexo}, ${a.direccion}, ${a.telefono}, ${a.fallecido}, ${a.numero_patronal}, ${a.patrono || null})
            ON CONFLICT (afiliacion) DO NOTHING`
      ));
      insertados += chunk.length;
    }
    console.log(`✓ ${insertados} afiliados procesados (base "PASAJES_TEJUTLA_2026.xlsm")`);
  } else {
    console.log("… scripts/data/pasajes-afiliados.json no existe, se omite el seed de afiliados");
  }

  console.log("\n¡Listo!");
}

main().catch(console.error);
