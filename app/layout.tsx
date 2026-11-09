import type { Metadata } from "next";
import Link from "next/link";
import { Cormorant_Garamond, EB_Garamond } from "next/font/google";
import { listings } from "@/lib/data";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  fallback: ["Iowan Old Style", "Palatino Linotype", "Palatino", "Georgia"],
});

const text = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-text",
  fallback: ["Iowan Old Style", "Palatino Linotype", "Palatino", "Georgia"],
});

const DESCRIPTION =
  "A register of church buildings offered for disposal in the United States, England and France, and a pledge book by which neighbours can put their support behind saving one.";

export const metadata: Metadata = {
  metadataBase: new URL("https://adoptchurches.com"),
  title: "adoptchurches · a register of church buildings offered for disposal",
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: "adoptchurches · a register of church buildings offered for disposal",
    description: DESCRIPTION,
    siteName: "adoptchurches",
    url: "/",
    type: "website",
    locale: "en_GB",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "adoptchurches — 332 church buildings offered for disposal, in the United States, England and France.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "adoptchurches · a register of church buildings offered for disposal",
    description: DESCRIPTION,
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable}`}>
      <body>
        <header className="site-header">
          <div className="masthead">
            <Link href="/" className="wordmark">
              adopt<em>churches</em>
            </Link>
            <div className="dateline">
              A register of {listings.length} buildings offered for disposal · November 2026
            </div>
            <nav className="nav">
              <Link href="/#atlas">The atlas</Link>
              <Link href="/how-it-works">How it works</Link>
              <Link href="/pledges">The pledge book</Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="shell">
            <hr className="rule-double" />
            <div className="footer-grid">
              <div>
                Listing particulars are taken from public sources and refreshed by{" "}
                <code>scripts/</code> in the repository. Prices and availability change; verify
                every particular with the agent before acting.
              </div>
              <div>
                A pledge records a name and an amount. It is not a donation, an investment, or an
                offer of securities, and no money is taken on this site.{" "}
                <Link href="/how-it-works">Read how it works</Link>.
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
