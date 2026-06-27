-- ============================================================================
-- Mundial 2026 — Caché del detalle de partido (alineaciones, eventos, stats)
-- ----------------------------------------------------------------------------
-- Ejecuta este archivo en el SQL Editor DESPUÉS de api-football.sql.
-- Guarda el detalle (caro de pedir: 3 llamadas por partido) para no machacar la
-- API en cada visita. El endpoint /api/match/[id] lo refresca con TTL.
-- ============================================================================

create table if not exists public.mundial_match_detail (
  match_id   text primary key,
  data       jsonb not null default '{}'::jsonb, -- { lineups, events, statistics }
  updated_at timestamptz not null default now()
);

alter table public.mundial_match_detail enable row level security;

-- Lectura pública (la ficha de partido es pública).
drop policy if exists "mundial_match_detail_select" on public.mundial_match_detail;
create policy "mundial_match_detail_select"
  on public.mundial_match_detail for select
  using (true);

-- Escritura solo admins desde el navegador (el endpoint usa service-role).
drop policy if exists "mundial_match_detail_write_admin" on public.mundial_match_detail;
create policy "mundial_match_detail_write_admin"
  on public.mundial_match_detail for all
  using (
    exists (
      select 1 from public.mundial_profiles
      where id = auth.uid() and is_admin
    )
  )
  with check (
    exists (
      select 1 from public.mundial_profiles
      where id = auth.uid() and is_admin
    )
  );
