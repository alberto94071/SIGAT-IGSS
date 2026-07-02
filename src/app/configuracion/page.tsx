import { db } from "@/lib/db";
import { configuracion, catalogoFirmantes } from "@/lib/schema";
import { asc } from "drizzle-orm";
import { requireModuloAccess } from "@/lib/modulo-access";
import ConfiguracionClient from "./ConfiguracionClient";

export default async function ConfiguracionPage() {
  const { rol } = await requireModuloAccess("mod_configuracion");

  const [[config], firmantes] = await Promise.all([
    db.select().from(configuracion).limit(1),
    db.select().from(catalogoFirmantes).orderBy(asc(catalogoFirmantes.nombre)),
  ]);
  return <ConfiguracionClient config={config} firmantes={firmantes} rol={rol} />;
}
