import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CriptoBot Pro | Predicción IA para Scalpers de Crypto",
  description:
    "Algoritmo híbrido de predicción para Bitcoin, Ethereum, Solana y BNB. Análisis técnico profesional con RSI, EMA, FVG y correlación macro SP500/DXY en tiempo real. Señales Telegram automáticas.",
  keywords: [
    "crypto",
    "bitcoin",
    "trading",
    "scalping",
    "predicción",
    "IA",
    "análisis técnico",
    "señales telegram",
  ],
  authors: [{ name: "dantagle.cl", url: "https://dantagle.cl" }],
  openGraph: {
    title: "CriptoBot Pro | Predicción IA para Scalpers",
    description:
      "Señales de trading crypto en tiempo real con algoritmo híbrido IA. BTC gratis, ETH/SOL/BNB con plan Pro.",
    url: "https://criptobot.cl",
    siteName: "CriptoBot Pro",
    type: "website",
    locale: "es_CL",
  },
  twitter: {
    card: "summary_large_image",
    title: "CriptoBot Pro | Predicción IA para Scalpers",
    description:
      "Señales de trading crypto en tiempo real con algoritmo híbrido IA.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#060608" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
