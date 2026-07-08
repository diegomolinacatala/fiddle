import PwaRegister from "@/app/pwa-register";

// App del TRABAJADOR (caja). Instalable en la pantalla de inicio del móvil.
export const metadata = {
  title: "Sellos · Caja",
  manifest: "/manifest.worker.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Caja" },
  icons: { apple: "/icons/worker-180.png" },
};

export const viewport = {
  themeColor: "#0b0b0c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function WorkerLayout({ children }) {
  return (
    <>
      <PwaRegister />
      {children}
    </>
  );
}
