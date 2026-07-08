import { contarAfiliados } from "@/lib/afiliados-actions";
import AfiliadosClient from "./AfiliadosClient";

export default async function AfiliadosPage() {
  const total = await contarAfiliados();
  return <AfiliadosClient total={total} />;
}
