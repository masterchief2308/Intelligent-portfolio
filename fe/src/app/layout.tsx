import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import BlueprintCanvas from "@/components/BlueprintCanvas";
import QueryProvider from "@/providers/QueryProvider";
import ChatWidget from "@/components/ChatWidget";
import SiteNav from "@/components/SiteNav";
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from "@/lib/getQueryClient";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aditya's Portfolio",
  description: "AI & Distributed Systems Architecture Portfolio",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const queryClient = getQueryClient();
  
  // Cache portfolio for 1h — `no-store` was waking Cloud Run on every SSR (main cost driver).
  await queryClient.prefetchQuery({
    queryKey: ['portfolio', undefined],
    queryFn: async () => {
      const url = (process.env.NEXT_PUBLIC_API_URL || 'https://intelligent-portfolio-backend-7ubimlsttq-el.a.run.app') + '/api/portfolio';
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (!res.ok) throw new Error('Failed to fetch portfolio');
      return res.json();
    }
  });

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} relative min-h-screen-safe bg-background text-foreground antialiased selection:bg-foreground selection:text-background`}>
        <BlueprintCanvas />
        
        <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_-20%,_rgba(255,160,50,0.15),_transparent_80%)] z-[-1]" />
        
        <QueryProvider>
          <HydrationBoundary state={dehydrate(queryClient)}>
            <SiteNav />

            <div className="pt-safe pb-safe">
              {children}
            </div>
            
            <ChatWidget />
          </HydrationBoundary>
        </QueryProvider>

        <footer className="fixed bottom-safe left-4 sm:left-auto sm:right-12 md:right-24 z-30 pointer-events-auto">
          <Link href="/admin" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-amber-500 transition-colors bg-[#050505]/90 px-2 py-1 border border-foreground/10 backdrop-blur-sm">
            [ ADMIN_CONSOLE ]
          </Link>
        </footer>
      </body>
    </html>
  );
}
