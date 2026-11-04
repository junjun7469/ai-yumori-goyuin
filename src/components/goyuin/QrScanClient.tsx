"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/**
 * 読み取り先の候補（撮影・開発用）。本物のQRは、旅館に掲示した /visit/[code] の URL をスマホ標準カメラで読む想定。
 * このデモではカメラを使わず、選んだ温泉地の着地ページへ移るだけ。本番の機能ではない。
 */
const DEMO_TARGETS = [
  ["43", "杖立"], ["01", "登別"], ["02", "酸ヶ湯"], ["03", "花巻"], ["04", "鳴子"], ["06", "蔵王"],
] as const;

const SCAN_MS = 1500;
const SCAN_MS_REDUCED = 300;

/** 擬似スキャン：カメラ枠風の見た目（四隅のマークと上下に動く読み取りライン）を CSS で描く。実際のカメラは使わない */
export function QrScanClient() {
  const router = useRouter();
  const [code, setCode] = useState<string>("43");
  const [scanning, setScanning] = useState(false);
  const busy = useRef(false);

  function scan() {
    if (busy.current) return;
    busy.current = true;
    setScanning(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => router.push(`/visit/${code}`), reduced ? SCAN_MS_REDUCED : SCAN_MS);
  }

  return (
    <div className="space-y-5 px-5 pb-10 pt-5">
      <p className="text-center text-sm leading-relaxed text-[var(--ink-soft)] [text-wrap:balance]">
        温泉地に掲示されたQRコードを、枠に合わせて読み取ります。
      </p>

      <div className={`scan-frame mx-auto ${scanning ? "scan-frame--active" : ""}`} aria-hidden>
        <span className="scan-corner scan-corner--tl" /><span className="scan-corner scan-corner--tr" />
        <span className="scan-corner scan-corner--bl" /><span className="scan-corner scan-corner--br" />
        <span className="scan-qr-hint">QR</span>
        <span className="scan-line" />
      </div>
      <p className="text-center text-sm tracking-widest" aria-live="polite">{scanning ? "読み取っています…" : "QRコードを枠に合わせてください"}</p>

      <div className="space-y-3 text-center">
        <button onClick={scan} disabled={scanning}
          className="w-full max-w-sm rounded-full bg-[var(--vermilion)] px-6 py-4 text-lg font-bold tracking-widest text-white shadow-[0_4px_12px_rgba(181,84,58,0.35)] disabled:opacity-40">
          QRコードを読み取る
        </button>
        <p className="text-[11px] leading-relaxed text-[var(--ink-soft)]">※スマホの設定により、このデモでは読み取りを擬似的に再現しています</p>
      </div>

      {/* 撮影・開発用：どの温泉地のQRを読んだことにするか */}
      <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-[var(--line)] px-3 py-3 text-center">
        <label className="text-[11px] text-[var(--ink-soft)]">
          読み取るQR（撮影・開発用）{" "}
          <select value={code} onChange={(e) => setCode(e.target.value)} disabled={scanning}
            className="ml-1 rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs text-[var(--ink)]">
            {DEMO_TARGETS.map(([c, name]) => <option key={c} value={c}>{c} {name}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
