// DB 初期化と投入：47温泉地マスタ、丸正旅館、分析書、（あれば）模擬計測データ、（あれば）湯の声の模擬データ
// 何度実行しても同じ結果になる（温泉地は code で上書き、分析書・模擬日誌は入れ替え）
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "../src/db";
import { runMigrations } from "../src/db/migrate";
import { SPRING_CLASS_BY_CODE } from "../src/db/springClass";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf-8");

function mapSourceStatus(raw: string): "verified" | "unverified" | "analysis_sheet" {
  if (raw === "要確認") return "unverified";
  if (raw.startsWith("分析書あり")) return "analysis_sheet";
  throw new Error(`未知の source_status: ${raw}`);
}

function seedAreas() {
  const lines = read("data/onsen_master_47.csv").trim().split(/\r?\n/);
  const rows = lines.slice(1).map((line, i) => {
    const f = line.split(","); // このCSVはカンマを含む値がない（列数9を検証する）
    if (f.length !== 9) throw new Error(`CSV ${i + 2} 行目の列数が ${f.length}（9のはず）`);
    const [code, prefecture, name, reading, springType, whyFamous, , status, fileName] = f;
    const springClass = SPRING_CLASS_BY_CODE[code];
    if (!springClass) throw new Error(`code ${code} の泉質分類キーが未定義`);
    const imagePath = `/characters/${fileName}`;
    return {
      code, prefecture, name, reading, springType, whyFamous,
      springTypeClass: springClass,
      // 画像が置かれていれば使い、無ければ null（フォールバック SVG）
      characterImage: existsSync(path.join(ROOT, "public", imagePath)) ? imagePath : null,
      sourceUrl: null, // CSV に出典 URL 列がない。null のまま「要確認」表示にする
      sourceStatus: mapSourceStatus(status),
    };
  });
  if (rows.length !== 47) throw new Error(`温泉地が ${rows.length} 件（47のはず）`);
  for (const r of rows) {
    db.insert(schema.onsenArea).values(r).onConflictDoUpdate({ target: schema.onsenArea.code, set: r }).run();
  }
  return rows.length;
}

function seedMaruso() {
  const area = db.select().from(schema.onsenArea).where(eq(schema.onsenArea.code, "43")).get();
  if (!area) throw new Error("杖立温泉（code 43）が見つからない");

  let fac = db.select().from(schema.facility).where(eq(schema.facility.name, "丸正旅館")).get();
  if (!fac) {
    fac = db.insert(schema.facility)
      .values({ onsenAreaId: area.id, name: "丸正旅館", hasAiYumori: true })
      .returning().get();
  }

  const sheet = JSON.parse(read("data/maruso_analysis_2014.json"));
  db.delete(schema.analysisSheet).where(eq(schema.analysisSheet.facilityId, fac.id)).run();
  db.insert(schema.analysisSheet).values({
    facilityId: fac.id,
    analyzedAt: sheet.analyzed_at,
    lab: sheet.lab,
    sourceName: sheet.source_name,
    springType: sheet.spring_type,
    data: sheet,
    needsVerification: sheet.needs_verification ?? [],
  }).run();
  return fac.id;
}

type SimLog = {
  logged_at: string; temp_chamber_c: number | null; temp_bath_c: number | null;
  flow_l_per_min: number | null; clarity: "clear" | "slightly_cloudy" | "cloudy";
  smell: "normal" | "stronger" | "different"; actions: string; note: string;
  weather: "sunny" | "rain" | "heavy_rain" | "snow" | null; is_simulated: true;
};

type SavedDetection = {
  level: "normal" | "watch" | "check"; reasons: string[]; next_checks: string[];
  explanation_pro: string; explanation_guest: string; confidence: "low" | "medium" | "high"; model: string;
};

function seedSimLogs(facilityId: number) {
  const file = path.join(ROOT, "data/maruso_daily_sim.json");
  if (!existsSync(file)) return null; // npm run sim の後に、もう一度 npm run seed
  const logs: SimLog[] = JSON.parse(readFileSync(file, "utf-8")).logs;

  // 模擬データだけを入れ替える（小野さんが入力した実データ is_simulated=false は消さない）
  const oldIds = db.select({ id: schema.dailyLog.id }).from(schema.dailyLog)
    .where(and(eq(schema.dailyLog.facilityId, facilityId), eq(schema.dailyLog.isSimulated, true))).all()
    .map((r) => r.id);
  if (oldIds.length) {
    db.delete(schema.detection).where(inArray(schema.detection.dailyLogId, oldIds)).run();
    db.delete(schema.dailyLog).where(inArray(schema.dailyLog.id, oldIds)).run();
  }
  // 模擬データに対する検知結果（npm run backfill で Haiku が作り、保存したファイル）。あれば一緒に入れる
  const detFile = path.join(ROOT, "data/maruso_detections_sim.json");
  const saved: Record<string, SavedDetection> = existsSync(detFile) ? JSON.parse(readFileSync(detFile, "utf-8")).items : {};
  let detections = 0;
  for (const l of logs) {
    const row = db.insert(schema.dailyLog).values({
      facilityId,
      loggedAt: new Date(l.logged_at),
      tempChamberC: l.temp_chamber_c, tempBathC: l.temp_bath_c, flowLPerMin: l.flow_l_per_min,
      clarity: l.clarity, smell: l.smell, actions: l.actions, note: l.note, weather: l.weather, isSimulated: true,
    }).returning({ id: schema.dailyLog.id }).get();
    const d = saved[l.logged_at];
    if (d) {
      db.insert(schema.detection).values({
        dailyLogId: row.id, level: d.level, reasons: d.reasons, nextChecks: d.next_checks,
        explanationPro: d.explanation_pro, explanationGuest: d.explanation_guest, confidence: d.confidence, model: d.model,
      }).run();
      detections += 1;
    }
  }
  return { logs: logs.length, detections };
}

/** 丸正旅館の浴槽（男湯・女湯）と、性別→浴槽の対応表。何度実行しても同じ */
function seedBaths(facilityId: number) {
  const baths = [{ code: "otoko", name: "男湯" }, { code: "onna", name: "女湯" }];
  const ids: Record<string, number> = {};
  for (const b of baths) {
    const row = db.insert(schema.facilityBath).values({ facilityId, ...b })
      .onConflictDoUpdate({ target: [schema.facilityBath.facilityId, schema.facilityBath.code], set: { name: b.name } })
      .returning({ id: schema.facilityBath.id }).get();
    ids[b.code] = row.id;
  }
  const map = [{ gender: "male" as const, bath: "otoko" }, { gender: "female" as const, bath: "onna" }];
  for (const m of map) {
    db.insert(schema.bathGenderMap).values({ facilityId, gender: m.gender, bathId: ids[m.bath] })
      .onConflictDoUpdate({ target: [schema.bathGenderMap.facilityId, schema.bathGenderMap.gender], set: { bathId: ids[m.bath] } }).run();
  }
  return ids;
}

type VoicesSim = {
  bath_temps: { day: string; bath: string; temp_c: number }[];
  voices: { visited_on: string; gender: "male" | "female" | "other" | null; prefecture_code?: string | null; rating: number; comment: string }[];
};

/** 湯の声と浴槽別の温度（どちらも模擬データ）。模擬データだけを入れ替え、is_simulated=false の行は消さない */
function seedVoices(facilityId: number, bathIds: Record<string, number>) {
  const file = path.join(ROOT, "data/maruso_voices_sim.json");
  if (!existsSync(file)) return null; // npm run sim:voices の後に、もう一度 npm run seed
  const sim: VoicesSim = JSON.parse(readFileSync(file, "utf-8"));
  db.delete(schema.bathTempDaily).where(and(eq(schema.bathTempDaily.facilityId, facilityId), eq(schema.bathTempDaily.isSimulated, true))).run();
  db.delete(schema.bathVoice).where(and(eq(schema.bathVoice.facilityId, facilityId), eq(schema.bathVoice.isSimulated, true))).run();
  for (const b of sim.bath_temps) {
    const bathId = bathIds[b.bath];
    if (!bathId) throw new Error(`未知の浴槽 ${b.bath}`);
    db.insert(schema.bathTempDaily).values({ facilityId, day: b.day, bathId, tempC: b.temp_c, isSimulated: true }).run();
  }
  for (const v of sim.voices) {
    db.insert(schema.bathVoice).values({ facilityId, visitedOn: v.visited_on, gender: v.gender, prefectureCode: v.prefecture_code ?? null, rating: v.rating, comment: v.comment, isSimulated: true }).run();
  }
  return { temps: sim.bath_temps.length, voices: sim.voices.length };
}

runMigrations();
const n = seedAreas();
const facilityId = seedMaruso();
const sim = seedSimLogs(facilityId);
const voices = seedVoices(facilityId, seedBaths(facilityId));
console.log(`温泉地 ${n} 件 / 丸正旅館 / 分析書 1 件を投入しました`);
console.log(sim === null ? "模擬計測データ：未生成（npm run sim → npm run seed）" : `模擬計測データ ${sim.logs} 件を投入しました（保存済みの検知結果 ${sim.detections} 件つき）`);
console.log(voices === null ? "湯の声：未生成（npm run sim:voices → npm run seed）" : `湯の声（模擬データ）${voices.voices} 件・浴槽別の温度（模擬データ）${voices.temps} 件を投入しました（男湯・女湯と性別の対応表つき）`);
