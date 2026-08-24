import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "./providers";
import { Header } from "@/components/Header";
import "./globals.css";

const ramillas = localFont({
  variable: "--font-ramillas",
  display: "swap",
  src: [
    {
      path: "./fonts/tt-ramillas/TT Ramillas Trial Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/tt-ramillas/TT Ramillas Trial Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/tt-ramillas/TT Ramillas Trial Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/tt-ramillas/TT Ramillas Trial Italic.ttf",
      weight: "400",
      style: "italic",
    },
  ],
});

const interphasesMono = localFont({
  variable: "--font-interphases-mono",
  display: "swap",
  src: [
    {
      path: "./fonts/tt-interphases-pro-mono/TT Interphases Pro Mono Trial Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/tt-interphases-pro-mono/TT Interphases Pro Mono Trial Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/tt-interphases-pro-mono/TT Interphases Pro Mono Trial Italic.ttf",
      weight: "400",
      style: "italic",
    },
  ],
});

export const metadata: Metadata = {
  title: "SorteCerta — A poupança com sorte",
  description:
    "A sua poupança, com prémios todas as semanas. 100% do seu capital, sempre.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SorteCerta",
  },
};

export const viewport: Viewport = {
  themeColor: "#E8E3E1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className={`${ramillas.variable} ${interphasesMono.variable}`}>
      <body>
        <Providers>
          <div className="app-shell flex flex-col">
            <Header />
            <main className="flex-1 px-5 pb-24 pt-5">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
