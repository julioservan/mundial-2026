-- ============================================================================
-- Mundial 2026 — SIMULADOR de eliminatorias (sección independiente)
-- Ejecuta UNA vez en el SQL Editor de Supabase, después del schema.sql.
--
-- Guarda el cuadro completo que cada usuario rellena en /simulador. No tiene
-- ninguna relación con `mundial_predictions` (la quiniela oficial): aquí solo
-- se almacena el bracket y, una vez "guardado", queda BLOQUEADO (no se puede
-- cambiar). Los aciertos se calculan en el cliente cruzando estos picks con
-- `mundial_results` (lo que va sincronizando la API).
-- ============================================================================

create table if not exists public.mundial_simulador (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  picks      jsonb not null default '{}'::jsonb,
  locked     boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.mundial_simulador enable row level security;

-- Lectura para todos (poder ver el cuadro de los amigos).
drop policy if exists "mundial_simulador_select" on public.mundial_simulador;
create policy "mundial_simulador_select"
  on public.mundial_simulador for select
  using (true);

-- Cada usuario puede crear SOLO su propia fila.
drop policy if exists "mundial_simulador_insert_own" on public.mundial_simulador;
create policy "mundial_simulador_insert_own"
  on public.mundial_simulador for insert
  with check (auth.uid() = user_id);

-- Solo se puede actualizar la fila propia mientras NO esté bloqueada.
-- Una vez `locked = true`, este USING falla y el cuadro queda congelado.
drop policy if exists "mundial_simulador_update_own_unlocked" on public.mundial_simulador;
create policy "mundial_simulador_update_own_unlocked"
  on public.mundial_simulador for update
  using (auth.uid() = user_id and locked = false)
  with check (auth.uid() = user_id);
