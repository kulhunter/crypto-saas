import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CriptoBot Pro | Algoritmo de Predicción IA para Scalpers",
  description: "Análisis técnico profesional, correlación macro SP500/DXY y señales en tiempo real para Bitcoin, Ethereum, Solana y BNB. Hecho por dantagle.cl",
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
