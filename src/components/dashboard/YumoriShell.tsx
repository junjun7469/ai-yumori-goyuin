import Link from "next/link";

/**
 * ダッシュボードの画面の共通の枠：御湯印図鑑の「和」テーマ（.yumori-theme）と書体 Zen Maru Gothic の読み込み。
 * back を付けると「← ダッシュボード」のリンクを出す。
 */
/** 「見る」の3画面（トップのカードと同じ順・同じ名前） */
export const VIEW_LINKS = [
  { href: "/dashboard/trend", title: "湯の状態" },
  { href: "/dashboard/visits", title: "ご来訪と売上" },
  { href: "/dashboard/voices", title: "お客様の声" },
] as const;

export function YumoriShell({ children, back = false, wide = false, current }: {
  children: React.ReactNode; back?: boolean; wide?: boolean; current?: (typeof VIEW_LINKS)[number]["href"];
}) {
  return (
    <div className="yumori-theme">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700;900&display=swap" precedence="default" />
      <main className={`mx-auto space-y-5 px-4 pb-16 pt-6 ${wide ? "max-w-5xl" : "max-w-2xl pt-8"}`}>
        {(back || current) && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {back ? <Link href="/dashboard" className="text-sm underline">← ダッシュボード</Link> : <span />}
            {/* 「見る」の3画面を行き来するボタン（右上）。いまの画面は塗りつぶし */}
            {current && (
              <nav aria-label="見る" className="flex overflow-hidden rounded-full border border-[var(--line)] bg-[var(--paper-card)] text-sm">
                {VIEW_LINKS.map((v) => v.href === current ? (
                  <span key={v.href} aria-current="page" className="bg-[var(--ink)] px-4 py-1.5 font-bold text-white">{v.title}</span>
                ) : (
                  <Link key={v.href} href={v.href} className="px-4 py-1.5 no-underline hover:bg-[var(--paper)]" style={{ color: "var(--ink)" }}>{v.title}</Link>
                ))}
              </nav>
            )}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

/** 画面の見出し（ご来訪と売上と同じ大きさ・字間） */
export function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="text-2xl font-black tracking-[0.12em]">{children}</h1>;
}
