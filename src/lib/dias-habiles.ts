// Días hábiles guatemaltecos: excluye sábado, domingo y los feriados
// nacionales oficiales (fijos por ley + Jueves/Viernes Santo, que son
// fecha móvil calculada a partir del Domingo de Pascua). Todas las fechas
// se manejan como texto "YYYY-MM-DD" (mismo formato que el resto del
// proyecto, ver fechaGuatemala() en date-utils.ts) y se calculan en UTC
// para no arrastrar corrimientos de huso horario.

function feriadosFijos(anio: number): string[] {
  return [
    `${anio}-01-01`, // Año Nuevo
    `${anio}-05-01`, // Día del Trabajo
    `${anio}-09-15`, // Día de la Independencia
    `${anio}-11-01`, // Día de Todos los Santos
    `${anio}-12-24`, // Nochebuena
    `${anio}-12-25`, // Navidad
    `${anio}-12-31`, // Fin de año
  ];
}

// Algoritmo de Meeus/Jones/Butcher para el Domingo de Pascua (calendario gregoriano).
function domingoDePascua(anio: number): Date {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3=marzo, 4=abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anio, mes - 1, dia));
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sumarDias(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function feriadosMoviles(anio: number): string[] {
  const pascua = domingoDePascua(anio);
  return [toISO(sumarDias(pascua, -3)), toISO(sumarDias(pascua, -2))]; // Jueves y Viernes Santo
}

const cacheFeriados = new Map<number, Set<string>>();

export function feriadosDelAnio(anio: number): Set<string> {
  let set = cacheFeriados.get(anio);
  if (!set) {
    set = new Set([...feriadosFijos(anio), ...feriadosMoviles(anio)]);
    cacheFeriados.set(anio, set);
  }
  return set;
}

function parseISO(fecha: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function esDiaHabil(fecha: string): boolean {
  const d = parseISO(fecha);
  const diaSemana = d.getUTCDay(); // 0=domingo, 6=sábado
  if (diaSemana === 0 || diaSemana === 6) return false;
  return !feriadosDelAnio(d.getUTCFullYear()).has(fecha);
}

// Fecha (YYYY-MM-DD) del n-ésimo día hábil del mes indicado (1-based).
export function nEsimoDiaHabilDelMes(anio: number, mes1a12: number, n: number): string {
  let contador = 0;
  let d = new Date(Date.UTC(anio, mes1a12 - 1, 1));
  for (;;) {
    const iso = toISO(d);
    if (esDiaHabil(iso)) {
      contador++;
      if (contador === n) return iso;
    }
    d = sumarDias(d, 1);
  }
}

// Fecha (YYYY-MM-DD) que resulta de sumarle n días HÁBILES a `fecha` (sin
// contar `fecha` misma) — para el vencimiento de 10 días hábiles de Viáticos
// (ver viaticoSolicitudes.fecha_limite en schema.ts): un nombramiento del
// viernes con n=10 vence hasta el viernes de la semana siguiente-siguiente,
// saltando fines de semana y feriados.
export function sumarDiasHabiles(fecha: string, n: number): string {
  let d = parseISO(fecha);
  let contador = 0;
  while (contador < n) {
    d = sumarDias(d, 1);
    if (esDiaHabil(toISO(d))) contador++;
  }
  return toISO(d);
}

// ¿La fecha cae dentro de los primeros N días hábiles del mes al que pertenece?
export function estaEnPrimerosNDiasHabiles(fecha: string, n: number): boolean {
  const d = parseISO(fecha);
  const limite = nEsimoDiaHabilDelMes(d.getUTCFullYear(), d.getUTCMonth() + 1, n);
  return fecha <= limite; // comparación lexicográfica funciona en formato YYYY-MM-DD
}

// ¿La fecha cae dentro de un rango de días calendario del mes (ej. 15 al 20)?
export function estaEnRangoDiasDelMes(fecha: string, diaInicio: number, diaFin: number): boolean {
  const dia = parseISO(fecha).getUTCDate();
  return dia >= diaInicio && dia <= diaFin;
}

// ¿El mes de la fecha (1-12) está entre los meses permitidos?
export function estaEnMeses(fecha: string, mesesPermitidos: number[]): boolean {
  const mes = parseISO(fecha).getUTCMonth() + 1;
  return mesesPermitidos.includes(mes);
}
