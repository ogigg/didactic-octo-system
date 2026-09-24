import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Apple Watch Workout Concepts",
  description: "Interactive Apple Watch workout logging layout prototypes.",
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
