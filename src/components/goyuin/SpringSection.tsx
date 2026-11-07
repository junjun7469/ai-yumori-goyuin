import Link from "next/link";
import { Fragment } from "react";
import type { AnalysisProfile, Component, SpringProfile } from "@/lib/springAnalysis";

const mgFmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
export const ANALYSIS_NOTE = "成分の数値は温泉分析書（法定分析）に基づくもので、AI湯守の計測値とは別です。";
const VERIFY_NOTE = "分析書の読み取りは原本未照合です。pH など一部に要確認の項目があります（pH の読み取り値は、指針の区分では「酸性」（pH 3 未満）にあたる値です。原本で確認します。再分析の時期も施設に確認を）。";

function VerifyBadge() {
  return <span className="ml-1.5 rounded border border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">要確認</span>;
}

function Rows({ title, items }: { title: string; items: Component[] }) {
  return (
    <>
      <tr><th colSpan={2} scope="colgroup" className="pb-1 pt-3 text-left text-[11px] font-bold text-[var(--ink-soft)]">{title}</th></tr>
      {items.map((c) => (
        <tr key={c.label} className="border-t border-[var(--line)]">
          <td className="py-1.5">{c.label}</td>
          <td className="py-1.5 text-right font-bold tabular-nums">{mgFmt(c.mg)}</td>
        </tr>
      ))}
    </>
  );
}

/** /goyuin/[code]（所持分）の「この湯の成分」。効能・適応症・禁忌症は出さない */
export function SpringSection({ profile }: { profile: SpringProfile }) {
  return (
    <section aria-label="この湯の成分" className="goshuin-card space-y-3 p-5">
      <h3 className="text-sm font-bold">この湯の成分</h3>

      {profile.kind === "analysis" ? <AnalysisTable p={profile} /> : (
        <div className="space-y-2">
          <div className="rounded-xl bg-[var(--paper)] px-4 py-3">
            <p className="text-[11px] text-[var(--ink-soft)]">泉質</p>
            <p className="mt-0.5 text-[15px] font-bold leading-snug">{profile.classes}</p>
          </div>
          {profile.feature && <p className="text-sm leading-relaxed">{profile.feature}</p>}
        </div>
      )}

      <p className="text-[11px] text-[var(--ink-soft)]">
        出典：{profile.source}
        {profile.kind === "summary" && <VerifyBadge />}
      </p>
      {profile.kind === "analysis" && (
        <>
          <p className="text-[11px] leading-relaxed text-[var(--ink-soft)]">{ANALYSIS_NOTE}</p>
          {profile.unverified && <p className="text-[11px] leading-relaxed text-amber-900">{VERIFY_NOTE}</p>}
        </>
      )}
    </section>
  );
}

function AnalysisTable({ p }: { p: AnalysisProfile }) {
  return (
    <div>
      <div className="rounded-xl bg-[var(--paper)] px-4 py-3">
        <p className="text-[11px] text-[var(--ink-soft)]">泉質名</p>
        <p className="mt-0.5 text-[15px] font-bold leading-snug">{p.name}</p>
      </div>
      <table className="mt-2 w-full text-sm">
        <caption className="sr-only">温泉分析書の主な数値</caption>
        <tbody>
          {p.tempC !== null && <tr className="border-t border-[var(--line)]"><td className="py-1.5">泉温</td><td className="py-1.5 text-right font-bold tabular-nums">{p.tempC} ℃</td></tr>}
          {p.ph && (
            <tr className="border-t border-[var(--line)]">
              <td className="py-1.5">pH</td>
              <td className="py-1.5 text-right font-bold tabular-nums">{p.ph.value}{p.ph.needsVerification && <VerifyBadge />}</td>
            </tr>
          )}
          {p.residueGPerKg !== null && <tr className="border-t border-[var(--line)]"><td className="py-1.5">溶存物質（蒸発残留物）</td><td className="py-1.5 text-right font-bold tabular-nums">{p.residueGPerKg} g/kg</td></tr>}
        </tbody>
      </table>
      <table className="w-full text-sm">
        <caption className="pt-3 text-left text-[11px] text-[var(--ink-soft)]">成分名と量（mg/kg、多い順）</caption>
        <tbody>
          <Rows title="陽イオン（上位3）" items={p.cations} />
          <Rows title="陰イオン（上位3）" items={p.anions} />
          {p.nonDissociated && <Rows title="非解離成分（最も多いもの）" items={[p.nonDissociated]} />}
        </tbody>
      </table>
    </div>
  );
}

/** /goyuin/today の杖立向け要約：泉質名・pH・主要成分3つ。詳細は /goyuin/43 */
export function SpringSummary({ p, href }: { p: AnalysisProfile; href: string }) {
  return (
    <section aria-label="この湯の成分（要約）" className="space-y-3 rounded-2xl border border-[var(--line)] bg-white p-4 shadow-[0_2px_12px_rgba(74,58,44,0.08)]">
      <h3 className="text-base font-bold">この湯の成分</h3>
      <p className="text-[15px] font-bold leading-snug">{p.name}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {p.ph && <><dt className="text-[var(--ink-soft)]">pH</dt><dd className="text-right font-bold tabular-nums">{p.ph.value}{p.ph.needsVerification && <VerifyBadge />}</dd></>}
        {p.topComponents.map((c) => (
          <Fragment key={c.label}><dt className="text-[var(--ink-soft)]">{c.label}</dt><dd className="text-right font-bold tabular-nums">{mgFmt(c.mg)} mg/kg</dd></Fragment>
        ))}
      </dl>
      <p className="text-[11px] text-[var(--ink-soft)]">出典：{p.source}</p>
      <p className="text-[11px] leading-relaxed text-[var(--ink-soft)]">{ANALYSIS_NOTE}</p>
      <p className="text-sm"><Link href={href}>成分をくわしく見る →</Link></p>
    </section>
  );
}
