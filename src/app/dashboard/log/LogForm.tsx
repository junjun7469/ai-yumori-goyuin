"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BASELINE_HINT, CLARITY, mentionsPipeCleaning, SMELL, WEATHER, type MaintenanceSuggestion } from "@/lib/logInput";
import { DetectionCard, type DetectionView } from "./DetectionCard";

type Values = {
  tempChamberC: string; tempBathC: string; flowLPerMin: string; clarity: string; smell: string;
  actions: string; note: string; weather: string; loggedAt: string;
};
export type Preset = { label: string; values: Partial<Values> };

const EMPTY: Values = {
  tempChamberC: "", tempBathC: "", flowLPerMin: "", clarity: "", smell: "",
  actions: "", note: "", weather: "", loggedAt: "",
};

function Choice({ name, label, options, value, onChange }: {
  name: string; label: string; options: Record<string, string>; value: string; onChange: (v: string) => void;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-bold">{label}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-2">
        {Object.entries(options).map(([k, text]) => (
          <label key={k} className={`cursor-pointer rounded-lg border px-2 py-3 text-center text-sm ${value === k ? "border-sky-600 bg-sky-50 font-bold text-sky-900" : "bg-white text-stone-700"}`}>
            <input type="radio" name={name} value={k} checked={value === k} onChange={() => onChange(k)} className="sr-only" />
            {text}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function LogForm({ presets }: { presets: Preset[] }) {
  const router = useRouter();
  const [v, setV] = useState<Values>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [detection, setDetection] = useState<DetectionView | null>(null);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<MaintenanceSuggestion | null>(null);
  const set = (k: keyof Values) => (val: string) => { setV((p) => ({ ...p, [k]: val })); setSaved(false); };

  /** 登録欄（下の「設備メンテナンスの記録」）に種別と日付を入れて、そこへ移動する */
  function fillMaintenance(date: string) {
    window.dispatchEvent(new CustomEvent("prefill-maintenance", { detail: { eventType: "pipe_cleaning", eventDate: date } }));
  }
  const jstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErrors([]); setSaved(false); setDetection(null); setDetectionError(null); setSuggestion(null);
    try {
      const res = await fetch("/api/logs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, loggedAt: v.loggedAt || undefined, weather: v.weather || null }),
      });
      const data = await res.json();
      if (!res.ok) { setErrors(data.errors ?? ["保存に失敗しました"]); return; }
      setSaved(true); setV(EMPTY); setDetection(data.detection ?? null); setDetectionError(data.detectionError ?? null); setSuggestion(data.maintenanceSuggestion ?? null); router.refresh();
    } catch {
      setErrors(["通信に失敗しました。もう一度お試しください"]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {presets.length > 0 && (
        <section className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <h2 className="text-xs font-bold text-amber-900">模擬データのプリセット（入力欄に読み込むだけ。保存は下のボタン）</h2>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button key={p.label} type="button" onClick={() => { setV({ ...EMPTY, ...p.values }); setSaved(false); setErrors([]); }}
                className="rounded-full border border-amber-400 bg-white px-3 py-1.5 text-xs text-amber-900">
                {p.label}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1.5">
          <span className="text-sm font-bold">チャンバー温度（℃）</span>
          <input inputMode="decimal" placeholder={`基準 ${BASELINE_HINT.chamberC}`} value={v.tempChamberC}
            onChange={(e) => set("tempChamberC")(e.target.value)}
            className="w-full rounded-lg border bg-white px-3 py-3 text-lg" />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-bold">浴槽温度（℃）</span>
          <input inputMode="decimal" placeholder="例 41.5" value={v.tempBathC}
            onChange={(e) => set("tempBathC")(e.target.value)}
            className="w-full rounded-lg border bg-white px-3 py-3 text-lg" />
        </label>
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm font-bold">湯量（L/分）</span>
        <input inputMode="decimal" placeholder={`基準 ${BASELINE_HINT.flowLPerMin}（計測器の値）`} value={v.flowLPerMin}
          onChange={(e) => set("flowLPerMin")(e.target.value)}
          className="w-full rounded-lg border bg-white px-3 py-3 text-lg" />
      </label>

      <Choice name="clarity" label="見た目" options={CLARITY} value={v.clarity} onChange={set("clarity")} />
      <Choice name="smell" label="匂い" options={SMELL} value={v.smell} onChange={set("smell")} />

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">天候（任意）</span>
        <select value={v.weather} onChange={(e) => set("weather")(e.target.value)} className="w-full rounded-lg border bg-white px-3 py-3 text-base">
          <option value="">選ばない</option>
          {Object.entries(WEATHER).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-bold">作業内容（任意）</span>
        <input placeholder="例 加水の調整、清掃、配管確認" value={v.actions} onChange={(e) => set("actions")(e.target.value)}
          className="w-full rounded-lg border bg-white px-3 py-3 text-base" />
        {mentionsPipeCleaning(v.actions) && (
          <span className="block rounded-lg border border-sky-300 bg-sky-50 p-2 text-xs text-sky-900">
            引湯管の清掃は「設備メンテナンスの記録」にも登録すると、AI湯守が前回からの日数を点検に使えます。
            <button type="button" onClick={() => fillMaintenance(v.loggedAt ? v.loggedAt.slice(0, 10) : jstToday())}
              className="ml-1 font-bold underline">登録欄に入れる</button>
          </span>
        )}
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-bold">一言メモ（任意）</span>
        <textarea rows={2} value={v.note} onChange={(e) => set("note")(e.target.value)}
          className="w-full rounded-lg border bg-white px-3 py-3 text-base" />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-bold">記録日時（任意・空なら今）</span>
        <input type="datetime-local" value={v.loggedAt} onChange={(e) => set("loggedAt")(e.target.value)}
          className="w-full rounded-lg border bg-white px-3 py-3 text-base" />
      </label>

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {errors.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}
      {saved && <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">保存しました。下の「直近の記録」に出ています。</p>}
      {suggestion && (
        <p role="status" className="rounded-lg border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900">
          作業欄に引湯管の清掃がありました。メンテナンス記録にも登録しますか？（{suggestion.eventDate}）
          <button type="button" onClick={() => fillMaintenance(suggestion.eventDate)} className="ml-1 font-bold underline">登録欄に入れる</button>
        </p>
      )}
      {detection && <DetectionCard d={detection} />}
      {detectionError && <p role="status" className="rounded-lg border border-stone-300 bg-stone-100 p-3 text-sm text-stone-700">{detectionError}</p>}

      <button disabled={busy} className="w-full rounded-xl bg-sky-700 py-4 text-base font-bold text-white disabled:opacity-50">
        {busy ? "保存して点検中…（数秒かかります）" : "記録する"}
      </button>
    </form>
  );
}
