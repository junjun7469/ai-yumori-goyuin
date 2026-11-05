import type { Metadata } from "next";
import { BottomTabs } from "@/components/goyuin/BottomTabs";
import { TabScope } from "@/components/goyuin/TabScope";
import { YuMark } from "@/components/goyuin/YuMark";

export const metadata: Metadata = {
  title: "御湯印図鑑 | AI湯守 × 御湯印",
  description: "温泉地でQRを読んで、御湯印を集める図鑑。",
};

/** 御湯印図鑑（B2C）の共通の枠：御朱印帳のような和風の見た目。スマホ幅を優先し、下タブ4つで移る */
export default function GoyuinLayout({ children }: { children: React.ReactNode }) {
  return (
    <TabScope tabs={<BottomTabs />}>
      {/* 書体 Zen Maru Gothic は、閲覧するブラウザが Google Fonts から必要な文字だけ取得する（建て込み時の取得は遅く不安定だったため）。取れないときは丸ゴシック系の代替書体になる */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700;900&display=swap" precedence="default" />
      {/* 御湯印の絵（自動生成）の筆文字 Yuji Syuku */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Yuji+Syuku&display=swap" precedence="default" />
      {/* 起動演出のドット書体 DotGothic16（同じく閲覧するブラウザが取得） */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DotGothic16&display=swap" precedence="default" />
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
    </TabScope>
  );
}
