import { requireModuloAccess } from "@/lib/modulo-access";
import { redirect } from "next/navigation";
import ReiniciarClient from "./ReiniciarClient";

// Solo el Administrador Máster (rol "superadmin") puede reiniciar el
// sistema — el resto de roles ni siquiera ve esta opción en el menú (ver
// AdministracionLayout), pero se valida también acá por si alguien intenta
// entrar directo por la URL.
export default async function ReiniciarPage() {
  const { rol } = await requireModuloAccess("mod_administracion");
  if (rol !== "superadmin") redirect("/administracion");

  return <ReiniciarClient />;
}
