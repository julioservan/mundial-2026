import { getSupabase } from "@/lib/supabase/client";

export interface AdminProfile {
  id: string;
  username: string;
  avatarUrl: string | null;
  isAdmin: boolean;
}

// Lista todos los jugadores (para el panel de gestión de usuarios).
export async function fetchAllProfiles(): Promise<AdminProfile[]> {
  const { data, error } = await getSupabase()
    .from("mundial_profiles")
    .select("id, username, avatar_url, is_admin")
    .order("username", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((p) => ({
    id: p.id as string,
    username: p.username as string,
    avatarUrl: (p.avatar_url as string | null) ?? null,
    isAdmin: Boolean(p.is_admin),
  }));
}

// Cambia el nivel de un usuario. Requiere ser admin (política RLS en roles.sql).
export async function setAdminLevel(userId: string, isAdmin: boolean) {
  const { error } = await getSupabase()
    .from("mundial_profiles")
    .update({ is_admin: isAdmin })
    .eq("id", userId);
  if (error) throw error;
}

// Ids de los jugadores con cuadro del Simulador guardado (para saber a quién
// se le puede resetear desde el panel).
export async function fetchSimuladorUserIds(): Promise<Set<string>> {
  const { data, error } = await getSupabase()
    .from("mundial_simulador")
    .select("user_id")
    .eq("locked", true);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.user_id as string));
}

// Borra el cuadro del Simulador de un jugador para que pueda rehacerlo.
// Requiere ser admin (política RLS en simulador-admin.sql). Sus pronósticos
// de la quiniela (mundial_predictions) NO se tocan.
export async function resetSimulador(userId: string) {
  const { error } = await getSupabase()
    .from("mundial_simulador")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}
