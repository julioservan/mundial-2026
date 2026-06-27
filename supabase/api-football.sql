-- ============================================================================
-- Mundial 2026 — Pipeline de datos automático (API-Football)
-- ----------------------------------------------------------------------------
-- Ejecuta este archivo UNA vez en el SQL Editor de Supabase, DESPUÉS de
-- `schema.sql`. Añade metadatos del proveedor externo (API-Football) para que
-- el poller pueda cachear los IDs de liga/temporada, contar peticiones diarias
-- (control de cuota del plan gratuito ~100 req/día) y exponer la frescura del
-- dato a la web.
--
-- Los marcadores siguen guardándose en `mundial_results` (ver schema.sql); esta
-- tabla NO duplica resultados, solo guarda estado del pipeline.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Metadatos del proveedor: clave/valor con JSON. Una sola fila por clave.
--   league_season  -> { "leagueId": 1, "season": 2026 } (resuelto vía /leagues)
--   request_count  -> { "date": "2026-06-27", "count": 42 } (cuota diaria)
--   last_sync      -> { "at": "2026-06-27T18:30:00Z", "ok": true, "note": "" }
-- ---------------------------------------------------------------------------
create table if not exists public.mundial_meta (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.mundial_meta enable row level security;

-- Lectura pública (la web muestra el indicador de "datos quizá con retraso").
drop policy if exists "mundial_meta_select" on public.mundial_meta;
create policy "mundial_meta_select"
  on public.mundial_meta for select
  using (true);

-- Solo los admins pueden escribir desde el navegador. El poller escribe con la
-- service-role key (que salta RLS), así que no necesita política propia.
drop policy if exists "mundial_meta_write_admin" on public.mundial_meta;
create policy "mundial_meta_write_admin"
  on public.mundial_meta for all
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

-- ---------------------------------------------------------------------------
-- Snapshot por partido desde el feed: QUÉ equipos juegan (clave para pintar el
-- cuadro de eliminatoria con equipos reales en vez de "Por definir") y el estado
-- + marcador EN VIVO para que la web nunca tenga que llamar a la API externa.
--
-- Reparto de responsabilidades:
--   · mundial_results  -> marcador FINAL oficial (puntúa la quiniela y la tabla)
--   · mundial_fixtures -> snapshot en vivo (estado, marcador actual, equipos)
-- ---------------------------------------------------------------------------
create table if not exists public.mundial_fixtures (
  match_id     text primary key,            -- id nuestro (p. ej. K-round32-1 / wc-A-1)
  external_id  bigint,                      -- id del partido en el proveedor
  stage        text not null,
  "group"      text,
  home_team_id text,                        -- id nuestro o NULL (TBD)
  away_team_id text,
  home_score   smallint,                    -- marcador EN VIVO (NULL si no empezó)
  away_score   smallint,
  status       text not null default 'scheduled',
  kickoff      timestamptz,
  updated_at   timestamptz not null default now()
);

alter table public.mundial_fixtures enable row level security;

-- Lectura pública (el cuadro de eliminatoria es público).
drop policy if exists "mundial_fixtures_select" on public.mundial_fixtures;
create policy "mundial_fixtures_select"
  on public.mundial_fixtures for select
  using (true);

-- Escritura solo admins desde el navegador (el poller usa service-role).
drop policy if exists "mundial_fixtures_write_admin" on public.mundial_fixtures;
create policy "mundial_fixtures_write_admin"
  on public.mundial_fixtures for all
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
