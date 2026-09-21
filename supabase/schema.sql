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
  codigo      text,                       -- clave corta de 3 caracteres, única DENTRO del negocio
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
alter table clientes add column if not exists codigo text;
alter table clientes add column if not exists ww_serial text;
alter table clientes add column if not exists nombre text;
alter table clientes add column if not exists auth_token text;
alter table clientes add column if not exists actualizado timestamptz not null default now();

-- CRM: lo que hace falta para agrupar clientes por comportamiento sin recorrer
-- el historial entero en cada pantalla. `visitas` y `ultima_visita` son un
-- resumen de `eventos` que se mantiene al vuelo (ver store.registrarVisita).
alter table clientes add column if not exists visitas       int not null default 0;
alter table clientes add column if not exists ultima_visita timestamptz;
alter table clientes add column if not exists instalado     timestamptz;  -- primera vez que el pase entró en un Wallet
alter table clientes add column if not exists desinstalado  timestamptz;  -- y la última vez que salió de todos
alter table clientes add column if not exists origen        text;         -- "tap" | "manager" | null (los de antes)
alter table clientes add column if not exists mensaje       text;         -- aviso personal que sale EN el pase (campañas)
alter table clientes add column if not exists nota          text;         -- lo que la tienda apunta del cliente
-- Clientes antiguos sin token: se les genera uno (32 hex) para poder actualizar su pase.
update clientes set auth_token = replace(gen_random_uuid()::text, '-', '') where auth_token is null;
create index if not exists clientes_negocio on clientes (negocio);
-- Búsqueda por código corto dentro de un negocio (la caja teclea "K7M").
-- Índice NO único a propósito: la unicidad la garantiza la app al emitir
-- (mira los códigos de ese negocio); los clientes antiguos sin código lo
-- deducen de su serial al leerlos, así que no hay filas que migrar.
create index if not exists clientes_negocio_codigo on clientes (negocio, codigo);

-- Historial de acciones.
create table if not exists eventos (
  id      bigint generated always as identity primary key,
  serial  text not null,
  tipo    text not null,
  mensaje text not null,
  ts      timestamptz not null default now()
);
create index if not exists eventos_serial_ts on eventos (serial, ts desc);

-- CRM: `negocio` desnormalizado. Sin él, "toda la actividad de esta tienda"
-- obliga a leer antes sus miles de seriales para filtrar por ellos. `actor` dice
-- desde dónde se hizo (caja, manager, admin, el propio cliente o Apple).
alter table eventos add column if not exists negocio text;
alter table eventos add column if not exists actor   text;
update eventos e set negocio = c.negocio from clientes c
 where e.negocio is null and c.serial = e.serial;
create index if not exists eventos_negocio_ts on eventos (negocio, ts desc);

-- Relleno del resumen de visitas para los clientes que ya existían. Cuenta como
-- visita lo que la caja hace con el cliente delante (ver TIPOS_VISITA en crm.js).
update clientes c set
  visitas       = v.n,
  ultima_visita = v.ultima
from (
  select serial, count(*) as n, max(ts) as ultima
    from eventos where tipo in ('sellar', 'canjear', 'confirmar') group by serial
) v
where v.serial = c.serial and c.visitas = 0;

-- Instalación: la fecha del registro más antiguo de cada pase.
update clientes c set instalado = r.primera
from (select serial, min(creado) as primera from registros group by serial) r
where r.serial = c.serial and c.instalado is null;

-- ===================== CRM: CAMPAÑAS =====================
-- Un envío a un GRUPO de clientes (los que iban seguido y dejaron de venir, los
-- que están a un sello del premio...). Se guarda para poder mirar después si
-- sirvió de algo: a cuántos llegó y cuántos volvieron.
create table if not exists campanas (
  id            bigint generated always as identity primary key,
  negocio       text not null,
  grupo         text not null,              -- clave del grupo (ver lib/crm.js)
  texto         text not null,              -- lo que se ve en el pase
  destinatarios int  not null default 0,    -- clientes del grupo en ese momento
  avisados      int  not null default 0,    -- a cuántos les llegó el aviso al teléfono
  seriales      jsonb not null default '[]'::jsonb,  -- a quién, para medir quién volvió
  creado        timestamptz not null default now()
);
create index if not exists campanas_negocio_creado on campanas (negocio, creado desc);

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
alter table campanas       enable row level security;
