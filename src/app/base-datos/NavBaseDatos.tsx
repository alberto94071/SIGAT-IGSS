"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Users2, Package } from "lucide-react";

const TABS = [
  { label: "Insumos",      href: "/base-datos/insumos",      icon: Package  },
  { label: "Subproductos", href: "/base-datos/subproductos", icon: LayoutGrid },
  { label: "Proveedores",  href: "/base-datos/proveedores",  icon: Users2   },
];

export default function NavBaseDatos() {
  const pathname = usePathname();

  return (
    <div className="max-w-7xl mx-auto px-6">
      <nav className="flex gap-1 pb-0 pt-1">
        {TABS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors
                ${active
                  ? "bg-white text-blue-700"
                  : "text-blue-100 hover:text-white hover:bg-white/10"
                }
              `}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
