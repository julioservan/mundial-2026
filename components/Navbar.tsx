"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthNav } from "@/components/AuthNav";

const LINKS = [
  { href: "/matches", label: "Partidos" },
  { href: "/groups", label: "Grupos" },
  { href: "/eliminatoria", label: "Eliminatoria" },
  { href: "/predictions", label: "Predicciones" },
  { href: "/leaderboard", label: "Ranking" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-border bg-background/70 backdrop-blur-md sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 group"
          onClick={() => setOpen(false)}
        >
          <span className="relative w-8 h-8 rounded-full bg-accent flex items-center justify-center text-base">
            <span aria-hidden>⚽</span>
            <span className="absolute inset-0 rounded-full pulse-ring" aria-hidden />
          </span>
          <span className="font-semibold tracking-tight text-base">
            Mundialistas<span className="font-display not-italic text-accent">2026</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <AuthNav />
          {/* Botón hamburguesa (solo móvil) */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 -mr-2 rounded-lg hover:bg-surface transition-colors"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              {open ? (
                <>
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="6" y1="18" x2="18" y2="6" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Menú desplegable móvil */}
      {open && (
        <nav className="md:hidden border-t border-border bg-background">
          <div className="px-4 py-2">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block px-2 py-3 text-base font-medium text-foreground hover:text-accent border-b border-border/50 last:border-0 transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <div className="py-3">
              <AuthNav variant="mobile" onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
