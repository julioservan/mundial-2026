import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Versión del despliegue actual (el SHA del commit en Vercel). La usa
// <VersionGuard> para detectar pestañas con un bundle viejo cacheado y
// recargarlas: una pestaña de móvil abierta durante semanas puede ejecutar
// código ya retirado (así se borraron pronósticos una vez).
export async function GET() {
  return NextResponse.json(
    { v: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
