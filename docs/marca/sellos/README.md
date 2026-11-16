# Propuestas de logo: el sello sellado

Ideas para la marca de fiddle (16-10-2026), **sin decidir y sin usar en ningún
sitio**. La idea: la casilla vacía de la cartilla (el círculo donde va el sello) y,
encima, el sello ya estampado, con su tinta imperfecta. La marca vigente sigue
siendo el violín (`src/lib/violin.js`).

Todo son trazos (sin `<text>` ni filtros) con los colores de `src/app/home/paleta.js`,
en tres fondos: `claro` (papel), `oscuro` (verde) y `espresso`.

## Ronda 1: cuatro ideas (esta carpeta)

`propuestas.png` las enseña juntas; `propuestas-pequeno.png`, a 64/32/16 px y con el nombre.

- `violin-*`: disco de tinta con el violín en hueco.
- `efe-*`: disco con la «f» en hueco. De aquí salió la ronda 2.
- `goma-*`: sello de contorno (doble aro) con el violín en tinta.
- `salido-*`: la «f» estampada medio fuera de su casilla.

La «f» no es la efe del violín ampliada (parecía un hueso): es una «f» cursiva con
los ojos redondos de los agujeros del violín en las puntas.

## Ronda 2: la «f», casi en su sitio (`f/`)

`f/propuestas-f.png` las enseña todas, con 64 y 32 px debajo.

| Fichero | Qué es |
| --- | --- |
| `f-limpio-*` | Disco liso, sin aro. Lo mínimo. |
| `f-aro-*` | Disco con un aro fino por dentro. |
| `f-goma-*` | Sello de tampón de contorno: doble aro y la f en tinta. |
| `f-matasellos-*` | Aro de puntos entre dos líneas, como un matasellos. |
| `f-ondas-*` | Borde de festón, sobre una casilla de color en vez de discontinua. |
| `f-dientes-*` | **Favorito.** Borde dentado de sello de correos: sello sobre sello. |
| `f-lacre-*` | **Favorito.** Gota de lacre aplastada sobre una casilla de aro fino. |
| `f-pocaTinta-*` | Tampón casi seco: un lado apoyó menos. |

A 32 px los cargados (matasellos, goma) se emborronan. Para el icono de la pestaña
haría falta una versión simplificada (sin casilla ni calvas).

## Volver a generarlas

Cada ronda sale de su script, con el azar fijado por semilla (siempre igual). Lo
generado va a una carpeta fuera del repo, y de ahí se copia lo que se quiera guardar.

```bash
node docs/marca/sellos/gen-ronda2.mjs ../sellos-salida
```
