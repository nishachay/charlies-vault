import type { Metadata } from "next";
import Link from "next/link";
import { Disc3 } from "lucide-react";

import ThemeToggle from "@/components/ui/ThemeToggle";
import "./globals.css";

const SITE_URL = process.env.SITE_URL || "https://outtake.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "OUTTAKE — verified archive of unreleased music",
    template: "%s — OUTTAKE",
  },
  description:
    "A verified archive of unreleased music. Only current, playable YouTube originals — 288 tracks across 12 artists, every one machine-verified.",
  openGraph: {
    type: "website",
    siteName: "OUTTAKE",
    title: "OUTTAKE — verified archive of unreleased music",
    description:
      "Only current, playable YouTube originals. Every track machine-verified before it ships.",
  },
};

const themeScript = `
(function () {
  var t;
  try { t = localStorage.getItem('outtake_theme'); } catch (e) {}
  if (!t) t = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">
        <header className="glass sticky top-0 z-40 border-b border-line">
          <div className="container flex h-14 items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
              <Disc3 size={20} className="text-gold" strokeWidth={2.4} />
              <span>
                OUT<span className="text-gold">TAKE</span>
              </span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                href="/#vault"
                className="text-sm text-mut transition hover:text-fg"
              >
                The Vault
              </Link>
              <Link
                href="/#submit"
                className="text-sm text-mut transition hover:text-fg"
              >
                Found a grail?
              </Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer className="border-t border-line py-10">
          <div className="container flex flex-col items-start justify-between gap-4 text-sm text-mut md:flex-row md:items-center">
            <p>
              OUTTAKE · only playable, machine-verified originals. We never host
              audio — we link to YouTube.
            </p>
            <p className="font-mono text-xs">
              verified archive · 288 tracks · 12 artists
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}