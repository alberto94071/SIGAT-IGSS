import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pagos, movimientosBanco, cajaChica, servicios } from "@/lib/schema";
import { eq, count, sum, sql } from "drizzle-orm";
import { parsePermisos, type Rol } from "@/lib/permisos";
import {
  TrendingUp, TrendingDown, Clock, CheckCircle2,
  AlertCircle, Banknote
} from "lucide-react";

async function getStats() {
  const [totalPagos]     = await db.select({ n: count() }).from(pagos);
  const [pendientes]     = await db.select({ n: count() }).from(pagos).where(eq(pagos.estatus, "Pendiente"));
  const [pagados]        = await db.select({ n: count() }).from(pagos).where(eq(pagos.estatus, "Pagado"));
  const [sumaPendiente]  = await db.select({ t: sum(pagos.monto) }).from(pagos).where(eq(pagos.estatus, "Pendiente"));
  const [ultimoSaldo]    = await db.select({ s: movimientosBanco.saldo })
    .from(movimientosBanco).orderBy(sql`${movimientosBanco.id} DESC`).limit(1);
  const [totalServicios] = await db.select({ n: count() }).from(servicios);

  return {
    totalPagos:    totalPagos.n,
    pendientes:    pendientes.n,
    pagados:       pagados.n,
    montoPendiente:Number(sumaPendiente.t ?? 0),
    saldoBanco:    Number(ultimoSaldo?.s ?? 0),
    totalServicios:totalServicios.n,
  };
}

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string;
  sub?: string; color: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl shrink-0 ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  const rol     = session!.user.rol as Rol;
  const stats   = await getStats();

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(n);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          Bienvenido, {session!.user.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Resumen del Fondo Rotativo Interno — Ejercicio 2026
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={<Banknote className="w-5 h-5 text-blue-600" />}
          label="Saldo en banco"
          value={fmt(stats.saldoBanco)}
          sub="Último movimiento registrado"
          color="bg-blue-50"
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-yellow-600" />}
          label="Pagos pendientes"
          value={String(stats.pendientes)}
          sub={fmt(stats.montoPendiente) + " en circulación"}
          color="bg-yellow-50"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5 text-green-600" />}
          label="Pagos realizados"
          value={String(stats.pagados)}
          sub={`de ${stats.totalPagos} total`}
          color="bg-green-50"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-brand-600" />}
          label="Servicios ingresados"
          value={String(stats.totalServicios)}
          sub="Ingresos registrados"
          color="bg-brand-50"
        />
        <StatCard
          icon={<AlertCircle className="w-5 h-5 text-red-600" />}
          label="Fondo inicial"
          value="Q 15,000.00"
          sub="Resolución 01 SGF/2025"
          color="bg-red-50"
        />
        <StatCard
          icon={<TrendingDown className="w-5 h-5 text-purple-600" />}
          label="Diferencia conciliación"
          value={fmt(15000 - stats.saldoBanco - stats.montoPendiente)}
          sub="Debe ser Q 0.00"
          color="bg-purple-50"
        />
      </div>

      {/* Quick actions */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Acciones rápidas</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: "/dashboard/pagos",      label: "Nuevo pago",          color: "bg-brand-50 text-brand-700 hover:bg-brand-100"   },
            { href: "/dashboard/banco",      label: "Registrar movimiento", color: "bg-blue-50 text-blue-700 hover:bg-blue-100"     },
            { href: "/dashboard/liquidacion",label: "Liquidar vale",        color: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100"},
            { href: "/dashboard/documentos", label: "Generar SIAF",         color: "bg-purple-50 text-purple-700 hover:bg-purple-100"},
          ].map(a => (
            <a key={a.href} href={a.href}
              className={`flex items-center justify-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${a.color}`}>
              {a.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
