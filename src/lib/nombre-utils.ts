// Los nombres de afiliados están guardados como se exportaron del libro de
// Excel original: "APELLIDO1, APELLIDO2, APELLIDO_CASADA, NOMBRE1, NOMBRE2,"
// (5 posiciones separadas por coma, algunas vacías). El DPD-23 imprime ese
// formato tal cual, pero el SPS-75 lo imprime en orden natural de lectura.
export function nombreNatural(nombreDb: string): string {
  const partes = nombreDb.split(",").map(p => p.trim());
  const [apellido1, apellido2, apellidoCasada, nombre1, nombre2] = partes;
  return [nombre1, nombre2, apellido1, apellido2, apellidoCasada].filter(Boolean).join(" ");
}
