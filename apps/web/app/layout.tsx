import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sweaty — AI Workout Planner",
  description:
    "AI-powered personalized workout generator. Get workouts built around your goals, equipment, and schedule. No planning, no decision fatigue — just train.",
  keywords: [
    "AI workout planner",
    "personalized workout generator",
    "AI gym app",
    "workout app",
    "AI personal trainer",
  ],
  openGraph: {
    title: "Sweaty — AI Workout Planner",
    description:
      "AI-generated workouts built around your goals, equipment, and schedule. Just open the app and train.",
    type: "website",
    url: "https://sweaty.app",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sweaty — AI Workout Planner",
    description:
      "AI-generated workouts built around your goals, equipment, and schedule.",
  },
  metadataBase: new URL("https://sweaty.app"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-text">{children}</body>
    </html>
  );
}
