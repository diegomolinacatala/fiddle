-- Esquema para MODO REAL (Supabase). En modo demo se usan ficheros en .data/.
-- Ejecuta en Supabase: SQL Editor -> New query -> pega esto -> Run.

-- Config del programa (una sola fila, id='default'). Es lo que edita el manager.
create table if not exists programa (
  id       text primary key default 'default',
  titulo   text  not null default 'Café Demo',
  color    text  not null default 'dark',
  meta     int   not null default 10,
  premio   text  not null default 'Café gratis',
  acciones jsonb not null default '["sellar","canjear"]'::jsonb,
  promo    text
);
insert into programa (id) values ('default') on conflict (id) do nothing;

-- Clientes: la identidad detrás de cada pase.
create table if not exists clientes (
  serial  text primary key,          -- lo genera WalletWallet
  sellos  int  not null default 0,
  premios int  not null default 0,
  creado  timestamptz not null default now()
);

-- Historial de acciones (auditoría / actividad reciente en el perfil).
create table if not exists eventos (
  id      bigint generated always as identity primary key,
  serial  text not null references clientes(serial) on delete cascade,
  tipo    text not null,
  mensaje text not null,
  ts      timestamptz not null default now()
);
create index if not exists eventos_serial_ts on eventos (serial, ts desc);
