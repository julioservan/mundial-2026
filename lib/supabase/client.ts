import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Cliente único para el navegador. La sesión se persiste en localStorage
// (comportamiento por defecto), suficiente para una app client-side servida
// como estática. La seguridad la dan las políticas RLS, no la clave.
let browserClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Copia .env.example a .env.local y rellénalas.",
    );
  }
  if (!browserClient) {
    browserClient = createClient(url, key);
  }
  return browserClient;
}

// Permite que la UI muestre un aviso amable si el proyecto aún no está conectado.
export const isSupabaseConfigured = Boolean(url && key);
