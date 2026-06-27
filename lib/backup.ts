// Copia de seguridad de los pronósticos. Guarda una instantánea diaria en
// `mundial_pred_backups` (una fila por día) para poder restaurar ante pérdidas.
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const BACKUP_INTERVAL_H = Number(process.env.PRED_BACKUP_INTERVAL_H ?? 20);

export interface BackupResult {
  date: string;
  count: number;
}

// Hace una instantánea de TODOS los pronósticos (upsert por fecha de hoy).
export async function backupPredictions(): Promise<BackupResult> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("mundial_predictions")
    .select("user_id, match_id, pick, home_score, away_score, advance");
  if (error) throw error;

  const date = new Date().toISOString().slice(0, 10);
  const rows = data ?? [];

  const { error: upErr } = await supabase.from("mundial_pred_backups").upsert(
    { taken_on: date, count: rows.length, data: rows, created_at: new Date().toISOString() },
    { onConflict: "taken_on" },
  );
  if (upErr) throw upErr;

  await supabase.from("mundial_meta").upsert(
    {
      key: "last_backup",
      value: { at: new Date().toISOString(), date, count: rows.length },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  return { date, count: rows.length };
}

// Hace la copia solo si la última fue hace más de BACKUP_INTERVAL_H horas.
// Best-effort: nunca lanza (no debe romper la sincronización que la invoca).
export async function maybeBackup(): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("mundial_meta")
      .select("value")
      .eq("key", "last_backup")
      .maybeSingle();
    const last = data?.value as { at?: string } | undefined;
    if (
      last?.at &&
      Date.now() - new Date(last.at).getTime() < BACKUP_INTERVAL_H * 3_600_000
    ) {
      return;
    }
    await backupPredictions();
  } catch {
    // si falla, no rompemos el flujo que la llamó
  }
}
