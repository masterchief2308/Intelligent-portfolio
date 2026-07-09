'use client';

import Link from 'next/link';
import { useHydrateSession } from '@/hooks/useHydrateSession';

function NavLink({
  href,
  locked,
  lockedHint,
  className,
  children,
}: {
  href: string;
  locked?: boolean;
  lockedHint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (locked) {
    return (
      <Link
        href="/"
        title={lockedHint}
        className={`${className} opacity-40 hover:opacity-60`}
        aria-disabled
        onClick={(e) => {
          e.preventDefault();
          window.location.href = '/';
        }}
      >
        {children}
      </Link>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export default function SiteNav() {
  const { mounted, personalization } = useHydrateSession();

  if (!mounted) {
    return (
      <div className="fixed inset-6 pointer-events-none z-40 flex flex-col justify-between text-foreground" aria-hidden />
    );
  }

  const needsSession = !personalization;
  const linkClass =
    'pointer-events-auto font-mono text-[10px] uppercase tracking-widest hover:opacity-50 transition-opacity';

  return (
    <nav
      className="fixed inset-6 pointer-events-none z-40 flex flex-col justify-between text-foreground"
      aria-label="Site navigation"
    >
      <div className="flex justify-between items-start w-full gap-4">
        <Link href="/" className={linkClass}>
          Aditya.
          <br />
          Architect
        </Link>
        <NavLink
          href="/explore"
          locked={needsSession}
          lockedHint="Start a session on the home page first"
          className={`${linkClass} text-right`}
        >
          Interactive
          <br />
          Explore [↗]
        </NavLink>
      </div>
      <div className="flex justify-between items-end w-full gap-4">
        <NavLink
          href="/journey"
          locked={needsSession}
          lockedHint="Start a session on the home page first"
          className={linkClass}
        >
          Timeline /
          <br />
          Journey
        </NavLink>
        {/* Decorative label — must not block clicks on content below */}
        <div className="font-mono text-[10px] uppercase tracking-widest text-right text-foreground/40 select-none">
          2026
          <br />
          Edition
        </div>
      </div>
    </nav>
  );
}
