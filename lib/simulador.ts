import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

// Un voto del simulador: qué lado pasa en cada cruce de la eliminatoria.
export type SimSide = "home" | "away";
export type SimPicks = Record<string, SimSide>;

export interface SimuladorRow {
  picks: SimPicks;
  locked: boolean;
  // Cuándo se guardó: los cruces ya jugados a esa hora no puntúan (no eran
  // pronóstico, eran historia).
  savedAt: string | null;
}

export interface SimuladorFriend {
  userId: string;
  username: string;
  avatarUrl: string | null;
  picks: SimPicks;
  locked: boolean;
  savedAt: string | null;
}

// Cuadro guardado del usuario (null si todavía no ha guardado nada).
export async function fetchMySimulador(
  userId: string,
): Promise<SimuladorRow | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await getSupabase()
    .from("mundial_simulador")
    .select("picks, locked, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    picks: (data.picks as SimPicks) ?? {},
    locked: Boolean(data.locked),
    savedAt: (data.updated_at as string | null) ?? null,
  };
}

// Guarda el cuadro y lo BLOQUEA: a partir de aquí no se puede cambiar.
export async function saveMySimulador(
  userId: string,
  picks: SimPicks,
): Promise<void> {
  const { error } = await getSupabase()
    .from("mundial_simulador")
    .upsert(
      {
        user_id: userId,
        picks,
        locked: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}

// Cuadros guardados (bloqueados) de todos los jugadores, con su perfil.
export async function fetchAllSimuladores(): Promise<SimuladorFriend[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = getSupabase();
  const [simRes, profRes] = await Promise.all([
    supabase
      .from("mundial_simulador")
      .select("user_id, picks, locked, updated_at")
      .eq("locked", true),
    supabase.from("mundial_profiles").select("id, username, avatar_url"),
  ]);
  if (simRes.error) throw simRes.error;
  if (profRes.error) throw profRes.error;

  const profiles = new Map<string, { username: string; avatar: string | null }>(
    (profRes.data ?? []).map((p) => [
      p.id as string,
      {
        username: (p.username as string) ?? "Jugador",
        avatar: (p.avatar_url as string | null) ?? null,
      },
    ]),
  );

  return (simRes.data ?? []).map((r) => {
    const prof = profiles.get(r.user_id as string);
    return {
      userId: r.user_id as string,
      username: prof?.username ?? "Jugador",
      avatarUrl: prof?.avatar ?? null,
      picks: (r.picks as SimPicks) ?? {},
      locked: Boolean(r.locked),
      savedAt: (r.updated_at as string | null) ?? null,
    };
  });
}
