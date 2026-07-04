-- ============================================================================
-- Mundial 2026 — Reseteo del Simulador por un admin
-- ----------------------------------------------------------------------------
-- Ejecuta este archivo UNA vez en el SQL Editor de Supabase, DESPUÉS de
-- `simulador.sql`. Permite a los admins borrar el cuadro guardado de cualquier
-- jugador desde /admin/users (p. ej. si lo guardó antes de tiempo y quiere
-- rehacerlo). El guardado sigue siendo irreversible para el propio jugador.
-- ============================================================================

drop policy if exists "mundial_simulador_delete_admin" on public.mundial_simulador;
create policy "mundial_simulador_delete_admin"
  on public.mundial_simulador for delete
  using (
    exists (
      select 1 from public.mundial_profiles
      where id = auth.uid() and is_admin
    )
  );
