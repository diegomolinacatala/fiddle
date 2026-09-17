-- Esquema MULTI-NEGOCIO (Supabase). Idempotente: seguro de re-ejecutar.
-- Ejecuta en Supabase: SQL Editor -> New query -> pega esto -> Run.

-- Negocios (config editable por su manager; el diseño vive en el código).
create table if not exists negocios (
  slug   text primary key,
  nombre text,
  tipo   text,
  config jsonb not null default '{}'::jsonb,   -- { meta, premio, acciones, promo }
  creado timestamptz not null default now()
);

-- Clientes (la identidad detrás de cada pase). Un cliente pertenece a un negocio.
create table if not exists clientes (
  serial    text primary key,          -- nuestro id (va en el QR: /w/<serial>)
  negocio   text,                       -- slug del negocio
  ww_serial text,                       -- serial de WalletWallet (para el push)
  sellos    int  not null default 0,
  premios   int  not null default 0,
  creado    timestamptz not null default now()
);
-- Por si la tabla clientes ya existía de antes (añade columnas nuevas):
alter table clientes add column if not exists negocio text;
alter table clientes add column if not exists ww_serial text;

-- Historial de acciones.
create table if not exists eventos (
  id      bigint generated always as identity primary key,
  serial  text not null,
  tipo    text not null,
  mensaje text not null,
  ts      timestamptz not null default now()
);
create index if not exists eventos_serial_ts on eventos (serial, ts desc);
