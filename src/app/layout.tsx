import type { Metadata } from "next";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "AI湯守 × 御湯印",
  description: "温泉の状態を施設が守る AI湯守ダッシュボードと、御湯印ガチャ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" data-theme="retro" suppressHydrationWarning>
      <head>
        {/* 保存済みのテーマを最初の描画の前に反映する（御湯印図鑑の見た目。ダッシュボードには影響しない） */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        {/* CLAUDE.md 絶対ルール1：全画面に「模擬データ」ラベル */}
        <div className="mock-banner whitespace-nowrap bg-amber-100/80 px-3 py-1 text-center text-[11px] font-medium text-amber-900">
          ⚠️ 丸正旅館のデータは模擬データです（実測値ではありません）
        </div>
        {children}
      </body>
    </html>
  );
}
