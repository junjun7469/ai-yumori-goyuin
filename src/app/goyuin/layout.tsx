import type { Metadata } from "next";
import { BottomTabs } from "@/components/goyuin/BottomTabs";

export const metadata: Metadata = {
  title: "御湯印図鑑 | AI湯守 × 御湯印",
  description: "温泉地でQRを読んで、御湯印を集める図鑑。",
};

/** 御湯印図鑑（B2C）の共通の枠：御朱印帳のような和風の見た目。スマホ幅を優先し、下タブ4つで移る */
export default function GoyuinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="goyuin-theme">
      <div className="mx-auto max-w-md pb-20">
        <header className="px-4 pt-5">
          <div className="flex items-center gap-3">
            <span className="hanko" aria-hidden>湯</span>
            <div>
              <h1 className="text-xl font-bold tracking-[0.3em]">御湯印図鑑</h1>
              <p className="text-[11px] tracking-widest text-[var(--ink-soft)]">全国の湯を巡る</p>
            </div>
          </div>
        </header>
        {children}
        <footer className="px-4 pb-6 text-center text-[11px] leading-relaxed text-[var(--ink-soft)]">
          温泉地の泉質は代表的な分類のみを載せています。出典の確認できていないものは「要確認」と表示します。
        </footer>
      </div>
      <BottomTabs />
    </div>
  );
}
