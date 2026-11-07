import { PageTitle, YumoriShell } from "@/components/dashboard/YumoriShell";
import { VoiceCommentPanel } from "@/components/dashboard/VoiceCommentPanel";
import { VoicesChart } from "@/components/dashboard/VoicesChart";
import { getVoicesPage } from "@/lib/voicesDb";

export const dynamic = "force-dynamic";

/** 湯の声：御湯印で集める「湯への評価とひとこと」を、その日の浴槽温度と並べて見る（サンプル＝模擬データ） */
export default function VoicesPage() {
  const v = getVoicesPage();
  return (
    <YumoriShell back wide current="/dashboard/voices">
      <header className="space-y-1">
        <PageTitle>
          お客様の声 <span className="ml-1 align-middle rounded-full border border-[var(--line)] px-2 py-0.5 text-xs font-normal tracking-normal text-[var(--ink-soft)]">サンプル（模擬データ）</span>
        </PageTitle>
        {v && (
          <p className="text-base">直近60日　声 {v.totals.voices}件・評価平均 {v.totals.ratingAvg ?? "—"}</p>
        )}
        <p className="text-sm text-stone-600">男湯・女湯の温度は将来の運用案（浴槽ごとには未計測）</p>
      </header>

      {!v ? (
        <p className="rounded-lg border bg-white p-4 text-sm text-stone-600">施設が未登録です。npm run seed を実行してください。</p>
      ) : v.totals.voices === 0 && v.series.length === 0 ? (
        <p className="rounded-lg border bg-white p-4 text-sm text-stone-600">この期間の声がありません。npm run sim:voices → npm run seed で模擬データを入れられます。</p>
      ) : (
        <>
          <VoicesChart series={v.series} voices={v.voices} period={v.period} />
          <VoiceCommentPanel latest={v.latestComment} />
        </>
      )}
    </YumoriShell>
  );
}
