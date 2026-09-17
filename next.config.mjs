const esDev = process.env.NODE_ENV !== "production";

// Cabeceras de seguridad para todas las rutas.
// - CSP: todo desde el propio dominio. 'unsafe-inline' en script-src lo exige Next
//   sin nonces (scripts de hidratación en línea); 'unsafe-eval' solo en desarrollo.
//   img-src data: para el QR generado en el navegador.
// - camera/geolocation solo para el propio sitio (escáner de caja, ubicación del manager).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${esDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const cabeceras = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Firma de pases (node-forge) e imágenes (sharp, binario nativo): se cargan tal
  // cual desde node_modules en el servidor en vez de empaquetarse.
  serverExternalPackages: ["passkit-generator", "sharp"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: cabeceras }];
  },
};

export default nextConfig;
