// Clave compartida por las acciones de "use server" en developer/peligro
// (reset-actions.ts, backup-actions.ts). Vive en un módulo aparte porque un
// archivo "use server" solo puede exportar funciones async, no constantes.
export const MASTER_PASSWORD = "Katerine.94071";
