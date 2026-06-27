// ============================================================================
// Backfill one-off: siembra TODOS los partidos actuales (programados/terminados)
// desde API-Football hacia Supabase, para que la web no aparezca vacía antes del
// próximo partido en vivo.
//
// Uso:
//   1. Copia .env.example a .env.local y rellena APIFOOTBALL_KEY, la URL de
//      Supabase y SUPABASE_SERVICE_ROLE_KEY.
//   2. Ejecuta el SQL de supabase/api-football.sql en tu proyecto.
//   3. npm run backfill
//
// Hace una sincronización "full" (1-2 peticiones a la API) saltándose el
// anti-rebote y la ventana de partidos. Respeta el tope diario de cuota.
// ============================================================================

import { runSync } from "@/lib/sync";
import { MATCHES } from "@/lib/data/matches";

async function main() {
  if (!process.env.APIFOOTBALL_KEY) {
    console.error("✗ Falta APIFOOTBALL_KEY (revisa .env.local).");
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("✗ Falta SUPABASE_SERVICE_ROLE_KEY (revisa .env.local).");
    process.exit(1);
  }

  console.log("→ Sincronizando todos los partidos (modo full)…");
  const summary = await runSync("full", MATCHES.map((m) => m.kickoff));

  console.log("\nResumen:");
  console.log(`  · Peticiones usadas hoy:   ${summary.dailyCount}/${summary.dailyCap}`);
  console.log(`  · Fixtures guardados:      ${summary.fixturesUpserted}`);
  console.log(`  · Resultados guardados:    ${summary.resultsUpserted}`);
  if (summary.note) console.log(`  · Nota: ${summary.note}`);
  if (summary.errors.length) {
    console.log(`  · Errores: ${summary.errors.join("; ")}`);
  }
  console.log(summary.ok ? "\n✓ Backfill completado." : "\n⚠ Backfill con avisos.");
  process.exit(summary.ok ? 0 : 1);
}

main().catch((e) => {
  console.error("✗ Backfill falló:", e);
  process.exit(1);
});
