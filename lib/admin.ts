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
