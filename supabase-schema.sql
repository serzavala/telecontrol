-- =============================================
-- TELECONTROL — Schema de base de datos
-- Ejecutar en el SQL Editor de Supabase
-- =============================================

-- Habilitar RLS (Row Level Security)
-- Todas las tablas usan el user_id del usuario autenticado

-- CUADRILLAS
create table if not exists cuadrillas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  nombre text not null,
  responsable text,
  esquema text not null check (esquema in ('Semanal','CN','Ambas')),
  telefono text,
  created_at timestamptz default now()
);
alter table cuadrillas enable row level security;
create policy "usuarios ven sus cuadrillas" on cuadrillas
  for all using (auth.uid() = user_id);

-- PROYECTOS
create table if not exists proyectos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  nombre text not null,
  cliente text,
  ciudad text,
  tipo text not null check (tipo in ('Semanal','CN','OC')),
  estado text default 'Activo' check (estado in ('Activo','En pausa','Terminado')),
  created_at timestamptz default now()
);
alter table proyectos enable row level security;
create policy "usuarios ven sus proyectos" on proyectos
  for all using (auth.uid() = user_id);

-- CONCEPTOS
create table if not exists conceptos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  num text,
  nombre text not null,
  unidad text,
  precio numeric(12,2) not null,
  created_at timestamptz default now()
);
alter table conceptos enable row level security;
create policy "usuarios ven sus conceptos" on conceptos
  for all using (auth.uid() = user_id);

-- PRODUCCION (registros diarios)
create table if not exists produccion (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  fecha date not null,
  cuadrilla_id uuid references cuadrillas not null,
  concepto_id uuid references conceptos not null,
  proyecto_id uuid references proyectos not null,
  cantidad numeric(12,2) not null,
  precio_unitario numeric(12,2) not null,
  total numeric(12,2) not null,
  notas text,
  created_at timestamptz default now()
);
alter table produccion enable row level security;
create policy "usuarios ven su produccion" on produccion
  for all using (auth.uid() = user_id);

-- REGISTROS CN (quincenales)
create table if not exists registros_cn (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  quincena text not null check (quincena in ('1','2')),
  mes text not null,  -- formato YYYY-MM
  cuadrilla_id uuid references cuadrillas not null,
  proyecto_id uuid references proyectos not null,
  monto numeric(12,2) not null,
  estado text default 'Pendiente' check (estado in ('Pendiente','Pagado')),
  notas text,
  created_at timestamptz default now()
);
alter table registros_cn enable row level security;
create policy "usuarios ven sus registros cn" on registros_cn
  for all using (auth.uid() = user_id);

-- CORTES (historial de cortes generados)
create table if not exists cortes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  tipo text not null check (tipo in ('Semanal','CN')),
  periodo text not null,
  proyecto_id uuid references proyectos,
  proyecto_nombre text,
  total numeric(12,2) not null,
  estado_pago text default 'Pendiente' check (estado_pago in ('Pendiente','Pagado')),
  fecha_corte date default current_date,
  fecha_pago date,
  created_at timestamptz default now()
);
alter table cortes enable row level security;
create policy "usuarios ven sus cortes" on cortes
  for all using (auth.uid() = user_id);

-- PERFILES DE USUARIO (roles)
create table if not exists perfiles (
  id uuid primary key references auth.users,
  nombre text,
  rol text default 'Capturista' check (rol in ('Administrador','Capturista','Consulta')),
  created_at timestamptz default now()
);
alter table perfiles enable row level security;
create policy "usuarios ven su perfil" on perfiles
  for all using (auth.uid() = id);

-- Trigger para crear perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.perfiles (id, nombre, rol)
  values (new.id, new.raw_user_meta_data->>'nombre', 'Administrador');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
