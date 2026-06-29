import { getSupabase } from "@/lib/supabase/client";
import { cached } from "@/lib/cache";

export interface ProfileLite {
  username: string;
  avatar_url: string | null;
}

// Mapa id -> perfil (nombre y avatar), cacheado en memoria. Lo usan varias
// páginas (ficha de partido, dashboard) que antes recargaban la tabla entera
// en cada visita.
export function fetchProfilesLite(): Promise<Record<string, ProfileLite>> {
  return cached("profiles:lite", 60_000, async () => {
    const { data, error } = await getSupabase()
      .from("mundial_profiles")
      .select("id, username, avatar_url");
    if (error) throw error;
    const map: Record<string, ProfileLite> = {};
    for (const p of data ?? []) {
      map[p.id as string] = {
        username: p.username as string,
        avatar_url: (p.avatar_url as string | null) ?? null,
      };
    }
    return map;
  });
}
