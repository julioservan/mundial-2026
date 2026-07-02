import { timingSafeEqual } from "node:crypto";

// Autorización compartida de los endpoints de cron (/api/sync, /api/backup,
// /api/sync-results). Acepta el `Authorization: Bearer <CRON_SECRET>` que envía
// Vercel Cron o `?secret=` para crons externos. Si CRON_SECRET no está
// configurado, el endpoint queda abierto (útil en desarrollo local).
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const provided =
    req.headers.get("authorization")?.replace("Bearer ", "") ??
    new URL(req.url).searchParams.get("secret");
  if (!provided) return false;
  // Comparación en tiempo constante: no revela por timing cuántos caracteres
  // del secreto coinciden.
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
