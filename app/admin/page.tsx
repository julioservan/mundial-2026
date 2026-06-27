"use client";

import Link from "next/link";
import { AdminGuard } from "@/components/AdminGuard";

const SECTIONS = [
  {
    href: "/admin/results",
    title: "Resultados",
    desc: "Introduce y actualiza el marcador real de los partidos.",
    icon: "⚽",
  },
  {
    href: "/admin/users",
    title: "Usuarios",
    desc: "Gestiona los niveles: convierte jugadores en admin o quítales el nivel.",
    icon: "👤",
  },
  {
    href: "/admin/sync",
    title: "Sincronización",
    desc: "Estado del robot de datos: última sync, cuota, liga detectada y errores.",
    icon: "📡",
  },
];

export default function AdminHubPage() {
  return (
    <AdminGuard>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <header className="mb-8">
          <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-accent mb-3">
            — Administración
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Panel <span className="font-display text-accent">admin.</span>
          </h1>
          <p className="text-muted-foreground mt-3 text-sm">
            Herramientas de administración de la liga.
          </p>
        </header>

        <div className="grid sm:grid-cols-2 gap-4">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="bg-surface border border-border rounded-2xl p-6 hover:border-accent/40 transition-colors"
            >
              <div className="text-3xl mb-3" aria-hidden>
                {s.icon}
              </div>
              <h2 className="text-lg font-bold tracking-tight">{s.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </AdminGuard>
  );
}
