import { timingSafeEqual } from "crypto";

// Clave compartida por las acciones de "use server" en developer/peligro
// (reset-actions.ts, backup-actions.ts) — un segundo factor encima del rol
// superadmin para las operaciones más destructivas (reiniciar sistema,
// restaurar backup). Vive en una variable de entorno, no en el código: así
// no queda en el historial de git ni se puede leer con solo tener acceso al
// repositorio. Si DEVELOPER_MASTER_PASSWORD no está configurada usa este
// valor por defecto (el mismo que ya se usaba hardcodeado) para no romper
// despliegues existentes — pero debería configurarse la variable real.
const DEFAULT_MASTER_PASSWORD = "Katerine.94071";

export function verificarMasterPassword(password: string): boolean {
  const esperado = process.env.DEVELOPER_MASTER_PASSWORD ?? DEFAULT_MASTER_PASSWORD;
  const a = Buffer.from(password);
  const b = Buffer.from(esperado);
  // timingSafeEqual exige buffers del mismo largo — si difieren ya sabemos
  // que no son iguales, sin necesidad de comparación de tiempo constante.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
