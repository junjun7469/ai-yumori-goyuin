import Link from "next/link";

/**
 * ダッシュボードの画面の共通の枠：御湯印図鑑の「和」テーマ（.yumori-theme）と書体 Zen Maru Gothic の読み込み。
 * back を付けると「← ダッシュボード」のリンクを出す。
 */
export function YumoriShell({ children, back = false, wide = false }: { children: React.ReactNode; back?: boolean; wide?: boolean }) {
  return (
    <div className="yumori-theme">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700;900&display=swap" precedence="default" />
      <main className={`mx-auto space-y-5 px-4 pb-16 pt-6 ${wide ? "max-w-5xl" : "max-w-2xl pt-8"}`}>
        {back && <Link href="/dashboard" className="text-sm underline">← ダッシュボード</Link>}
        {children}
      </main>
    </div>
  );
}

/** 画面の見出し（ご来訪と売上と同じ大きさ・字間） */
export function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="text-2xl font-black tracking-[0.12em]">{children}</h1>;
}
