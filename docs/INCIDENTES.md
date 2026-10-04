# Si hay una brecha de datos

Qué hacer si se filtra, se pierde o alguien ve lo que no debe (RGPD arts. 33 y 34). Es
un borrador: **quién decide** y **el contrato con cada tienda** lo cierran Victor y Diego, y
conviene que lo revise quien revise el RGPD ([RGPD.md](RGPD.md), *Papeles*).

## Las primeras horas

1. **Cortar.** Rotar lo que se haya expuesto: `SUPABASE_SERVICE_KEY`, `AUTH_SECRET` (saca a
   todo el personal), `CRON_SECRET`, la contraseña de la tienda afectada (Ajustes o `/admin`).
   `CIFRADO_CLAVE` no se rota a la ligera: sin la vieja no se leen los nombres (ver
   [PRIVACIDAD.md](PRIVACIDAD.md)).
2. **Apuntar la hora** en que se supo. Desde ahí corren las **72 h** para avisar a la AEPD.
3. **Ver el alcance** con las consultas de abajo: qué tiendas, cuántos clientes, qué datos.
4. **Decidir** (Victor y Diego): ¿hay riesgo para las personas? Si no lo hay (p. ej. solo
   seriales y sellos, o datos cifrados sin la clave), se apunta y no se notifica.

## A quién se avisa

- **A cada tienda afectada, siempre y sin demora**: ellas son las responsables y quienes
  notifican a la AEPD (nosotros somos encargados, art. 33.2). El email es el de sus *Datos
  legales* en `/admin/<tienda>` (`config.legal.email`).
- **AEPD**: lo hace la tienda en <https://sedeagpd.gob.es> en 72 h; le damos todo lo de abajo.
- **Clientes**: solo si hay riesgo alto (art. 34). Lo decide la tienda; el canal es su
  tarjeta (un mensaje en el pase con `/api/crm/campana`) y su local.

## Consultas para saber el alcance

```sql
-- Tiendas y clientes que había (nombres y notas van cifrados: v1:...)
select negocio, count(*) as clientes,
       count(*) filter (where nombre is not null) as con_nombre,
       count(*) filter (where nota is not null)   as con_nota
  from clientes where borrado_en is null group by negocio;

-- Qué hizo el personal y el admin en la ventana del incidente
select * from auditoria where ts between '2026-10-01' and '2026-10-04' order by ts;

-- Picos de contraseñas falladas (las alertas los avisan si ALERTAS_URL está puesta)
select split_part(clave, ':', 2) as tienda, count(*) / 2 as fallos
  from intentos where clave like 'login:%' group by 1 order by 2 desc;
```

## Registro de incidentes

Una fila por incidente, aunque no se notifique (art. 33.5).

| Fecha | Qué pasó | Alcance (tiendas, clientes, datos) | Qué se hizo | A quién se avisó y cuándo |
|---|---|---|---|---|
| | | | | |
