import type { Metadata } from "next";
import { Zen_Maru_Gothic } from "next/font/google";
import { BottomTabs } from "@/components/goyuin/BottomTabs";
import { YuMark } from "@/components/goyuin/YuMark";

// 御湯印図鑑の書体。建て込み時に取得して自前配信する（見出しは太め）
const zen = Zen_Maru_Gothic({ weight: ["400", "500", "700", "900"], subsets: ["latin"], display: "swap", preload: false, variable: "--font-zen" });

export const metadata: Metadata = {
  title: "御湯印図鑑 | AI湯守 × 御湯印",
  description: "温泉地でQRを読んで、御湯印を集める図鑑。",
};

/** 御湯印図鑑（B2C）の共通の枠：御朱印帳のような和風の見た目。スマホ幅を優先し、下タブ4つで移る */
export default function GoyuinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`goyuin-theme ${zen.variable}`}>
      <div className="mx-auto max-w-[480px] pb-24">
        <header className="px-5 pb-1 pt-6">
          <div className="flex items-center gap-3">
            <YuMark size={44} className="-rotate-6" />
            <div>
              <h1 className="text-[26px] font-black leading-tight tracking-[0.18em]">御湯印図鑑</h1>
              <p className="mt-0.5 text-xs tracking-widest text-[var(--ink-soft)]">全国の湯を巡る</p>
            </div>
          </div>
        </header>
        {children}
        <footer className="px-5 pb-6 pt-2 text-center text-[11px] leading-relaxed text-[var(--ink-soft)]">
          温泉地の泉質は代表的な分類のみを載せています。出典の確認できていないものは「要確認」と表示します。
        </footer>
      </div>
      <BottomTabs />
    </div>
  );
}
