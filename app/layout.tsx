import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://calc-1-2-3-4-engineering.vercel.app"),
  title: "Cálculo em Foco — Engenharia UERJ",
  description: "Pré-cálculo e Cálculo I–IV com diagnóstico, exemplos resolvidos e prática deliberada para engenharia.",
  openGraph: {
    title: "Cálculo em Foco — Engenharia UERJ",
    description: "Pré-cálculo e Cálculo I–IV com diagnóstico, exemplos resolvidos e prática deliberada.",
    type: "website",
    locale: "pt_BR",
    images: [{ url: "/og.png", width: 1738, height: 905, alt: "Cálculo em Foco — Pré-cálculo e Cálculo I–IV para Engenharia" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cálculo em Foco",
    description: "Pré-cálculo e Cálculo I–IV para Engenharia.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
