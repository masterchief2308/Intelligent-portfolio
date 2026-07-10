'use client';

import Link from 'next/link';

/** Shown when a route requires personalization session. */
export default function SessionGate({
  title = 'Session required',
  message = 'Enter your email on the home page to compile a personalized session before accessing this area.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="min-h-[50dvh] sm:min-h-[60dvh] flex items-center justify-center px-4 sm:px-12 md:px-24 pt-20 sm:pt-24 pb-safe">
      <div className="max-w-md w-full border border-foreground/20 bg-[#050505]/90 p-8 space-y-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-amber-500">[ Access gated ]</p>
        <h1 className="font-mono text-sm uppercase tracking-widest text-foreground">{title}</h1>
        <p className="font-mono text-xs text-muted-foreground leading-relaxed normal-case tracking-normal">
          {message}
        </p>
        <Link
          href="/"
          className="inline-block w-full bg-foreground text-background px-6 py-3 font-mono text-xs uppercase tracking-widest font-bold hover:bg-amber-500 transition-colors"
        >
          Go to home →
        </Link>
      </div>
    </div>
  );
}
