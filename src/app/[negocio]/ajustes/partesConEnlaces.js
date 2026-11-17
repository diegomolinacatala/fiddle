const ENLACE = /(https?:\/\/[^\s]+)/g;

/**
 * Parte un texto en trozos de texto y de enlace, para pintar los enlaces como
 * enlaces sin meter HTML crudo.
 * @param {string} texto
 * @returns {{ texto: string, enlace: boolean }[]}
 */
export function partesConEnlaces(texto) {
  return String(texto ?? "")
    .split(ENLACE)
    .map((parte, i) => ({ texto: parte, enlace: i % 2 === 1 }))
    .filter((p) => p.texto !== "");
}
