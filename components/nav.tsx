"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PlusCircle, Building2, Settings, Inbox, BarChart3, ListChecks } from "lucide-react";

const items = [
  { href: "/", label: "Panel", icon: LayoutDashboard },
  { href: "/resumen", label: "Resumen", icon: BarChart3 },
  { href: "/cola", label: "Cola", icon: ListChecks },
  { href: "/nueva", label: "Analizar link", icon: PlusCircle },
  { href: "/perfil", label: "Perfil del proyecto", icon: Building2 },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={`nav-item${active ? " active" : ""}`}>
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden>
      C
    </div>
  );
}

export { Inbox };
