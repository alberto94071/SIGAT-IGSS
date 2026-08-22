import { ROL_LABELS, ROL_COLORS, type Permisos } from "@/lib/permisos";
import { requireModuloAccess } from "@/lib/modulo-access";
import DashboardShell from "@/components/DashboardShell";

// "Programación y Reprogramación" y "Modificaciones" tienen submódulos
// propios dentro de su misma pestaña de nav (ver ProgramacionClient.tsx /
// ModificacionesClient.tsx) — la pestaña se muestra si el usuario tiene
// acceso a por lo menos uno de esos submódulos.
const PRESUPUESTO_NAV: { href: string; label: string; icon: string; permisos: readonly (keyof Permisos)[] }[] = [
  { href: "/presupuesto/general",    label: "General",    icon: "Calculator", permisos: ["tab_presupuesto_general"] },
  { href: "/presupuesto/compromiso", label: "Compromiso", icon: "FileCheck",  permisos: ["tab_presupuesto_compromiso"] },
  { href: "/presupuesto/devengado",  label: "Devengado",  icon: "FileCheck",  permisos: ["tab_presupuesto_devengado"] },
  {
    href: "/presupuesto/programacion", label: "Programación y Reprogramación", icon: "BarChart3",
    permisos: ["tab_presupuesto_programacion", "tab_presupuesto_reprogramacion", "tab_presupuesto_autorizar_reprogramacion"],
  },
  {
    href: "/presupuesto/modificaciones", label: "Modificaciones", icon: "FileSignature",
    permisos: ["tab_presupuesto_modif_ingru", "tab_presupuesto_modif_ampliacion", "tab_presupuesto_modif_transferencia", "tab_presupuesto_autorizar_modificaciones"],
  },
  { href: "/presupuesto/ejecucion", label: "Ejecución", icon: "BookOpen", permisos: ["tab_presupuesto_ejecucion"] },
];

export default async function PresupuestoLayout({ children }: { children: React.ReactNode }) {
  const { session, rol, permisos } = await requireModuloAccess("mod_presupuesto");
  const navItems = PRESUPUESTO_NAV
    .filter(item => item.permisos.some(p => permisos[p]))
    .map(({ href, label, icon }) => ({ href, label, icon }));

  return (
    <DashboardShell
      navItems={navItems}
      user={{ name: session.user.name ?? "", rol, email: session.user.email ?? "" }}
      userName={session.user.name ?? ""}
      rolLabel={ROL_LABELS[rol]}
      rolColor={ROL_COLORS[rol]}
      moduleLabel="Presupuesto"
    >
      {children}
    </DashboardShell>
  );
}
