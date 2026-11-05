import { TodayYuCard } from "@/components/goyuin/TodayYuCard";
import { SpringSummary } from "@/components/goyuin/SpringSection";
import { getAnalysisProfile } from "@/lib/springProfile";
import { listTodayYus } from "@/lib/goyuinData";

export const dynamic = "force-dynamic"; // 最新の湯日誌から

/** 今日の湯：AI湯守を導入した施設（今は丸正旅館＝杖立だけ）の今日の湯。未導入の温泉地は出さない */
export default function TodayPage() {
  const list = listTodayYus();
  return (
    <div className="space-y-5 px-5 pb-10 pt-4">
      <div>
        <h2 className="text-xl font-black tracking-widest">今日の湯</h2>
        <p className="mt-1 text-xs leading-relaxed text-[var(--ink-soft)]">
          AI湯守を導入した施設の、今日の湯の様子です。導入した施設が増えると、ここに並びます。
        </p>
      </div>
      {list.length === 0 ? (
        <p className="goshuin-card px-5 py-10 text-center text-sm">いまは、今日の湯を出している施設がありません。</p>
      ) : (
        list.map((l) => (
          <section key={l.areaCode} className="goshuin-card space-y-3 p-4">
            <p className="text-xs tracking-widest text-[var(--ink-soft)]">No.{l.areaCode}　{l.prefecture}</p>
            <h3 className="text-2xl font-black tracking-wider">{l.areaName}</h3>
            <TodayYuCard yu={l.yu} />
            {l.areaCode === "43" && <SpringSummary p={getAnalysisProfile()} href="/goyuin/43" />}
          </section>
        ))
      )}
    </div>
  );
}
