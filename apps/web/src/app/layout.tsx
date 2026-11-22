import "./globals.css";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { Footer, Header } from "@/components/Shell";
import { ServiceWorker } from "@/components/ServiceWorker";
import { Toaster } from "@/components/Toaster";
import { SHARE_CARD } from "@/lib/seo";
import { SITE } from "@/lib/site";

export const viewport: Viewport = {
  themeColor: "#0b1524",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const TITLE = "AugLeak: find the test images your model has already seen";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: TITLE, template: `%s · ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  manifest: "/manifest.webmanifest",
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SITE.name, title: TITLE, description: SITE.description, locale: "en_IN", images: [SHARE_CARD] },
  twitter: { card: "summary_large_image", title: TITLE, description: SITE.description, images: [SHARE_CARD] },
  appleWebApp: { capable: true, title: SITE.name, statusBarStyle: "black" },
  formatDetection: { telephone: false },
  icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
  robots: { index: true, follow: true },
  keywords: ["data leakage", "train test split", "data augmentation", "duplicate detection", "near-duplicate images", "dataset audit", "machine learning evaluation", "computer vision"],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: SITE.name,
        url: SITE.url,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Any (web browser)",
        description: SITE.description,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        author: { "@type": "Person", name: SITE.founder, url: SITE.founderUrl },
      },
    ],
  };
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <Toaster />
        <ServiceWorker />
      </body>
    </html>
  );
}
