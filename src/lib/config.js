// Valores por defecto del "programa" (la config que edita el manager).
// Se usan cuando aún no se ha guardado nada. Todo es sobreescribible.
export const DEFAULT_PROGRAMA = {
  titulo: process.env.CARD_TITLE ?? "Café Demo",
  color: process.env.CARD_COLOR ?? "dark", // dark|blue|green|red|purple|orange
  meta: Number(process.env.SELLOS_TOTAL ?? 10), // sellos para el premio
  premio: process.env.PREMIO ?? "Café gratis",
  acciones: ["sellar", "canjear"], // acciones activas para el trabajador
  promo: null, // texto de promo activa (o null)
};
