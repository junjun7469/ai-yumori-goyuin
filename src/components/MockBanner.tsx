/** CLAUDE.md 絶対ルール1：全画面に「模擬データ」ラベル。御湯印図鑑の PC 表示では、枠の内側にも同じ帯を出す */
export function MockBanner({ className = "" }: { className?: string }) {
  return (
    <div className={`mock-banner whitespace-nowrap bg-amber-100/80 px-3 py-1 text-center text-[11px] font-medium text-amber-900 ${className}`}>
      ⚠️ 丸正旅館のデータは模擬データです（実測値ではありません）
    </div>
  );
}
