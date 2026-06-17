import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import BlueprintCanvas from "@/components/BlueprintCanvas";
import QueryProvider from "@/providers/QueryProvider";
import ChatWidget from "@/components/ChatWidget";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} relative min-h-screen bg-background text-foreground antialiased selection:bg-foreground selection:text-background`}>
        <BlueprintCanvas />
        
        <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_-20%,_rgba(255,160,50,0.15),_transparent_80%)] z-[-1]" />
        
        <QueryProvider>
          <div className="fixed inset-6 pointer-events-none z-50 flex flex-col justify-between text-foreground">
            <div className="flex justify-between items-start w-full">
              <Link href="/" className="pointer-events-auto font-mono text-[10px] uppercase tracking-widest hover:opacity-50 transition-opacity">Aditya.<br/>Architect</Link>
              <Link href="/explore" className="pointer-events-auto font-mono text-[10px] uppercase tracking-widest hover:opacity-50 transition-opacity text-right">Interactive<br/>Explore [↗]</Link>
            </div>
            <div className="flex justify-between items-end w-full">
              <Link href="/journey" className="pointer-events-auto font-mono text-[10px] uppercase tracking-widest hover:opacity-50 transition-opacity">Timeline /<br/>Journey</Link>
              <div className="pointer-events-auto font-mono text-[10px] uppercase tracking-widest text-right">2026<br/>Edition</div>
            </div>
          </div>

          <div className="pt-8">
            {children}
          </div>
          
          <ChatWidget />
        </QueryProvider>

        <footer className="fixed bottom-4 right-6 sm:right-12 md:right-24 z-50">
          <Link href="/admin" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-amber-500 transition-colors bg-[#050505] px-2 py-1 border border-foreground/10">
            [ ADMIN_CONSOLE ]
          </Link>
        </footer>
      </body>
    </html>
  );
}
