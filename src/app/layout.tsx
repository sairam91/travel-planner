import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Travel Companion",
  description: "Your AI-powered travel planning companion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
