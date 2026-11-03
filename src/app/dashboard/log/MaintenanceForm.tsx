"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MAINTENANCE_LABEL } from "@/lib/maintenanceInput";

const today = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

/** 設備メンテナンス記録の最小限の入力欄（種別・日付・業者・メモ） */
export function MaintenanceForm() {
  const router = useRouter();
  const [v, setV] = useState({ eventType: "pipe_cleaning", eventDate: today(), vendor: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof v) => (val: string) => { setV((p) => ({ ...p, [k]: val })); setSaved(false); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErrors([]); setSaved(false);
    try {
      const res = await fetch("/api/maintenance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
      const data = await res.json();
      if (!res.ok) { setErrors(data.errors ?? ["保存に失敗しました"]); return; }
      setSaved(true); setV({ ...v, vendor: "", note: "" }); router.refresh();
    } catch {
      setErrors(["通信に失敗しました。もう一度お試しください"]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-sm font-bold">種別</span>
          <select value={v.eventType} onChange={(e) => set("eventType")(e.target.value)} className="w-full rounded-lg border bg-white px-3 py-3 text-base">
            {Object.entries(MAINTENANCE_LABEL).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm font-bold">日付</span>
          <input type="date" value={v.eventDate} onChange={(e) => set("eventDate")(e.target.value)} className="w-full rounded-lg border bg-white px-3 py-3 text-base" />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-bold">業者（任意）</span>
        <input value={v.vendor} onChange={(e) => set("vendor")(e.target.value)} className="w-full rounded-lg border bg-white px-3 py-3 text-base" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-bold">メモ（任意）</span>
        <input value={v.note} onChange={(e) => set("note")(e.target.value)} className="w-full rounded-lg border bg-white px-3 py-3 text-base" />
      </label>
      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {errors.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}
      {saved && <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">保存しました。</p>}
      <button disabled={busy} className="w-full rounded-xl border border-sky-700 bg-white py-3 text-base font-bold text-sky-800 disabled:opacity-50">
        {busy ? "保存中…" : "メンテナンスを記録する"}
      </button>
    </form>
  );
}
