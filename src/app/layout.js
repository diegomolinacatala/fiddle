export const metadata = {
  title: "Café Demo — Fidelización",
  description: "Tarjeta de sellos en Wallet, sin fricción",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
