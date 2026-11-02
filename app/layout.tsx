import type { Metadata } from "next";
import { Newsreader, Public_Sans } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { EquipmentProvider } from "@/components/equipment";
import catalog from "@/data/equipment.json";
import type { Equipment } from "@/lib/equipment";

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Ground Record",
    template: "%s · Ground Record",
  },
  description:
    "A sourced daily record of the Russia–Ukraine war. Claims stay attached to who made them.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${publicSans.variable} ${newsreader.variable} antialiased`}>
        <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-card focus:px-3 focus:py-2">
          Skip to content
        </a>
        <EquipmentProvider catalog={catalog as Equipment[]}>
          <div id="content">{children}</div>
        </EquipmentProvider>
      </body>
    </html>
  );
}
