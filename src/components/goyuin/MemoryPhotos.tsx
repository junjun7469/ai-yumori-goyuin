"use client";

import { useRef, useState } from "react";
import { getOrCreateUserKey } from "@/lib/userKey";

export type Memories = { goyuinId: number; photos: { slot: string; demo: boolean }[]; canAdd: boolean };
const MAX = 2;

/** 思い出の写真（1御湯印につき2枚まで）。端末の匿名キーに紐づくだけで、公開・共有はしない */
export function MemoryPhotos({ initial }: { initial: Memories | null }) {
  const [m, setM] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [rev, setRev] = useState(0); // 写真を差し替えたあとに画像を取り直すための番号
  const input = useRef<HTMLInputElement>(null);
  if (!m) return null;
  const key = getOrCreateUserKey();
  const src = (slot: string) => `/api/photos/${m.goyuinId}/${slot}?user_key=${encodeURIComponent(key ?? "")}&v=${rev}`;

  async function upload(file: File) {
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData();
      fd.set("user_key", key ?? "");
      fd.set("photo", file);
      const res = await fetch(`/api/photos/${m!.goyuinId}`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "保存できませんでした");
      setM(data); setRev((r) => r + 1);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "保存できませんでした");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(slot: string) {
    if (!confirm("この写真を消しますか？")) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/photos/${m!.goyuinId}/${slot}?user_key=${encodeURIComponent(key ?? "")}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "消せませんでした");
      setM(data); setRev((r) => r + 1); setZoom(null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "消せませんでした");
    } finally { setBusy(false); }
  }

  const zoomed = m.photos.find((p) => p.slot === zoom);
  return (
    <section aria-label="思い出の写真" className="goshuin-card space-y-3 p-5">
      <h3 className="text-sm font-bold">思い出の写真　<span className="text-xs font-normal text-[var(--ink-soft)]">{m.photos.length} / {MAX}</span></h3>

      {m.photos.length > 0 && (
        <ul className={`grid gap-2 ${m.photos.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {m.photos.map((p) => (
            <li key={p.slot}>
              <button type="button" onClick={() => setZoom(p.slot)} className="block w-full overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--track)]" aria-label="写真を拡大">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src(p.slot)} alt="思い出の写真" className={`w-full object-cover ${m.photos.length === 1 ? "aspect-[4/3]" : "aspect-square"}`} loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {m.canAdd && (
        <>
          <input ref={input} type="file" accept="image/*" className="hidden" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
          <button type="button" disabled={busy} onClick={() => input.current?.click()}
            className="w-full rounded-full border border-[var(--vermilion)] py-2.5 text-sm font-bold text-[var(--vermilion)] disabled:opacity-50">
            {busy ? "保存しています…" : "📷 思い出を残す"}
          </button>
        </>
      )}
      {!m.canAdd && <p className="text-xs text-[var(--ink-soft)]">写真は{MAX}枚までです。入れ替えるには、拡大して消してください。</p>}
      {msg && <p role="alert" className="text-xs text-red-800">{msg}</p>}
      <p className="text-[11px] leading-relaxed text-[var(--ink-soft)]">写真はこの端末の御湯印だけに結び付き、公開・共有はされません。位置情報などの撮影情報は保存時に取り除きます。</p>

      {zoomed && (
        <div role="dialog" aria-modal="true" aria-label="写真の拡大" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/80 p-4" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src(zoomed.slot)} alt="思い出の写真（拡大）" className="max-h-[75vh] max-w-full rounded-xl object-contain" />
          <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setZoom(null)} className="rounded-full bg-white px-5 py-2 text-sm font-bold">閉じる</button>
            {!zoomed.demo && <button type="button" disabled={busy} onClick={() => void remove(zoomed.slot)} className="rounded-full border border-white px-5 py-2 text-sm text-white">消す</button>}
          </div>
        </div>
      )}
    </section>
  );
}
