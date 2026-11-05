
import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk, Open_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import { cn } from "@/lib/utils";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import { BrandingProvider } from "@/context/branding-context";

const fontJakarta = Plus_Jakarta_Sans({ 
  subsets: ["latin"], 
  variable: "--font-jakarta",
  display: "swap",
});

const fontHeadline = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-headline",
  display: "swap",
});

const fontOpenSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MarsHRM",
  description: "A Human Resource Management app with geolocation features.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "font-jakarta antialiased",
          fontJakarta.variable,
          fontHeadline.variable,
          fontOpenSans.variable
        )}
      >
        <FirebaseClientProvider>
          <BrandingProvider>
            {children}
          </BrandingProvider>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
