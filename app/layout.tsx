import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Surface · Agent-native UI compiler",
  description:
    "A proof of concept for compiling human intent into beautiful, agent-readable interfaces with executable contracts.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
