import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RoadSense AI — Intelligent Road Safety Routing",
  description:
    "AI-powered road safety routing for Maharashtra. Get safe, pothole-aware directions between cities.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
