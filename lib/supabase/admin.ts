import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente de servidor con la service-role key: SALTA RLS. NUNCA importar desde
// código que se ejecute en el navegador. Lo usan el poller (/api/sync) y el
// script de backfill para escribir resultados/fixtures.
let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (solo servidor).",
    );
  }
  if (!adminClient) {
    adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });
  }
  return adminClient;
}
