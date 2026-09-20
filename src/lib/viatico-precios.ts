// Cuota diaria de viático por grupo del empleado + reparto en los 4
// servicios (desayuno/almuerzo/cena/hospedaje) — pedido del cliente
// 2026-09-20: "no a todos se les pagan los mismos viáticos... depende del
// grupo al que pertenezcan", con la tabla real de cuotas (grupos 1 y 2
// comparten cuota) y el artículo de reparto por porcentaje que mandó.
// Reemplaza los precios fijos por servicio que existían antes (iguales
// para todos, Q45/60/45/150 — que resultan ser justo el reparto del grupo 5).

export type CuotasPorGrupo = {
  viatico_cuota_grupo_1_2: number;
  viatico_cuota_grupo_3: number;
  viatico_cuota_grupo_4: number;
  viatico_cuota_grupo_5: number;
};

export type PreciosServicios = { desayuno: number; almuerzo: number; cena: number; hospedaje: number };

// `grupo` es `usuarios.grupo`/`viatico_solicitudes.persona_grupo` (texto
// libre, "1".."5"). Sin grupo cargado (colaborador de antes de este cambio,
// o campo vacío) cae al grupo 5 — el mismo valor que ya traían los precios
// fijos anteriores por defecto, para no dejar un viático en Q0.
export function cuotaDiariaPorGrupo(grupo: string | null | undefined, cfg: CuotasPorGrupo): number {
  switch ((grupo ?? "").trim()) {
    case "1":
    case "2":
      return cfg.viatico_cuota_grupo_1_2;
    case "3":
      return cfg.viatico_cuota_grupo_3;
    case "4":
      return cfg.viatico_cuota_grupo_4;
    case "5":
      return cfg.viatico_cuota_grupo_5;
    default:
      return cfg.viatico_cuota_grupo_5;
  }
}

// Reparto de la cuota diaria: 15% desayuno, 20% almuerzo, 15% cena, 50%
// hospedaje (reglamento que mandó el cliente) — se usa como precio unitario
// de cada servicio porque el colaborador arma su propia cantidad de cada
// uno en vez de que el sistema infiera un día completo por horario.
export function preciosPorGrupo(grupo: string | null | undefined, cfg: CuotasPorGrupo): PreciosServicios {
  const cuota = cuotaDiariaPorGrupo(grupo, cfg);
  return {
    desayuno: cuota * 0.15,
    almuerzo: cuota * 0.20,
    cena: cuota * 0.15,
    hospedaje: cuota * 0.50,
  };
}
