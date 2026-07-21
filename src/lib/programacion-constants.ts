export const GRUPOS = [
  { id: 1, label: "100 - 199", min: 100, max: 199 },
  { id: 2, label: "200 - 299", min: 200, max: 299 },
  { id: 3, label: "300 - 399", min: 300, max: 399 },
] as const;

export const CUATRIMESTRES = [
  { id: 1, label: "Enero - Abril", meses: ["Enero", "Febrero", "Marzo", "Abril"] },
  { id: 2, label: "Mayo - Agosto", meses: ["Mayo", "Junio", "Julio", "Agosto"] },
  { id: 3, label: "Septiembre - Diciembre", meses: ["Septiembre", "Octubre", "Noviembre", "Diciembre"] },
] as const;

export function grupoDeRenglon(renglon: number) {
  return GRUPOS.find(g => renglon >= g.min && renglon <= g.max) ?? null;
}
