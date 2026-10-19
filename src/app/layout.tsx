import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plantas de Camila",
  description: "Control de ventas — Puente Alto",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Plantas de Camila",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Sin maximum-scale: hay que poder hacer zoom. El zoom involuntario al
  // enfocar inputs se evita con `font-size: 16px`, no bloqueando el gesto.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
