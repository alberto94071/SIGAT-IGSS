import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import ws from "ws";
import * as schema from "./schema";

// El driver HTTP (neon-http) es más simple y liviano, pero no soporta
// db.transaction() — cada consulta va sola, sin forma de amarrar varios
// pasos en un todo-o-nada. Con Pool (WebSocket) sí se pueden envolver en
// una transacción real las acciones que mueven presupuesto en varios pasos
// seguidos (aprobar Compromiso/Devengado/SIAF, transferencias, cierre de
// cuatrimestre, etc.) — si algo falla a la mitad, Postgres deshace todo
// solo en vez de dejar el presupuesto descuadrado a medio camino.
neonConfig.webSocketConstructor = ws;

// `max` chico a propósito: cada invocación serverless de Vercel típicamente
// solo necesita 1-2 conexiones a la vez, y Next.js puede tener muchas
// invocaciones concurrentes — cada una con su propio Pool (el módulo se
// reinstancia por instancia de función). Sin este límite, Pool usa el
// default de node-postgres (10), y bajo tráfico real eso multiplicado por
// varias instancias puede agotar las conexiones que el compute de Neon
// (aquí uno chico, 0.25-2 CU) puede sostener.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});

// Sin este handler, un error en una conexión inactiva del pool (ej. Neon la
// cierra por inactividad, o un corte de red) se emite como un evento
// 'error' sin nadie escuchándolo — Node.js lo trata como una excepción no
// capturada y TUMBA TODO EL PROCESO, no solo la operación que fallaba. En
// una función serverless eso arrastra con ella cualquier otra solicitud que
// esa misma instancia (todavía "tibia") estuviera atendiendo al momento —
// esto es lo que probablemente causó fallas intermitentes y aparentemente
// aleatorias justo después de migrar de neon-http (sin pool, sin este
// riesgo) a este driver.
pool.on("error", (err) => {
  console.error("Error en una conexión inactiva del pool de Postgres:", err);
});

export const db = drizzle(pool, { schema });

export { sql };
