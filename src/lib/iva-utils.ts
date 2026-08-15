// El IVA guatemalteco (12%) va incluido en el precio facturado, no se suma
// aparte — por eso el neto de un monto bruto (con IVA incluido) se saca
// dividiendo entre 1.12, no multiplicando por 0.88. Confirmado contra un
// A-04 SIAF real emitido por el IGSS (Total Q296.96 → IVA Q31.82 → Líquido
// Q265.14 = 296.96 / 1.12), que es matemáticamente distinto de Q296.96 ×
// 0.88 = Q261.32. Toda la app debe usar estas dos funciones en vez de
// escribir la fórmula a mano, para que no se desincronicen entre sí.
const TASA_IVA = 0.12;

export function netoDeIva(bruto: number): number {
  return bruto / (1 + TASA_IVA);
}

export function montoIva(bruto: number): number {
  return bruto - netoDeIva(bruto);
}
