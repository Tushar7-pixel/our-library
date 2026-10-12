import type { Metadata } from "next";
import { Caveat, Patrick_Hand } from "next/font/google";
import "./globals.css";

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-handwriting",
  display: "swap",
});

const patrickHand = Patrick_Hand({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-notes",
  display: "swap",
});

export const metadata: Metadata = {
  title: "E-Reader Library",
  description: "Shared personal e-reader library",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${caveat.variable} ${patrickHand.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
