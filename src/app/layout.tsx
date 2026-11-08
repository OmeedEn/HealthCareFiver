import type { Metadata } from "next";
import { Archivo, Public_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { PostHogProvider } from "@/components/analytics/posthog-provider";
import "./globals.css";

// Display: Archivo, a grotesk with a variable width axis — condensed for
// loud credential-style moments, expanded for headlines.
const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  axes: ["wdth"],
  variable: "--font-archivo",
});

// Body: Public Sans — neutral, highly legible, built for public services.
const publicSans = Public_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-public-sans",
});

export const metadata: Metadata = {
  title: "Sanus — Health expertise, on demand",
  description:
    "Find and hire verified health professionals — clinical care, consulting, coaching, legal, and continuing education. For individuals, businesses, and healthcare organizations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${archivo.variable} ${publicSans.variable}`}>
      <body className="min-h-full flex flex-col font-sans">
        <PostHogProvider>
          {children}
        </PostHogProvider>
        <Toaster />
      </body>
    </html>
  );
}
