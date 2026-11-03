import { readFileSync } from "node:fs";
import { and, desc, eq, inArray, lte } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { LEVEL_LABEL, LEVEL_STYLE } from "@/lib/levelLabels";
import { CLARITY, SMELL } from "@/lib/logInput";
import { LogForm, type Preset } from "./LogForm";

export const dynamic = "force-dynamic";

type SimLog = Record<string, string | number | null>;
type SimFile = { anomalies: { type: string; from: string }[]; logs: SimLog[] };

const BASE_FLOW = 185.7;

// 模擬データのプリセット：平常の日と、異常シナリオ3種の初日（data/maruso_daily_sim.json）
function loadPresets(): Preset[] {
  let sim: SimFile;
  try {
    sim = JSON.parse(readFileSync("data/maruso_daily_sim.json", "utf-8"));
  } catch {
    return []; // npm run sim 前
  }
  const toPreset = (label: string, l: SimLog): Preset => ({
    label,
    values: {
      tempChamberC: String(l.temp_chamber_c), tempBathC: String(l.temp_bath_c),
      flowLPerMin: String(l.flow_l_per_min),
      clarity: l.clarity as string, smell: l.smell as string, actions: l.actions as string,
      note: l.note as string, weather: l.weather as string,
    },
  });
  const presets: Preset[] = [];
  const calm = [...sim.logs].reverse().find((l) =>
    Math.abs(Number(l.flow_l_per_min) - BASE_FLOW) / BASE_FLOW < 0.04 && l.clarity === "clear" && l.smell === "normal" && l.weather === "sunny");
  if (calm) presets.push(toPreset("平常の日", calm));
  const names: Record<string, string> = {
    flow_decline: "湯量が少なめ", smell_change: "匂いが違う", cloudy_streak: "濁りが残る",
  };
  for (const a of sim.anomalies) {
    const l = sim.logs.find((x) => String(x.logged_at).startsWith(a.from));
    if (l) presets.push(toPreset(names[a.type] ?? a.type, l));
  }
  return presets;
}

const fmt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
});

export default function LogPage() {
  const facility = db.select().from(schema.facility).where(eq(schema.facility.name, "丸正旅館")).get();
  const recent = facility
    ? db.select().from(schema.dailyLog).where(and(eq(schema.dailyLog.facilityId, facility.id), lte(schema.dailyLog.loggedAt, new Date())))
        .orderBy(desc(schema.dailyLog.loggedAt)).limit(8).all()
    : [];

  const levelByLog = new Map(
    recent.length
      ? db.select().from(schema.detection).where(inArray(schema.detection.dailyLogId, recent.map((l) => l.id))).all()
          .map((d) => [d.dailyLogId, d.level] as const)
      : [],
  );

  return (
    <main className="mx-auto max-w-md space-y-6 p-4 pb-16">
      <header className="space-y-1">
        <Link href="/dashboard" className="text-xs text-sky-700 underline">← ダッシュボード</Link>
        <h1 className="text-xl font-bold">湯日誌の入力</h1>
        <p className="text-sm text-stone-600">丸正旅館 ・ 1分で記録できます。わからない項目は空のままで大丈夫です。</p>
      </header>

      <LogForm presets={loadPresets()} />

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-stone-700">直近の記録</h2>
        {recent.length === 0 && <p className="text-sm text-stone-500">まだ記録がありません（npm run seed で模擬データを入れられます）</p>}
        <ul className="divide-y rounded-lg border bg-white text-sm">
          {recent.map((l) => (
            <li key={l.id} className="space-y-0.5 p-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">{fmt.format(l.loggedAt)}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${l.isSimulated ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>
                  {l.isSimulated ? "模擬データ" : "入力した記録"}
                </span>
                {levelByLog.has(l.id) && (
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${LEVEL_STYLE[levelByLog.get(l.id)!]}`}>
                    {LEVEL_LABEL[levelByLog.get(l.id)!]}
                  </span>
                )}
              </div>
              <div className="text-stone-600">
                チャンバー {l.tempChamberC ?? "—"}℃ ・ 浴槽 {l.tempBathC ?? "—"}℃ ・ 湯量 {l.flowLPerMin ?? "—"} L/分
                <br />
                {CLARITY[l.clarity]} ・ 匂い {SMELL[l.smell]}
              </div>
              {l.note && <div className="text-stone-500">{l.note}</div>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
