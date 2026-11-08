import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "adoptchurches — every church for sale, on one map",
  description:
    "A map of church buildings for sale across the United States, and a way for neighbors to pledge toward buying one together.",
  openGraph: {
    title: "adoptchurches",
    description:
      "A map of church buildings for sale across the United States, and a way for neighbors to pledge toward buying one together.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="shell">
            <Link href="/" className="wordmark">
              adopt<em>churches</em>
            </Link>
            <nav className="nav">
              <Link href="/#atlas">The atlas</Link>
              <Link href="/how-it-works">How it works</Link>
              <Link href="/how-it-works#pledge">Pledge</Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="shell footer-grid">
            <div>
              Listing data from public commercial real-estate sources, refreshed by
              <code> scripts/</code>. Prices and availability change; verify with the broker.
            </div>
            <div>
              Prototype. A pledge is an expression of interest — not a donation, investment,
              or offer of securities. <Link href="/how-it-works">Read how it works</Link>.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
