import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Arabic } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale, getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, isRtl } from "@/i18n/routing";
import "../globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const notoArabic = Noto_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DentalCare — Le cabinet dentaire, géré tout seul.",
  description:
    "Un bot WhatsApp IA prend les RDV (FR / EN / Darija), envoie les rappels J-1 et les recalls détartrage. 14 jours gratuits. Hébergé au Maroc.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "DentalCare",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icon-512.svg", sizes: "512x512" }],
  },
  /* Open Graph + Twitter cards — surface the marketing landing on
     WhatsApp / Facebook / LinkedIn / Twitter shares. The og-image.jpg
     is dropped manually into `/public/landing/`; Next serves the
     declared URL even if the file is missing (broken image in the
     preview), so we add a hard-coded fallback to `/icon-512.svg` at
     the SVG level. */
  openGraph: {
    title: "DentalCare — Le cabinet dentaire, géré tout seul.",
    description:
      "Un bot WhatsApp IA prend les RDV à votre place. Rappels et recalls automatiques. 14 jours gratuits.",
    url: "/",
    siteName: "DentalCare",
    images: [
      { url: "/landing/og-image.jpg", width: 1200, height: 630, alt: "DentalCare" },
    ],
    locale: "fr_MA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DentalCare — Le cabinet dentaire, géré tout seul.",
    description:
      "Un bot WhatsApp IA prend les RDV à votre place. Rappels et recalls automatiques. 14 jours gratuits.",
    images: ["/landing/og-image.jpg"],
  },
};

/**
 * Viewport + theme color — drives the address-bar tint on Android Chrome,
 * the iOS PWA status bar, and prevents the dreaded 300ms tap delay /
 * pinch-zoom on dental forms.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#06B6D4" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
  ],
  width: "device-width",
  initialScale: 1,
  // `maximumScale: 1` would break a11y zoom — leave the user free to zoom in.
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = isRtl(locale) ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      data-vertical="dental"
      className={`${inter.variable} ${notoArabic.variable} h-full antialiased`}
    >
      <body className="text-foreground flex min-h-full flex-col">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
