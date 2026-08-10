import { requireModuloAccess } from "@/lib/modulo-access";
import ProgramacionClient from "./ProgramacionClient";

export default async function ProgramacionPage() {
  const { rol } = await requireModuloAccess("mod_presupuesto");
  return <ProgramacionClient rol={rol} />;
}
