import Link from "next/link";
import { notFound } from "next/navigation";
import { CharacterImage } from "@/components/goyuin/CharacterImage";
import { OwnedBadge } from "@/components/goyuin/OwnedBadge";
import { TodayYuCard } from "@/components/goyuin/TodayYuCard";
import { getArea, getTodayYu, sourceLabel } from "@/lib/goyuinData";
import { regionOf } from "@/lib/regions";

export const dynamic = "force-dynamic"; // 「今日の湯」は常に最新の湯日誌から

/** G3 御湯印の詳細。杖立（AI湯守を導入した丸正旅館）だけ「今日の湯」が動く */
export default async function DetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const area = /^\d{2}$/.test(code) ? getArea(code) : null;
  if (!area) notFound();

  const today = getTodayYu(code);
  const source = sourceLabel(area);
  const region = regionOf(area.prefecture);

  return (
    <article className="space-y-5 px-4 pb-16 pt-5">
      <p className="text-sm"><Link href="/goyuin/zukan">← 図鑑にもどる</Link></p>

      <div className="goshuin-card space-y-4 p-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-widest text-[var(--ink-soft)]">No.{area.code}　{region?.label}</p>
            <h2 className="mt-1 text-2xl font-bold tracking-wider">{area.name}</h2>
            <p className="text-xs text-[var(--ink-soft)]">{area.reading}　{area.prefecture}</p>
          </div>
          <OwnedBadge code={area.code} />
        </header>

        <CharacterImage area={area} priority sizes="(max-width: 640px) 85vw, 400px" />
        <div className="rule-gold" />

        <dl className="space-y-3 text-sm leading-relaxed">
          <div>
            <dt className="text-xs text-[var(--ink-soft)]">代表泉質</dt>
            <dd>{area.springType}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--ink-soft)]">特徴</dt>
            <dd>{area.whyFamous}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--ink-soft)]">出典</dt>
            <dd className="flex flex-wrap items-center gap-2">
              {source.href ? <a href={source.href} target="_blank" rel="noreferrer" className="break-all">{source.text}</a> : <span>{source.text}</span>}
              {!source.verified && (
                <span className="rounded border border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-900">要確認</span>
              )}
            </dd>
          </div>
        </dl>
        {!area.characterImage && (
          <p className="text-[11px] text-[var(--ink-soft)]">この温泉地の絵はまだありません。泉質の分類から作った仮の絵を表示しています。</p>
        )}
      </div>

      {today ? (
        <TodayYuCard yu={today} />
      ) : (
        <p className="text-center text-xs text-[var(--ink-soft)]">この温泉地の「今日の湯」は、AI湯守を導入した施設ができると動き出します。</p>
      )}
    </article>
  );
}
