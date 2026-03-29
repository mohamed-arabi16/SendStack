import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "../i18n";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export const metadata: Metadata = {
  title: "SendStack — Bulk Messaging Platform",
  description:
    "Upload a CSV, personalize with template variables, and send bulk emails and WhatsApp messages. Supports Arabic & English, iCloud+, Gmail, and custom domains.",
  keywords: ["sendstack", "bulk email", "whatsapp", "csv", "smtp", "messaging platform"],
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr">
      <body>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
