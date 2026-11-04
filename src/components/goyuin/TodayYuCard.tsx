import type { TodayYu } from "@/lib/goyuinData";
import { YuMark } from "./YuMark";

const fmt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
});

const num = (v: number | null) => (v === null ? "—" : String(v));

/**
 * 丸正旅館の「今日の湯」。温度・湯量は大きな数字、一言は吹き出し風。
 * 最終更新時刻と、模擬データ／湯守の入力のラベル、出典は必ず付ける
 */
export function TodayYuCard({ yu, title = "今日の湯" }: { yu: TodayYu; title?: string }) {
  return (
    <section className="space-y-4 rounded-2xl border border-[var(--line)] bg-white p-4 shadow-[0_2px_12px_rgba(74,58,44,0.08)]" aria-label={title}>
      <div className="flex flex-wrap items-center gap-2">
        <YuMark size={26} />
        <h3 className="text-base font-bold">{title}</h3>
        <span className="text-xs text-[var(--ink-soft)]">{yu.facility}</span>
        <span
          className={`ml-auto rounded-full border px-2 py-0.5 text-[11px] font-bold ${
            yu.isSimulated ? "border-amber-300 bg-amber-100 text-amber-900" : "border-emerald-300 bg-emerald-50 text-emerald-900"
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
          <div key={label} className="rounded-xl bg-[var(--paper)] px-1 pb-2.5 pt-2">
            <dt className="text-[10px] text-[var(--ink-soft)]">{label}</dt>
            <dd className="mt-0.5 whitespace-nowrap leading-none">
              <span className="text-[30px] font-black tabular-nums text-[var(--vermilion)]">{value}</span>
              {value !== "—" && <span className="ml-0.5 text-[11px] font-bold text-[var(--ink-soft)]">{unit}</span>}
            </dd>
          </div>
        ))}
      </dl>

      {yu.phrase && (
        <div className="relative rounded-2xl bg-[#f3e9d7] px-4 py-3">
          <span className="absolute -top-1.5 left-8 h-3 w-3 rotate-45 rounded-[2px] bg-[#f3e9d7]" aria-hidden />
          <p className="text-sm leading-relaxed">「{yu.phrase}」</p>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-[var(--ink-soft)]">
        最終更新 {fmt.format(new Date(yu.updatedAt))}　出典：{yu.facility}の湯日誌
        {yu.isSimulated && "（分析書を基準に生成した模擬データで、実測値ではありません）"}
        。参考表示です。最新の状況は施設にご確認ください。
      </p>
    </section>
  );
}
