import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SPLYT — Discover, Split & Experience Together",
  description:
    "Browse yachts, exotic cars, luxury stays, and curated experiences — then split the cost with your crew.",
  openGraph: {
    title: "SPLYT — Discover, Split & Experience Together",
    description: "Premium experiences, split your way.",
    url: "https://splytpayments.com",
    siteName: "SPLYT",
    images: [{ url: "https://splytpayments.com/app-icon.png" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
