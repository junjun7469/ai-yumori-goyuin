import type { TodayYu } from "@/lib/goyuinData";

const fmt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
});

const num = (v: number | null) => (v === null ? "—" : String(v));

/** 丸正旅館の「今日の湯」。最終更新時刻と、模擬データ／湯守の入力のラベルを必ず付ける */
export function TodayYuCard({ yu, title = "今日の湯" }: { yu: TodayYu; title?: string }) {
  return (
    <section className="space-y-3 rounded-sm border border-[var(--vermilion)]/40 bg-white/60 p-4" aria-label={title}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="hanko hanko-sm" aria-hidden>湯</span>
        <h3 className="text-base font-bold">{title}</h3>
        <span className="text-xs text-[var(--ink-soft)]">{yu.facility}</span>
        <span
          className={`ml-auto rounded border px-1.5 py-0.5 text-[11px] font-bold ${
            yu.isSimulated ? "border-amber-400 bg-amber-100 text-amber-900" : "border-emerald-400 bg-emerald-50 text-emerald-900"
          }`}
        >
          {yu.isSimulated ? "模擬データ" : "湯守の入力"}
        </span>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          ["チャンバー温度", num(yu.tempChamberC), "℃"],
          ["浴槽温度", num(yu.tempBathC), "℃"],
          ["湯量", num(yu.flowLPerMin), "L/分"],
        ].map(([label, value, unit]) => (
          <div key={label} className="rounded-sm border border-[#d8c9a3] bg-[var(--paper-card)] px-1 py-2">
            <dt className="text-[10px] text-[var(--ink-soft)]">{label}</dt>
            <dd className="whitespace-nowrap">
              <span className="text-base font-bold tabular-nums">{value}</span>
              {value !== "—" && <span className="ml-0.5 text-[11px] text-[var(--ink-soft)]">{unit}</span>}
            </dd>
          </div>
        ))}
      </dl>

      {yu.phrase && <p className="text-sm leading-relaxed">「{yu.phrase}」</p>}

      <p className="text-[11px] leading-relaxed text-[var(--ink-soft)]">
        最終更新 {fmt.format(new Date(yu.updatedAt))}　出典：{yu.facility}の湯日誌
        {yu.isSimulated && "（分析書を基準に生成した模擬データで、実測値ではありません）"}
        。参考表示です。最新の状況は施設にご確認ください。
      </p>
    </section>
  );
}
