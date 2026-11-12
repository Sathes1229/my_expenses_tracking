import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { themeScript } from "@/components/theme-script";
import { ThemeSync } from "@/components/theme-sync";
import "./globals.css";

// Variable font: one file covers every weight used (400 to 600).
const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "My Expenses",
  description: "Household expense tracker",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The head script may set data-theme before React hydrates, so <html> can differ.
    <html lang="en" className={`${plex.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-canvas text-ink">
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
