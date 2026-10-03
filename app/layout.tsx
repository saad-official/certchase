import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const sans = IBM_Plex_Sans({
  variable: "--font-sans-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono-plex",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "CertChase — certificates of insurance, tracked and chased",
    template: "%s · CertChase",
  },
  description:
    "CertChase reads your subcontractors' certificates of insurance, checks them against the coverage each contract requires, and chases brokers for corrections and renewals before anything lapses.",
  openGraph: {
    title: "CertChase — certificates of insurance, tracked and chased",
    description:
      "Vision extraction, a deterministic rule engine, and broker follow-ups you approve. Built for small contractors and property managers.",
    type: "website",
    url: appUrl,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        {children}
        <Toaster position="bottom-right" richColors closeButton />
        <Analytics />
      </body>
    </html>
  );
}
