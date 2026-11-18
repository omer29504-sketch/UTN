import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "University Talent Network — Verified talent. Real potential.",
    template: "%s · University Talent Network",
  },
  description:
    "A verified video recruitment platform where university graduates prove their degree and pitch in 60 seconds, and employers hire with confidence.",
  applicationName: "University Talent Network",
  keywords: [
    "verified recruitment",
    "university graduates",
    "video hiring",
    "graduate jobs",
    "talent network",
  ],
  openGraph: {
    title: "University Talent Network",
    description:
      "University-verified candidates. Real 60-second pitches. Zero-friction hiring for employers.",
    type: "website",
    siteName: "University Talent Network",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#06120F",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plusJakarta.variable} ${inter.variable}`}
    >
      <body className="min-h-dvh bg-surface-canvas text-ink-primary">
        {/*
          Enables motion-only styles before first paint. Without JavaScript the
          class is never added, so scroll-reveal content renders fully visible.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var d=document.documentElement;d.classList.add('js');" +
              "setTimeout(function(){if(!d.hasAttribute('data-reveal-ready'))d.classList.remove('js');},8000);})()",
          }}
        />
        <a
          href="#main"
          className="sr-only z-[100] rounded-lg bg-jewel-ink px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
