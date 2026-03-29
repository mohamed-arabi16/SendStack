import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "../i18n";
import JsonLd from "../components/JsonLd";

const SITE_URL = "https://sender.qobouli.com";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "SendStack — Bulk Email & WhatsApp Messaging Platform | أداة إرسال جماعي",
    template: "%s | SendStack",
  },
  description:
    "Send personalized bulk emails and WhatsApp messages from CSV. Supports Gmail, iCloud+, custom SMTP, spin syntax, anti-ban delays. Free, open-source, fully offline. أرسل رسائل بريد إلكتروني وواتساب جماعية مخصصة.",
  keywords: [
    "sendstack", "bulk email", "bulk whatsapp", "csv email sender", "whatsapp bulk sender",
    "smtp sender", "email marketing tool", "whatsapp marketing",
    "mass email", "personalized messaging", "spin syntax", "anti-ban whatsapp",
    "إرسال بريد جماعي", "واتساب جماعي", "أداة إرسال رسائل",
    "toplu e-posta", "toplu whatsapp mesaj", "e-posta pazarlama",
    "qobouli", "open source email sender",
  ],
  authors: [{ name: "Qobouli AI & Dev", url: "https://qobouli.com" }],
  creator: "Qobouli AI & Dev",
  publisher: "Qobouli AI & Dev",
  robots: { index: true, follow: true },
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
    languages: {
      "en": "/",
      "ar": "/",
      "tr": "/",
      "x-default": "/",
    },
  },
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "SendStack by Qobouli",
    title: "SendStack — Bulk Email & WhatsApp Messaging Platform",
    description: "Send personalized bulk emails and WhatsApp messages from CSV. Free, open-source, fully offline. Supports Gmail, iCloud+, custom SMTP, spin syntax & anti-ban delays.",
    images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630, alt: "SendStack — Bulk Messaging Platform" }],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "SendStack — Bulk Email & WhatsApp Messaging | أداة إرسال جماعي",
    description: "Send personalized bulk emails and WhatsApp messages from CSV. Free, open-source, fully offline.",
    images: [`${SITE_URL}/opengraph-image`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <JsonLd />
      </head>
      <body>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
