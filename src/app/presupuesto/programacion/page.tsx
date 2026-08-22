import { requireModuloAccess } from "@/lib/modulo-access";
import ProgramacionClient from "./ProgramacionClient";

export default async function ProgramacionPage() {
  const { permisos } = await requireModuloAccess("mod_presupuesto");
  return <ProgramacionClient permisos={permisos} />;
}
