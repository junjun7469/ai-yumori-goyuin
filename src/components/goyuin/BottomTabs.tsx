"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PixelIconName } from "@/lib/pixelArt";
import { PixelArt } from "./PixelArt";

const icon = (d: React.ReactNode) => (
  <svg className="only-washi" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);

const TABS = [
  {
    href: "/goyuin", label: "図鑑", pixel: "book" as PixelIconName,
    active: (p: string) => p === "/goyuin" || p === "/goyuin/zukan" || (/^\/goyuin\/\d{2}$/.test(p)),
    icon: icon(<><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h11" /><path d="M10 8h5" /></>),
  },
  {
    href: "/goyuin/qr", label: "QR", pixel: "qr" as PixelIconName,
    active: (p: string) => p.startsWith("/goyuin/qr") || p.startsWith("/visit/"),
    icon: icon(<><rect x="4" y="4" width="6" height="6" /><rect x="14" y="4" width="6" height="6" /><rect x="4" y="14" width="6" height="6" /><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" /></>),
  },
  {
    href: "/goyuin/today", label: "今日の湯", pixel: "bowl" as PixelIconName,
    active: (p: string) => p.startsWith("/goyuin/today"),
    icon: icon(<><path d="M8 3c-1.5 2 1.5 3 0 5M12 3c-1.5 2 1.5 3 0 5M16 3c-1.5 2 1.5 3 0 5" /><path d="M4 12h16l-1.5 6a3 3 0 0 1-3 2.5H8.5a3 3 0 0 1-3-2.5z" /></>),
  },
  {
    href: "/goyuin/me", label: "わたし", pixel: "person" as PixelIconName,
    active: (p: string) => p.startsWith("/goyuin/me"),
    icon: icon(<><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-4 3.5-6 7-6s6.2 2 7 6" /></>),
  },
];

/** 下タブ4つ（図鑑／QR／今日の湯／わたし） */
export function BottomTabs() {
  const path = usePathname() ?? "";
  return (
    <nav aria-label="御湯印図鑑のメニュー" className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-white">
      <ul className="mx-auto flex max-w-[480px]">
        {TABS.map((t) => {
          const on = t.active(path);
          return (
            <li key={t.href} className="flex-1">
              <Link href={t.href} aria-current={on ? "page" : undefined}
                className="flex flex-col items-center gap-0.5 pb-2 pt-2.5 text-[11px] no-underline"
                style={{ color: on ? "var(--vermilion)" : "rgba(74, 58, 44, 0.55)", fontWeight: on ? 700 : 500 }}>
                {t.icon}
                <PixelArt name={t.pixel} size={26} className="only-retro" />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
