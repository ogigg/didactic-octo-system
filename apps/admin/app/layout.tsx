import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workout Admin",
  description: "Admin dashboard for the workout app",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
