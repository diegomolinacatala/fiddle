import PwaRegister from "@/app/pwa-register";

// App del MANAGER. También instalable, pero de uso ocasional.
export const metadata = {
  title: "Sellos · Manager",
  manifest: "/manifest.manager.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Manager" },
  icons: { apple: "/icons/manager-180.png" },
};

export const viewport = {
  themeColor: "#0b0b0c",
  width: "device-width",
  initialScale: 1,
};

export default function ManagerLayout({ children }) {
  return (
    <>
      <PwaRegister />
      {children}
    </>
  );
}
