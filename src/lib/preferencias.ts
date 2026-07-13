// Preferencias de interfaz por usuario — compartido entre server y client.

export type Tema = "claro" | "oscuro";
export type TamanoLetra = "pequena" | "normal" | "grande";

export type PreferenciasUI = {
  tema: Tema;
  tamano_letra: TamanoLetra;
  color_barra: string | null;    // barra lateral + header del launcher
  color_fondo: string | null;    // fondo del launcher y del área principal
  color_modulos: string | null;  // tarjetas de módulos (barrita + botón) y acentos
};

export const DEFAULT_PREFERENCIAS: PreferenciasUI = {
  tema: "claro",
  tamano_letra: "normal",
  color_barra: null,
  color_fondo: null,
  color_modulos: null,
};

export const FONT_SIZE_MAP: Record<TamanoLetra, string> = {
  pequena: "14px",
  normal: "16px",
  grande: "18px",
};

export const TAMANO_LABELS: Record<TamanoLetra, string> = {
  pequena: "Pequeña",
  normal: "Normal",
  grande: "Grande",
};

const HEX = /^#[0-9a-fA-F]{6}$/;

export function parsePreferencias(json: string | null | undefined): PreferenciasUI {
  try {
    const raw = JSON.parse(json || "{}") as Partial<PreferenciasUI>;
    return {
      tema: raw.tema === "oscuro" ? "oscuro" : "claro",
      tamano_letra: raw.tamano_letra === "pequena" || raw.tamano_letra === "grande" ? raw.tamano_letra : "normal",
      color_barra: typeof raw.color_barra === "string" && HEX.test(raw.color_barra) ? raw.color_barra : null,
      color_fondo: typeof raw.color_fondo === "string" && HEX.test(raw.color_fondo) ? raw.color_fondo : null,
      color_modulos: typeof raw.color_modulos === "string" && HEX.test(raw.color_modulos) ? raw.color_modulos : null,
    };
  } catch {
    return { ...DEFAULT_PREFERENCIAS };
  }
}

// Variables CSS ya resueltas (custom > tema > default claro) que el root
// layout estampa en <html>; el resto de la app solo consume las variables,
// sin necesidad de pasar las preferencias por props.
export function cssVarsDePreferencias(prefs: PreferenciasUI): Record<string, string> {
  const oscuro = prefs.tema === "oscuro";
  return {
    "--cip-barra": prefs.color_barra ?? "#111827",
    "--cip-barra-grad": prefs.color_barra ?? "linear-gradient(to right, #166534, #16a34a)",
    "--cip-fondo": prefs.color_fondo ?? (oscuro ? "#0d1220" : "#f3f4f6"),
    "--cip-fondo-main": prefs.color_fondo ?? (oscuro ? "#0d1220" : "#f9fafb"),
    "--cip-accent": prefs.color_modulos ?? "#16a34a",
  };
}
