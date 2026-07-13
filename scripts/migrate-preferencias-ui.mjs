import { neon } from "@neondatabase/serverless";

const DB = process.env.DATABASE_URL;
if (!DB) throw new Error("DATABASE_URL no definida");
const sql = neon(DB);

async function main() {
  // Preferencias de interfaz por usuario (JSON): tema claro/oscuro, tamaño de
  // letra y colores personalizados de barra, fondo y módulos.
  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS preferencias_ui TEXT NOT NULL DEFAULT '{}'`;
  console.log("✓ Columna usuarios.preferencias_ui");

  console.log("\n¡Listo!");
}

main().catch(console.error);
