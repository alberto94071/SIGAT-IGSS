// Aparte de dab60-actions.ts porque un archivo "use server" solo puede
// exportar funciones async — una clase de error exportada ahí revienta el
// build de Next ("Only async functions are allowed to be exported").
export class LoteYaDespachadoEnTransaccion extends Error {
  constructor(public nombre: string) { super("lote_ya_despachado_en_transaccion"); }
}
