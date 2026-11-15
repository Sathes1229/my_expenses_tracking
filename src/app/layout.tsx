import type { Metadata, Viewport } from "next";
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
  // Icons come from icon.png and apple-icon.png in this folder.
  appleWebApp: { title: "My Expenses", statusBarStyle: "default" },
};

// The phone's status bar matches the page background. It follows the device theme, not ThemeToggle.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4f0" },
    { media: "(prefers-color-scheme: dark)", color: "#161513" },
  ],
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
