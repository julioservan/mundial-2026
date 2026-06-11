"use client";

import Link from "next/link";
import { useAuth } from "@/lib/supabase/auth";

// Envuelve páginas de administración: solo renderiza el contenido si el usuario
// tiene nivel admin. Si no, muestra carga o acceso restringido.
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { loading, user, profile } = useAuth();

  if (loading) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  if (!user || !profile?.is_admin) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-bold tracking-tight mb-2">
          Acceso restringido
        </h1>
        <p className="text-muted-foreground text-sm">
          Esta página es solo para administradores.
        </p>
        <Link
          href="/"
          className="inline-block mt-6 text-sm font-semibold text-accent hover:underline underline-offset-4"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
