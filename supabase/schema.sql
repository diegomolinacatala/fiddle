-- Esquema MULTI-NEGOCIO + APPLE WALLET (Supabase). Idempotente: seguro de re-ejecutar
-- sobre una base existente (añade lo que falte, no borra datos).
-- Ejecuta en Supabase: SQL Editor -> New query -> pega esto -> Run.

-- Negocios (config editable por su manager; el diseño vive en el código).
create table if not exists negocios (
  slug   text primary key,
  nombre text,
  tipo   text,
  config jsonb not null default '{}'::jsonb,   -- { meta, premio, acciones, promo, ubicaciones }
  creado timestamptz not null default now()
);

-- Clientes (la identidad detrás de cada pase). Un cliente pertenece a un negocio.
create table if not exists clientes (
  serial      text primary key,          -- nuestro id (va en el QR: /w/<serial>)
  negocio     text,                       -- slug del negocio
  ww_serial   text,                       -- serial de WalletWallet (solo plan B)
  sellos      int  not null default 0,
  premios     int  not null default 0,
  nombre      text,                       -- personalización (aparece en el pase)
  auth_token  text,                       -- authenticationToken del pase (Apple Wallet)
  actualizado timestamptz not null default now(),  -- Apple pregunta "¿qué cambió desde...?"
  creado      timestamptz not null default now()
);
-- Por si la tabla clientes ya existía de antes (añade columnas nuevas):
alter table clientes add column if not exists negocio text;
alter table clientes add column if not exists ww_serial text;
alter table clientes add column if not exists nombre text;
alter table clientes add column if not exists auth_token text;
alter table clientes add column if not exists actualizado timestamptz not null default now();
-- Clientes antiguos sin token: se les genera uno (32 hex) para poder actualizar su pase.
update clientes set auth_token = replace(gen_random_uuid()::text, '-', '') where auth_token is null;
create index if not exists clientes_negocio on clientes (negocio);

-- Historial de acciones.
create table if not exists eventos (
  id      bigint generated always as identity primary key,
  serial  text not null,
  tipo    text not null,
  mensaje text not null,
  ts      timestamptz not null default now()
);
create index if not exists eventos_serial_ts on eventos (serial, ts desc);

-- ===================== APPLE WALLET: actualizaciones =====================
-- Cada iPhone que añade un pase se registra con su push token.
create table if not exists dispositivos (
  id         text primary key,            -- deviceLibraryIdentifier
  push_token text not null,
  creado     timestamptz not null default now()
);
create index if not exists dispositivos_push_token on dispositivos (push_token);

-- Qué pases tiene cada iPhone (n:m). `negocio` desnormalizado para avisar a
-- todo un negocio (promos) sin cruzar miles de seriales.
create table if not exists registros (
  dispositivo text not null references dispositivos(id) on delete cascade,
  pass_type   text not null,
  serial      text not null references clientes(serial) on delete cascade,
  negocio     text,
  creado      timestamptz not null default now(),
  primary key (dispositivo, pass_type, serial)
);
create index if not exists registros_serial on registros (serial);
create index if not exists registros_negocio on registros (negocio);

-- ===================== LÍMITES DE USO =====================
-- PINs fallidos ("login:nube:ip"), emisiones de pases ("tap:ip"), logs ("log:ip").
create table if not exists intentos (
  id    bigint generated always as identity primary key,
  clave text not null,
  ts    timestamptz not null default now()
);
create index if not exists intentos_clave_ts on intentos (clave, ts desc);
-- Limpieza opcional (p.ej. con pg_cron): delete from intentos where ts < now() - interval '1 day';

-- ===================== SEGURIDAD =====================
-- El backend usa la service_role key (se salta RLS). Activar RLS SIN políticas
-- cierra estas tablas a la anon key pública: nadie puede leerlas desde fuera.
alter table negocios       enable row level security;
alter table clientes       enable row level security;
alter table eventos        enable row level security;
alter table dispositivos   enable row level security;
alter table registros      enable row level security;
alter table intentos       enable row level security;
