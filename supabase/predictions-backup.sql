-- ============================================================================
-- Mundial 2026 — Copia de seguridad diaria de los pronósticos
-- Ejecuta UNA vez en el SQL Editor de Supabase.
-- ----------------------------------------------------------------------------
-- Guarda una instantánea (snapshot) diaria de TODOS los pronósticos en JSON,
-- una fila por día. Permite restaurar si algo se borra. La escribe el endpoint
-- /api/backup (service-role); la lectura es solo para admins (datos de todos).
-- ============================================================================

create table if not exists public.mundial_pred_backups (
  taken_on   date primary key,            -- una instantánea por día
  count      int not null default 0,      -- nº de pronósticos guardados
  data       jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.mundial_pred_backups enable row level security;

-- Solo admins pueden leer (contiene los pronósticos de todos).
drop policy if exists "mundial_pred_backups_admin_select" on public.mundial_pred_backups;
create policy "mundial_pred_backups_admin_select"
  on public.mundial_pred_backups for select
  using (
    exists (
      select 1 from public.mundial_profiles
      where id = auth.uid() and is_admin
    )
  );
