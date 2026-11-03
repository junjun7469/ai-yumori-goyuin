"use client";

import { LEVEL_LABEL, LEVEL_STYLE } from "@/lib/levelLabels";

export type DetectionView = {
  level: "normal" | "watch" | "check";
  reasons: string[];
  nextChecks: string[];
  explanationPro: string;
  explanationGuest: string;
  confidence: "low" | "medium" | "high" | null;
  model: string;
};

const CONF_LABEL = { low: "低", medium: "中", high: "高" } as const;

export function DetectionCard({ d }: { d: DetectionView }) {
  return (
    <section className={`space-y-3 rounded-lg border p-3 text-sm ${LEVEL_STYLE[d.level]}`} aria-label="変化検知の結果">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-white/70 px-2 py-0.5 text-xs font-bold">AI湯守の点検</span>
        <span className="text-base font-bold">{LEVEL_LABEL[d.level]}</span>
        {d.confidence && <span className="text-xs">確からしさ：{CONF_LABEL[d.confidence]}</span>}
      </div>
      {d.reasons.length > 0 && (
        <div>
          <h3 className="text-xs font-bold">理由</h3>
          <ul className="list-disc space-y-0.5 pl-5">{d.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
      {d.nextChecks.length > 0 && (
        <div>
          <h3 className="text-xs font-bold">湯守なら次に見ること</h3>
          <ul className="list-disc space-y-0.5 pl-5">{d.nextChecks.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
      <p>{d.explanationPro}</p>
      <details className="text-xs">
        <summary className="cursor-pointer font-bold">宿泊者向けの言い方</summary>
        <p className="mt-1">{d.explanationGuest}</p>
      </details>
      <p className="text-[11px] opacity-80">
        AI（{d.model}）による参考情報です。湯の管理は管理者の判断が前提で、AI は判断を置き換えません。模擬データを含む基準での点検です。
      </p>
    </section>
  );
}
