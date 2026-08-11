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

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle(pool, { schema });

export { sql };
