import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { Inter, JetBrains_Mono, Press_Start_2P, Cinzel } from "next/font/google";
import { DeviceProvider } from "@/lib/device";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono  = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const pixel = Press_Start_2P({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });
const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-heading", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Pickleball League — Tournament & Community Platform",
    template: "%s · Pickleball League",
  },
  description:
    "Competitive pickleball leagues, tournament brackets, and community — live scoring, seasonal rankings, and a forged-in-ember aesthetic.",
  applicationName: "Pickleball League",
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
        <DeviceProvider>{children}</DeviceProvider>
      </body>
    </html>
  );
}
