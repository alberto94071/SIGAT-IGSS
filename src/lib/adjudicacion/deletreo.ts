// Utilidades para el estilo de redacción legal guatemalteco usado en el Acta:
// números convertidos a palabras, y códigos alfanuméricos deletreados letra por
// letra / dígito por dígito (ej. "FRI-02/2026" → "EFE ERE I GUION CERO DOS
// DIAGONAL DOS MIL VEINTISÉIS").

const UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const DECENAS = ["", "diez", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const ESPECIALES: Record<number, string> = {
  10: "diez", 11: "once", 12: "doce", 13: "trece", 14: "catorce", 15: "quince",
  16: "dieciséis", 17: "diecisiete", 18: "dieciocho", 19: "diecinueve",
  20: "veinte", 21: "veintiuno", 22: "veintidós", 23: "veintitrés", 24: "veinticuatro",
  25: "veinticinco", 26: "veintiséis", 27: "veintisiete", 28: "veintiocho", 29: "veintinueve",
};
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
  "seiscientos", "setecientos", "ochocientos", "novecientos"];

function menosDeCien(n: number): string {
  if (n < 10) return UNIDADES[n];
  if (ESPECIALES[n]) return ESPECIALES[n];
  const d = Math.floor(n / 10), u = n % 10;
  return u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}`;
}

function menosDeMil(n: number): string {
  if (n === 100) return "cien";
  if (n < 100) return menosDeCien(n);
  const c = Math.floor(n / 100), resto = n % 100;
  return resto === 0 ? CENTENAS[c] : `${CENTENAS[c]} ${menosDeCien(resto)}`;
}

// Convierte un número entero (0–999,999) a su forma en palabras en español.
export function numeroALetras(num: number): string {
  if (num === 0) return "cero";
  if (num < 0) return `menos ${numeroALetras(-num)}`;
  if (num < 1000) return menosDeMil(num);
  const miles = Math.floor(num / 1000), resto = num % 1000;
  const milesStr = miles === 1 ? "mil" : `${menosDeMil(miles)} mil`;
  return resto === 0 ? milesStr : `${milesStr} ${menosDeMil(resto)}`;
}

const ALFABETO_FONETICO: Record<string, string> = {
  A: "a", B: "be", C: "ce", D: "de", E: "e", F: "efe", G: "ge", H: "hache", I: "i", J: "jota",
  K: "ka", L: "ele", M: "eme", N: "ene", "Ñ": "eñe", O: "o", P: "pe", Q: "cu", R: "ere",
  S: "ese", T: "te", U: "u", V: "uve", W: "doble uve", X: "equis", Y: "y griega", Z: "zeta",
};
const DIGITO_PALABRA = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const DELIM_PALABRA: Record<string, string> = { "-": "guión", "/": "diagonal", ".": "punto", " ": "" };

function quitarAcentos(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function deletrearSegmento(token: string): string {
  if (/^[0-9]+$/.test(token)) {
    // Con cero(s) a la izquierda: se deletrea dígito por dígito (ej. "02" → "cero dos").
    // Sin cero a la izquierda: se convierte al número completo en palabras (ej. "2026" → "dos mil veintiséis").
    if (token.length > 1 && token[0] === "0") {
      return token.split("").map(d => DIGITO_PALABRA[Number(d)]).join(" ");
    }
    return numeroALetras(Number(token));
  }
  if (/^[A-Za-zÑñ]+$/.test(token)) {
    return token.toUpperCase().split("").map(c => ALFABETO_FONETICO[c] ?? c).join(" ");
  }
  return token;
}

// Deletrea un código alfanumérico completo (ej. "FRI-02/2026") al estilo legal:
// letras por su nombre fonético, dígitos con cero inicial uno por uno, números
// "naturales" como cantidad completa, y separadores como palabra (guión/diagonal).
export function deletrearCodigo(codigo: string): string {
  const partes: string[] = [];
  let actual = "";
  for (const ch of codigo) {
    if (ch in DELIM_PALABRA) {
      if (actual) { partes.push(deletrearSegmento(actual)); actual = ""; }
      if (DELIM_PALABRA[ch]) partes.push(DELIM_PALABRA[ch]);
    } else {
      actual += ch;
    }
  }
  if (actual) partes.push(deletrearSegmento(actual));
  return quitarAcentos(partes.join(" ")).toUpperCase();
}

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// "2026-01-09" → "viernes nueve de enero del año dos mil veintiséis"
export function fechaEnLetras(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const diaSemana = DIAS_SEMANA[dt.getDay()];
  const diaMes = numeroALetras(d);
  const mes = MESES[m - 1];
  const anio = numeroALetras(y);
  return `${diaSemana} ${diaMes} de ${mes} del año ${anio}`;
}

// "08:00" → "ocho horas en punto"; "08:15" → "ocho horas con quince minutos"
export function horaEnLetras(hhmm: string): string {
  const [h, min] = hhmm.split(":").map(Number);
  const horas = numeroALetras(h);
  if (!min) return `${horas} hora${h === 1 ? "" : "s"} en punto`;
  const minutos = numeroALetras(min);
  return `${horas} hora${h === 1 ? "" : "s"} con ${minutos} minuto${min === 1 ? "" : "s"}`;
}
