"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { AdminGuard } from "@/components/AdminGuard";
import { useAuth } from "@/lib/supabase/auth";
import { levelLabel } from "@/lib/roles";
import { type AdminProfile, fetchAllProfiles, setAdminLevel } from "@/lib/admin";

export default function AdminUsersPage() {
  return (
    <AdminGuard>
      <UsersManager />
    </AdminGuard>
  );
}

function UsersManager() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await fetchAllProfiles();
        if (active) setProfiles(data);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function toggle(p: AdminProfile) {
    setBusyId(p.id);
    setError(null);
    const next = !p.isAdmin;
    try {
      await setAdminLevel(p.id, next);
      setProfiles((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, isAdmin: next } : x)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar el nivel");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <header className="mb-8">
        <Link
          href="/admin"
          className="text-sm font-semibold text-accent hover:underline underline-offset-4"
        >
          ← Panel admin
        </Link>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mt-3">
          Usuarios <span className="font-display text-accent">y niveles.</span>
        </h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Convierte a un jugador en admin para que pueda gestionar resultados y
          usuarios, o retírale el nivel.
        </p>
      </header>

      {error && (
        <p className="text-sm text-pink bg-pink/10 border border-pink/30 rounded-xl px-4 py-3 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-center text-muted-foreground py-12">
          Cargando usuarios…
        </p>
      ) : (
        <ul className="space-y-2">
          {profiles.map((p) => {
            const isMe = p.id === user?.id;
            return (
              <li
                key={p.id}
                className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-3"
              >
                <Avatar
                  url={p.avatarUrl}
                  name={p.username}
                  size={40}
                  className="text-sm shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold tracking-tight truncate">
                    {p.username}
                    {isMe && (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        (tú)
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      p.isAdmin ? "text-accent" : "text-muted-foreground"
                    }`}
                  >
                    {levelLabel(p.isAdmin)}
                  </span>
                </div>
                <button
                  onClick={() => toggle(p)}
                  disabled={busyId === p.id || isMe}
                  title={
                    isMe ? "No puedes cambiar tu propio nivel" : undefined
                  }
                  className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    p.isAdmin
                      ? "border-border-strong hover:bg-surface-muted"
                      : "border-accent/40 text-accent hover:bg-accent-soft"
                  }`}
                >
                  {busyId === p.id
                    ? "…"
                    : p.isAdmin
                      ? "Quitar admin"
                      : "Hacer admin"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
