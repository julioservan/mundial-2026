import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente anónimo para route handlers del servidor (lecturas públicas bajo
// RLS, p. ej. /api/live y /api/health). Singleton por instancia: evita crear
// un cliente nuevo en cada petición. Devuelve null si Supabase no está
// configurado, para que cada endpoint responda con su fallback.
let serverClient: SupabaseClient | null = null;

export function getSupabaseAnonServer(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!serverClient) {
    serverClient = createClient(url, key, { auth: { persistSession: false } });
  }
  return serverClient;
}
