"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/supabase/auth";
import { getSupabase } from "@/lib/supabase/client";

export default function ProfilePage() {
  const router = useRouter();
  const { loading, user, profile, signOut, refreshProfile } = useAuth();

  // `draft` es null mientras no se haya editado: el campo muestra el valor del
  // perfil. Así evitamos sincronizar estado desde un efecto.
  const [draft, setDraft] = useState<string | null>(null);
  const username = draft ?? profile?.username ?? "";
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const { error } = await getSupabase()
      .from("mundial_profiles")
      .update({ username: username.trim() })
      .eq("id", user.id);

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    await refreshProfile();
    setDraft(null);
    setSaved(true);
  }

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-md px-4 sm:px-6 py-20 text-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-16">
      <header className="mb-8">
        <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-accent mb-3">
          — Tu perfil
        </div>
        <h1 className="text-4xl font-bold tracking-tight">
          Hola,{" "}
          <span className="font-display text-accent">
            {profile?.username ?? "jugador"}.
          </span>
        </h1>
      </header>

      <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8">
        <form onSubmit={handleSave} className="space-y-4">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Nombre de jugador
            </span>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setDraft(e.target.value);
                setSaved(false);
              }}
              required
              className="mt-1.5 w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-all"
            />
          </label>

          <div className="text-xs text-muted-foreground">
            Sesión: <span className="text-foreground">{user.email}</span>
          </div>

          {error && (
            <p className="text-sm text-pink bg-pink/10 border border-pink/30 rounded-xl px-4 py-3">
              {error}
            </p>
          )}
          {saved && (
            <p className="text-sm text-accent bg-accent-soft border border-accent/30 rounded-xl px-4 py-3">
              Guardado ✓
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-accent text-accent-foreground font-semibold rounded-full hover:bg-accent-bold transition-colors disabled:opacity-60"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </form>
      </div>

      {profile?.is_admin && (
        <Link
          href="/admin/results"
          className="mt-4 block text-center text-sm font-semibold text-accent hover:underline underline-offset-4"
        >
          Panel de resultados (admin) →
        </Link>
      )}

      <button
        onClick={async () => {
          await signOut();
          router.push("/");
        }}
        className="mt-6 w-full py-3 border border-border-strong font-semibold rounded-full hover:bg-surface transition-colors"
      >
        Cerrar sesión
      </button>
    </div>
  );
}
