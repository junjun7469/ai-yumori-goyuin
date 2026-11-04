import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "御湯印 | AI湯守 × 御湯印",
  description: "全国の温泉地の御湯印を集める。1日1回、無料。",
};

/** 御湯印（B2C）の共通の枠：御朱印帳のような和風の見た目。スマホ幅を優先 */
export default function GoyuinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="goyuin-theme">
      <div className="mx-auto max-w-md">
        <header className="px-4 pt-5">
          <div className="flex items-center gap-3">
            <span className="hanko" aria-hidden>湯</span>
            <div>
              <p className="text-xl font-bold tracking-[0.3em]">御湯印帳</p>
              <p className="text-[11px] tracking-widest text-[var(--ink-soft)]">全国の湯を巡る</p>
            </div>
          </div>
          <nav aria-label="御湯印" className="mt-4 flex border-y border-[#cdbd95] text-center text-sm">
            <Link href="/goyuin" className="flex-1 py-2.5 no-underline" style={{ color: "var(--ink)" }}>ひく</Link>
            <Link href="/goyuin/zukan" className="flex-1 border-l border-[#cdbd95] py-2.5 no-underline" style={{ color: "var(--ink)" }}>図鑑</Link>
          </nav>
        </header>
        {children}
        <footer className="px-4 pb-10 text-center text-[11px] leading-relaxed text-[var(--ink-soft)]">
          温泉地の泉質は代表的な分類のみを載せています。出典の確認できていないものは「要確認」と表示します。
        </footer>
      </div>
    </div>
  );
}
