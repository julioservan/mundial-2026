"use client";

import { useAuth } from "@/lib/supabase/auth";
import { HomeDashboard } from "@/components/HomeDashboard";

// Si hay sesión, muestra el panel (partidos en juego + ranking). Si no, la
// portada de marketing (children, renderizada en el servidor).
export function HomeSwitcher({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <div className="py-32 text-center text-muted-foreground">Cargando…</div>
    );
  }

  return user ? <HomeDashboard /> : <>{children}</>;
}
