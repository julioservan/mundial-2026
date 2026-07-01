-- ============================================================================
-- Mundial 2026 — Tanda de penales en el snapshot de partidos
-- ----------------------------------------------------------------------------
-- Ejecuta este archivo UNA vez en el SQL Editor de Supabase, DESPUÉS de
-- `api-football.sql`. Añade a `mundial_fixtures` el resultado de la tanda de
-- penales que publica API-Football (campo `score.penalty`).
--
-- Sin esto, una eliminatoria que acabe en empate no puede resolver quién pasa:
-- el bracket dejaría "Por definir" en la ronda siguiente (y el campeón quedaría
-- vacío si la final se decide en penales).
-- ============================================================================

alter table public.mundial_fixtures
  add column if not exists home_pen smallint,
  add column if not exists away_pen smallint;
