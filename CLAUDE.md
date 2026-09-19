# CLAUDE.md

Notas para Claude Code al trabajar en este repo. Lo que hay aquí son las reglas
que no se deducen leyendo el código.

Para ponerse en marcha (instalar, arrancar, desplegar): [NEXT-STEPS.md](NEXT-STEPS.md).

## Qué es esto

Tarjetas de fidelización en Apple Wallet y Google Wallet, multi-tienda, en
Next.js 15 + Supabase, desplegado en Vercel desde `main`
(<https://fiddle-zeta.vercel.app>). Los dueños son Victor y Diego.

## Reglas de la casa

- **El código habla español.** Nombres, comentarios, textos de pantalla y
  mensajes de commit. Los comentarios explican *por qué*, no *qué*.
- **La vista previa sale de las funciones de verdad.** `PaseVista` usa
  `camposDelPase()`, `stripDelPase()` y `svgLogo()` — los mismos que arman el
  `.pkpass`. Nunca hacer una maqueta paralela: si se separan, mienten.
- **Nada de `<text>` en los SVG del pase.** En serverless no hay fuentes
  fiables; las letras se dibujan (`lib/apple/glifos.js`).
- **`npm test` y `npm run build` antes de abrir el PR.** Los dos, siempre.
- **PowerShell 5.1**: nada de `&&`. Encadenar con `;` o `if ($?) { ... }`.
  Y ejecutarlo uno mismo, no pasárselo al usuario para que lo pegue.

## Lo que hay que saber del pase de Apple

- Con imagen de banda (*strip*), **iOS junta `secondaryFields` y
  `auxiliaryFields` en UNA fila**. Por eso el pase lleva pocos campos: no caben.
- **El nombre del cliente NO va en la cara del pase.** Lo sabe él y lo ve la
  tienda; el sitio es escaso.
- Los avisos en la pantalla de bloqueo los dispara un **campo que cambia**, no
  una imagen. La banda se actualiza en silencio: por eso `changeMessage` vive en
  PREMIO, cuyo valor cambia con cada sello.
- El QR lleva el `serial`; debajo va el **código de 3 caracteres**, único dentro
  de su tienda (`lib/codigo.js`).

## El aspecto se arma con piezas

Ver la cabecera de [`src/lib/apple/dibujo.js`](src/lib/apple/dibujo.js). Un tema
no es una plantilla cerrada: es `marca` + `texto` + `forma` + `banda` + `modo`,
y se combinan libres. Un ESTILO solo es una combinación de partida con nombre.

- **Añadir una marca** = una entrada en `DIBUJOS` (SVG de un color en un lienzo
  512x512). Sale sola en el logo, el icono, los sellos, el modo relleno y el
  selector del admin. Si se usa en modo relleno, añadirla también a `CAJA`.
- **Compatibilidad**: los temas guardados solo tenían `estilo`. `piezasDeTema()`
  deduce las piezas de ahí y hay un test que fija que el SVG no cambia.

## Datos y permisos

- Las tiendas **viven en la base**, se crean y se borran desde `/admin`.
  `negocios.js` solo aporta semillas y plantillas.
- Tres roles: `caja`, `manager`, `admin`. El admin (victor/diego) entra en todo.
- El store tiene **dos backends** tras la misma API: Supabase o ficheros locales
  (`.data/`, sin variables de entorno). Todo cambio en `store.js` vale para los dos.
- **`supabase/schema.sql` primero, código después.** Si una columna nueva se
  despliega antes de existir en la base, producción devuelve 500.

## Antes de dar algo por terminado

Mirarlo. Para el dibujo, rasterizar el SVG con sharp y abrir el PNG; para las
pantallas, levantar el preview y navegar. Los tests no ven si una taza parece
una taza.
