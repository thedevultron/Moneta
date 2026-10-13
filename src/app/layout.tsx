import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/inter";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/newsreader/wght-italic.css";
import "@fontsource/roboto-mono/400.css";
import "@fontsource/roboto-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://moneta-live.web.app"),
  title: { default: "Moneta", template: "%s" },
  description:
    "A minimalist daily expense tracker for students and adults, with an AI coach that finds where your money leaks. Made by Amir Bagawan.",
  applicationName: "Moneta",
  authors: [{ name: "Amir Bagawan" }],
  creator: "Amir Bagawan",
  publisher: "Moneta",
  keywords: [
    "expense tracker",
    "budget manager",
    "personal finance",
    "AI financial coach",
    "minimalist money tracker",
    "student finance tracker",
    "money quietly mastered",
    "Moneta",
    "daily expense tracker"
  ],
  category: "finance",
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Moneta", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://moneta-live.web.app",
    siteName: "Moneta",
    title: "Moneta",
    description: "Track every expense in seconds. An AI coach shows you exactly how to spend less.",
    images: [
      {
        url: "/icons/icon-512.png",
        width: 512,
        height: 512,
        alt: "Moneta",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Moneta",
    description: "Track every expense in seconds. An AI coach shows you exactly how to spend less.",
    images: ["/icons/icon-512.png"],
    creator: "@thedevultron",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#0f1011",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Moneta",
  url: "https://moneta-live.web.app",
  applicationCategory: "FinanceApplication",
  operatingSystem: "All",
  description: "A minimalist daily expense tracker for students and adults, with an AI coach that finds where your money leaks.",
  author: {
    "@type": "Person",
    name: "Amir Bagawan",
  },
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  browserRequirements: "Requires JavaScript. Requires HTML5.",
  softwareVersion: "2.1.0",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}

function SwRegister() {
  if (process.env.NODE_ENV !== "production") {
    return (
      <script
        dangerouslySetInnerHTML={{
          __html: `if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(r){r.forEach(function(reg){reg.unregister();});});if(window.caches){caches.keys().then(function(k){return Promise.all(k.map(function(n){return caches.delete(n);}));});}}`,
        }}
      />
    );
  }
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `if('serviceWorker' in navigator && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1'){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}`,
      }}
    />
  );
}
