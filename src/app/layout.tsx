import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { Inter, JetBrains_Mono, Press_Start_2P, Cinzel } from "next/font/google";
import { DeviceProvider } from "@/lib/device";
import { AuthProvider } from "@/lib/auth-context";
import { AdminModeProvider } from "@/lib/admin-context";
import { RoleViewProvider } from "@/lib/role-view-context";
import { ToastProvider } from "@/lib/toast-context";
import { Toaster } from "@/components/ui/Toaster";
import { AnalyticsLoader } from "@/components/AnalyticsLoader";
import { PwaInit } from "@/components/PwaInit";
import { AppCheckLoader } from "@/components/AppCheckLoader";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono  = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const pixel = Press_Start_2P({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });
const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-heading", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "PBL — Pickleball League",
    template: "%s · PBL",
  },
  description:
    "A mobile-first pickleball league platform — session-based play, court rotations, live standings, and admin-controlled operational flow.",
  applicationName: "PBL",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "PBL" },
};

export const viewport: Viewport = {
  themeColor: "#0b0c12",
  // Prevents iOS auto-zoom on input focus and ensures the mobile shell gets
  // the full viewport including notch/home-indicator regions.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} ${pixel.variable} ${cinzel.variable}`}>
      <body className="antialiased">
        {/* App Check must mount before any Firebase product call so the
            first request from this session carries an attestation token. */}
        <AppCheckLoader />
        <DeviceProvider>
          <AuthProvider>
            <ToastProvider>
              <AdminModeProvider>
                <RoleViewProvider>{children}</RoleViewProvider>
              </AdminModeProvider>
              <Toaster />
            </ToastProvider>
          </AuthProvider>
        </DeviceProvider>
        <AnalyticsLoader />
        <PwaInit />
      </body>
    </html>
  );
}
