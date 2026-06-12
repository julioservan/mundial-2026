"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/supabase/auth";
import { getSupabase } from "@/lib/supabase/client";

interface Player {
  id: string;
  username: string;
  avatar_url: string | null;
}

export default function PlayersPage() {
  const { user } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data, error } = await getSupabase()
          .from("mundial_profiles")
          .select("id, username, avatar_url")
          .order("username", { ascending: true });
        if (error) throw error;
        if (active) setPlayers((data as Player[]) ?? []);
      } catch {
        if (active) setError("No se pudieron cargar los jugadores.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <header className="mb-8">
        <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-accent mb-3">
          — Jugadores
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          Pronósticos de{" "}
          <span className="font-display text-accent">la gente.</span>
        </h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Toca a un jugador para ver sus pronósticos. Cada partido se revela
          cuando empieza.
        </p>
      </header>

      {loading ? (
        <p className="text-center text-muted-foreground py-12">Cargando…</p>
      ) : error ? (
        <p className="text-center text-pink py-12">{error}</p>
      ) : (
        <ul className="bg-surface border border-border rounded-2xl divide-y divide-border/60 overflow-hidden">
          {players.map((p) => {
            const isMe = p.id === user?.id;
            return (
              <li key={p.id}>
                <Link
                  href={`/players/${p.id}`}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    isMe ? "bg-accent-soft" : "hover:bg-surface-muted/40"
                  }`}
                >
                  <Avatar
                    url={p.avatar_url}
                    name={p.username}
                    size={36}
                    className="text-sm shrink-0"
                  />
                  <span className="flex-1 font-semibold tracking-tight truncate">
                    {p.username}
                    {isMe && (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-accent">
                        Tú
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground" aria-hidden>
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
