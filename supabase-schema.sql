-- MALL - esquema inicial Supabase
-- Ejecutar completo en Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text unique,
  telefono text,
  dpi text unique,
  rol text not null default 'cliente' check (rol in ('admin', 'cliente', 'repartidor')),
  qr_code text,
  direccion text,
  foto_url text,
  google_id text unique,
  onboarding_completo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.usuarios add column if not exists telefono text;
alter table public.usuarios add column if not exists dpi text;
alter table public.usuarios add column if not exists rol text not null default 'cliente';
alter table public.usuarios add column if not exists qr_code text;
alter table public.usuarios add column if not exists direccion text;
alter table public.usuarios add column if not exists foto_url text;
alter table public.usuarios add column if not exists google_id text;
alter table public.usuarios add column if not exists onboarding_completo boolean not null default false;
alter table public.usuarios add column if not exists created_at timestamptz not null default now();
alter table public.usuarios add column if not exists updated_at timestamptz not null default now();
alter table public.usuarios alter column id set default gen_random_uuid();
alter table public.usuarios drop constraint if exists usuarios_email_key;
update public.usuarios set email = null where email = '';

-- Agregar SKU a productos (codigo corto para busqueda rapida en caja)
alter table if exists public.productos add column if not exists sku text unique;

create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  sku text unique,
  descripcion text,
  precio numeric(10,2) not null default 0 check (precio >= 0),
  imagen_url text,
  categoria text,
  stock integer not null default 0 check (stock >= 0),
  participa_promocion boolean not null default true,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ofertas (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  precio_oferta numeric(10,2) not null check (precio_oferta >= 0),
  porcentaje_descuento numeric(5,2) default 0 check (porcentaje_descuento >= 0),
  fecha_inicio date not null,
  fecha_fin date not null,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fecha_fin >= fecha_inicio)
);

create table if not exists public.promociones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  tipo text not null default 'descuento',
  valor numeric(10,2) not null default 0,
  fecha_inicio date not null,
  fecha_fin date not null,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fecha_fin >= fecha_inicio)
);

-- Permitir ventas sin cliente (C/F = Cliente Final)
alter table if exists public.compras alter column cliente_id drop not null;

create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.usuarios(id) on delete restrict,
  monto_total numeric(10,2) not null default 0 check (monto_total >= 0),
  puntos_ganados integer not null default 0 check (puntos_ganados >= 0),
  admin_id uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.puntos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null unique references public.usuarios(id) on delete cascade,
  saldo integer not null default 0 check (saldo >= 0),
  total_ganado integer not null default 0 check (total_ganado >= 0),
  total_canjeado integer not null default 0 check (total_canjeado >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.movimientos_puntos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.usuarios(id) on delete cascade,
  tipo text not null check (tipo in ('ganado', 'canjeado')),
  monto integer not null check (monto > 0),
  descripcion text,
  compra_id uuid references public.compras(id) on delete set null,
  admin_id uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.usuarios(id) on delete restrict,
  direccion_entrega text not null,
  latitud numeric(10,7),
  longitud numeric(10,7),
  horario text,
  hora_entrega_asignada time,
  monto_total numeric(10,2) not null default 0 check (monto_total >= 0),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'confirmado', 'preparando', 'en_camino', 'entregado', 'cancelado')),
  genera_cupon boolean not null default false,
  telefono_contacto text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.detalle_pedidos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  producto_id uuid references public.productos(id) on delete set null,
  nombre_producto text not null,
  cantidad integer not null check (cantidad > 0),
  precio_unitario numeric(10,2) not null check (precio_unitario >= 0),
  subtotal numeric(10,2) not null check (subtotal >= 0),
  created_at timestamptz not null default now()
);

-- Permitir cliente_id nulo para cupones de regalo sin cliente asignado
alter table if exists public.cupones alter column cliente_id drop not null;

create table if not exists public.cupones (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  cliente_id uuid references public.usuarios(id) on delete cascade,
  pedido_id uuid references public.pedidos(id) on delete set null,
  valor numeric(10,2) not null default 10 check (valor >= 0),
  estado text not null default 'activo' check (estado in ('activo', 'canjeado', 'vencido', 'cancelado')),
  fecha_emision timestamptz not null default now(),
  fecha_vencimiento timestamptz not null,
  fecha_canje timestamptz,
  admin_canje_id uuid references public.usuarios(id) on delete set null,
  descripcion_canje text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.configuracion (
  clave text primary key,
  valor jsonb not null,
  descripcion text,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_usuarios_updated_at on public.usuarios;
create trigger set_usuarios_updated_at before update on public.usuarios
for each row execute function public.set_updated_at();

drop trigger if exists set_productos_updated_at on public.productos;
create trigger set_productos_updated_at before update on public.productos
for each row execute function public.set_updated_at();

drop trigger if exists set_ofertas_updated_at on public.ofertas;
create trigger set_ofertas_updated_at before update on public.ofertas
for each row execute function public.set_updated_at();

drop trigger if exists set_promociones_updated_at on public.promociones;
create trigger set_promociones_updated_at before update on public.promociones
for each row execute function public.set_updated_at();

drop trigger if exists set_puntos_updated_at on public.puntos;
create trigger set_puntos_updated_at before update on public.puntos
for each row execute function public.set_updated_at();

drop trigger if exists set_pedidos_updated_at on public.pedidos;
create trigger set_pedidos_updated_at before update on public.pedidos
for each row execute function public.set_updated_at();

drop trigger if exists set_cupones_updated_at on public.cupones;
create trigger set_cupones_updated_at before update on public.cupones
for each row execute function public.set_updated_at();

create index if not exists usuarios_rol_idx on public.usuarios(rol);
create index if not exists usuarios_dpi_idx on public.usuarios(dpi);
create index if not exists productos_activo_idx on public.productos(activo);
create index if not exists productos_categoria_idx on public.productos(categoria);
create index if not exists ofertas_producto_idx on public.ofertas(producto_id);
create index if not exists compras_cliente_idx on public.compras(cliente_id);
create index if not exists compras_created_at_idx on public.compras(created_at);
create index if not exists movimientos_cliente_idx on public.movimientos_puntos(cliente_id);
create index if not exists movimientos_created_at_idx on public.movimientos_puntos(created_at);
create index if not exists pedidos_cliente_idx on public.pedidos(cliente_id);
create index if not exists pedidos_created_at_idx on public.pedidos(created_at);
create index if not exists pedidos_estado_idx on public.pedidos(estado);
create index if not exists detalle_pedido_idx on public.detalle_pedidos(pedido_id);
create index if not exists detalle_producto_idx on public.detalle_pedidos(producto_id);
create index if not exists cupones_codigo_idx on public.cupones(codigo);
create index if not exists cupones_cliente_idx on public.cupones(cliente_id);
create index if not exists cupones_estado_idx on public.cupones(estado);

insert into public.configuracion (clave, valor, descripcion)
values
  ('monto_minimo_domicilio', '20', 'Monto minimo para pedidos a domicilio'),
  ('monto_cupon_domicilio', '150', 'Monto minimo para generar cupon de domicilio (legado)'),
  ('valor_cupon_domicilio', '10', 'Valor del cupon de domicilio (legado)'),
  ('dias_vencimiento_cupon', '14', 'Dias de vigencia del cupon'),
  ('max_pedidos_jornada', '6', 'Maximo de pedidos por jornada'),
  ('slots_entrega', '["13:00-15:00","17:00-19:00"]', 'Jornadas de entrega disponibles'),
  ('umbrales_cupones_domicilio', '[[150,10],[300,20],[450,30]]', 'Niveles de cupon por monto de pedido domicilio')
on conflict (clave) do update
set valor = excluded.valor,
    descripcion = excluded.descripcion,
    updated_at = now();

insert into public.usuarios (id, nombre, email, rol, onboarding_completo)
values (
  '1dda4f67-8bb2-4aab-bf18-6700e51d0896',
  'Andy Lopez',
  'andylopez20032018@gmail.com',
  'admin',
  true
)
on conflict (id) do update
set nombre = excluded.nombre,
    email = excluded.email,
    rol = 'admin',
    onboarding_completo = true,
    updated_at = now();

alter table public.usuarios enable row level security;
alter table public.productos enable row level security;
alter table public.ofertas enable row level security;
alter table public.promociones enable row level security;
alter table public.compras enable row level security;
alter table public.puntos enable row level security;
alter table public.movimientos_puntos enable row level security;
alter table public.pedidos enable row level security;
alter table public.detalle_pedidos enable row level security;
alter table public.cupones enable row level security;
alter table public.configuracion enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios
    where id = auth.uid()
      and rol = 'admin'
  );
$$;

drop policy if exists "admins gestionan usuarios" on public.usuarios;
create policy "admins gestionan usuarios" on public.usuarios
for all to authenticated
using (public.is_admin() or id = auth.uid())
with check (public.is_admin() or id = auth.uid());

drop policy if exists "admins gestionan productos" on public.productos;
create policy "admins gestionan productos" on public.productos
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins gestionan ofertas" on public.ofertas;
create policy "admins gestionan ofertas" on public.ofertas
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins gestionan promociones" on public.promociones;
create policy "admins gestionan promociones" on public.promociones
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins gestionan compras" on public.compras;
create policy "admins gestionan compras" on public.compras
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins gestionan puntos" on public.puntos;
create policy "admins gestionan puntos" on public.puntos
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins gestionan movimientos" on public.movimientos_puntos;
create policy "admins gestionan movimientos" on public.movimientos_puntos
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins gestionan pedidos" on public.pedidos;
create policy "admins gestionan pedidos" on public.pedidos
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins gestionan detalle pedidos" on public.detalle_pedidos;
create policy "admins gestionan detalle pedidos" on public.detalle_pedidos
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins gestionan cupones" on public.cupones;
create policy "admins gestionan cupones" on public.cupones
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins gestionan configuracion" on public.configuracion;
create policy "admins gestionan configuracion" on public.configuracion
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do update
set public = true;

drop policy if exists "imagenes productos lectura publica" on storage.objects;
create policy "imagenes productos lectura publica" on storage.objects
for select to public
using (bucket_id = 'productos');

drop policy if exists "admins suben imagenes productos" on storage.objects;
create policy "admins suben imagenes productos" on storage.objects
for insert to authenticated
with check (bucket_id = 'productos' and public.is_admin());

drop policy if exists "admins actualizan imagenes productos" on storage.objects;
create policy "admins actualizan imagenes productos" on storage.objects
for update to authenticated
using (bucket_id = 'productos' and public.is_admin())
with check (bucket_id = 'productos' and public.is_admin());

drop policy if exists "admins eliminan imagenes productos" on storage.objects;
create policy "admins eliminan imagenes productos" on storage.objects
for delete to authenticated
using (bucket_id = 'productos' and public.is_admin());
