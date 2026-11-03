// DB 初期化と投入：47温泉地マスタ、丸正旅館、分析書、（あれば）模擬計測データ
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
  logged_at: string; temp_c: number | null; point: "source" | "bath";
  flow_level: "more" | "normal" | "less"; clarity: "clear" | "slightly_cloudy" | "cloudy";
  smell: "normal" | "stronger" | "different"; actions: string; note: string;
  weather: "sunny" | "rain" | "heavy_rain" | "snow" | null; is_simulated: true;
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
  db.insert(schema.dailyLog).values(logs.map((l) => ({
    facilityId,
    loggedAt: new Date(l.logged_at),
    tempC: l.temp_c, point: l.point, flowLevel: l.flow_level, clarity: l.clarity,
    smell: l.smell, actions: l.actions, note: l.note, weather: l.weather, isSimulated: true,
  }))).run();
  return logs.length;
}

runMigrations();
const n = seedAreas();
const facilityId = seedMaruso();
const sim = seedSimLogs(facilityId);
console.log(`温泉地 ${n} 件 / 丸正旅館 / 分析書 1 件を投入しました`);
console.log(sim === null ? "模擬計測データ：未生成（npm run sim → npm run seed）" : `模擬計測データ ${sim} 件を投入しました`);
