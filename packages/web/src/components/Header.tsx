"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/lib/wallet-context";
import { shortAddress } from "@/lib/format";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/savings", label: "Save" },
  { href: "/draw", label: "Draw" },
  { href: "/history", label: "History" },
  { href: "/admin", label: "Admin" },
];

export function Header() {
  const path = usePathname();
  const { session, connect, connecting, disconnect, web3AuthReady } = useWallet();
  const navItems = session
    ? NAV
    : NAV.filter((item) => item.href !== "/history");

  return (
    <header className="sticky top-0 z-30 border-b border-white/40 bg-white/30 backdrop-blur-2xl">
      <div className="flex items-center justify-between px-5 h-16">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/icon-192.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-xl shadow-lg shadow-black/10"
            priority
          />
          <span className="font-display font-semibold tracking-tight text-lg">SorteCerta</span>
        </Link>

        {session ? (
          <button
            onClick={() => void disconnect()}
            className="flex items-center gap-2 rounded-full bg-white/35 border border-white/60 px-3 py-1.5 hover:bg-white/55 transition-colors backdrop-blur-xl"
            title={session.address}
          >
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-medium">
              {shortAddress(session.address)}
            </span>
          </button>
        ) : (
          <button
            onClick={() => void connect()}
            disabled={connecting || !web3AuthReady}
            className="btn-primary !py-2 !px-4 !text-sm"
          >
            {connecting ? "Signing in..." : "Sign in"}
          </button>
        )}
      </div>

      <nav className="flex gap-1 px-3 pb-3 overflow-x-auto">
        {navItems.map((item) => {
          const active = path === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
                "font-display",
                active
                  ? "bg-brand text-white shadow-lg shadow-black/10"
                  : "text-muted hover:text-text hover:bg-white/30"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
