# Privacidad y cifrado de datos

Qué datos personales guarda fiddle, cuáles van cifrados y por qué, y lo que queda
fuera del código para trabajar con una tienda real.

## Qué datos hay

| Dato | Dónde | Cómo se guarda | Por qué así |
|---|---|---|---|
| Nombre del cliente (lo escribe él al sacar la tarjeta) | `clientes.nombre` | **Cifrado** | Identifica a una persona |
| Nota de la tienda ("sin lactosa", "el del perro") | `clientes.nota` | **Cifrado** | Texto libre: puede acabar siendo un dato de salud |
| Sellos, visitas, fechas, historial | `clientes`, `eventos` | En claro, ligado al `serial` (un uuid) | El CRM agrupa y ordena por ellos en SQL. Sin nombre no dicen de quién son |
| Tokens de avisos (Apple, web, Google) | `dispositivos`, `registros` | En claro | Hacen falta tal cual para mandar el aviso y no identifican a nadie |
| Token del pase de Apple | `clientes.auth_token` | En claro | Apple lo manda en cada consulta y hay que compararlo |
| IP de quien abusa (login, tap...) | `intentos.clave` | **Huella HMAC** con `AUTH_SECRET`, nunca la IP; se borra al día | Para contar "la misma IP" basta con la huella. Sin `AUTH_SECRET` (solo demo) la huella se podría revertir |

No se guarda email, teléfono, dirección ni nada de pagos.

## Qué protege cada capa

- **Supabase** cifra el disco y las copias de seguridad (AES-256), y la conexión
  va por TLS. RLS está activado sin políticas: la clave pública no lee nada. Solo
  el servidor, con la `service_role`, que vive en Vercel.
- **La app** cifra nombre y nota con AES-256-GCM antes de guardarlos
  ([`src/lib/cifrado.js`](../src/lib/cifrado.js)). Quien vea la base (el editor
  SQL, una exportación, una copia filtrada) ve `v1:...`. Cada valor va atado a su
  cliente y su columna: copiarlo a otra fila no sirve.
- **Lo que NO cubre:** quien tenga las variables de Vercel tiene la base y la
  clave a la vez. Por eso importa el acceso a Vercel (abajo).

Consecuencia en el código: por nombre o nota no se puede buscar en SQL, se filtra
en JS después de leer. Todo pasa por el store (`normalizarCliente`).

## Ponerlo en marcha (una vez)

1. `npm run clave-cifrado` genera `certs/cifrado.env` (ignorado por git). Nunca
   sobrescribe: si ya existe, esa es la clave.
2. Vercel → Settings → Environment Variables: `CIFRADO_CLAVE` con ese valor,
   en Production, marcada *Sensitive*.
3. Redesplegar.
4. Panel del manager, *Estado de la integración* → **Datos de clientes cifrados**.
   Si quedan datos de antes en claro, el admin ve **Cifrar ahora**. Una vez basta.
5. **Guardar una copia de la clave fuera del ordenador** (gestor de contraseñas
   compartido). Perderla es perder los nombres y notas cifrados.

Sin clave, todo funciona igual pero en claro (en local y en demo no hace falta).

## Lo que no es código

Esto es la parte técnica. Para una tienda real hace falta también (conviene que
lo revise alguien que sepa de RGPD):

- **Contrato de encargado del tratamiento** con cada tienda (art. 28 RGPD): la
  tienda es la responsable de los datos de sus clientes y fiddle los trata por
  ella.
- **Aviso de privacidad** para el cliente: HECHO en `/privacidad?b=<tienda>`. La lista
  completa de lo legal pendiente está en [NEXT-STEPS.md](../NEXT-STEPS.md).
- **Supabase y Vercel:** aceptar sus DPA y comprobar que el proyecto de Supabase
  está en una región de la UE.
- **Borrar a un cliente cuando lo pida.** Todavía no hay botón: hoy solo se borra
  una tienda entera.
- **Verificación en dos pasos** en Supabase, Vercel, GitHub y Google: son las
  llaves de todo lo anterior.
