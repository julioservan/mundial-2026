-- ============================================================================
-- Mundial 2026 — Zona horaria del perfil
-- Ejecuta UNA vez en el SQL Editor de Supabase, después del schema.sql.
-- Guarda una IANA Time Zone (p. ej. "Europe/Madrid"); NULL = usar la del
-- dispositivo del usuario.
-- ============================================================================

alter table public.mundial_profiles
  add column if not exists timezone text;
