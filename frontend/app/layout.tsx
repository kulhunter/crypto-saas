import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crypto SaaS | AI Powered Trading",
  description: "Real-time AI crypto predictions, dynamic support/resistances and automated Telegram alerts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
