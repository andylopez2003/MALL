-- Ejecutar completo en Supabase SQL Editor.
-- Agrega pedido_id a cupones (si no existe) y crea la funcion para el admin.

alter table public.cupones
  add column if not exists pedido_id uuid references public.pedidos(id) on delete set null;

create index if not exists cupones_pedido_id_idx on public.cupones(pedido_id);

drop function if exists get_cupones_admin();

create or replace function get_cupones_admin()
returns table (
  id                uuid,
  codigo            text,
  valor             numeric,
  estado            text,
  fecha_emision     timestamptz,
  fecha_vencimiento timestamptz,
  cliente_id        uuid,
  pedido_id         uuid,
  cliente_nombre    text,
  cliente_telefono  text,
  cliente_dpi       text,
  pedido_numero     text,
  pedido_monto      numeric
)
language sql
security definer
stable
as $$
  select
    c.id,
    c.codigo,
    c.valor,
    c.estado,
    c.fecha_emision,
    c.fecha_vencimiento,
    c.cliente_id,
    c.pedido_id,
    u.nombre        as cliente_nombre,
    u.telefono      as cliente_telefono,
    u.dpi           as cliente_dpi,
    left(p.id::text, 8) as pedido_numero,
    p.monto_total   as pedido_monto
  from public.cupones c
  left join public.usuarios u on u.id = c.cliente_id
  left join public.pedidos  p on p.id = c.pedido_id
  order by coalesce(c.fecha_emision, c.created_at) desc nulls last
  limit 500;
$$;

revoke all on function get_cupones_admin() from public;
grant execute on function get_cupones_admin() to authenticated;
