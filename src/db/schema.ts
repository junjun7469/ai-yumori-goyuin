// DATA_MODEL.md §1 に対応。将来 PostgreSQL に移せるよう、SQLite 固有機能は使わず
// 日付は text(ISO)、時刻は timestamp、JSON は text(mode: json) で持つ。
import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { VARIANTS } from "../lib/goyuinVariant";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
};

export const SPRING_CLASSES = [
  "sulfur", "chloride", "bicarbonate", "simple", "sulfate", "iron", "radon", "black", "mixed",
] as const;
export type SpringClass = (typeof SPRING_CLASSES)[number];

export const onsenArea = sqliteTable("onsen_area", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(), // "01"〜"47"
  prefecture: text("prefecture").notNull(),
  name: text("name").notNull(),
  reading: text("reading").notNull(),
  springType: text("spring_type").notNull(), // 代表泉質（分類のみ）
  springTypeClass: text("spring_type_class", { enum: SPRING_CLASSES }).notNull(),
  whyFamous: text("why_famous").notNull(),
  characterImage: text("character_image"), // null ならフォールバック SVG
  sourceUrl: text("source_url"), // null なら画面に「要確認」
  sourceStatus: text("source_status", { enum: ["verified", "unverified", "analysis_sheet"] }).notNull(),
  ...timestamps,
});

export const facility = sqliteTable("facility", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  onsenAreaId: integer("onsen_area_id").notNull().references(() => onsenArea.id),
  name: text("name").notNull(),
  hasAiYumori: integer("has_ai_yumori", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
});

export const analysisSheet = sqliteTable("analysis_sheet", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  facilityId: integer("facility_id").notNull().references(() => facility.id),
  analyzedAt: text("analyzed_at").notNull(), // YYYY-MM-DD
  lab: text("lab").notNull(),
  sourceName: text("source_name").notNull(),
  springType: text("spring_type").notNull(),
  data: text("data", { mode: "json" }).notNull().$type<Record<string, unknown>>(),
  needsVerification: text("needs_verification", { mode: "json" }).notNull().$type<string[]>(),
  ...timestamps,
});

export const dailyLog = sqliteTable("daily_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  facilityId: integer("facility_id").notNull().references(() => facility.id),
  loggedAt: integer("logged_at", { mode: "timestamp" }).notNull(),
  tempChamberC: real("temp_chamber_c"), // チャンバー温度（基準 91.5）
  tempBathC: real("temp_bath_c"), // 浴槽温度（40〜43℃前後）
  flowLPerMin: real("flow_l_per_min"), // 湯量 L/分（計測器の値。基準 185.7）
  clarity: text("clarity", { enum: ["clear", "slightly_cloudy", "cloudy"] }).notNull(),
  smell: text("smell", { enum: ["normal", "stronger", "different"] }).notNull(),
  actions: text("actions").notNull().default(""),
  note: text("note").notNull().default(""),
  weather: text("weather", { enum: ["sunny", "rain", "heavy_rain", "snow"] }),
  isSimulated: integer("is_simulated", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
});

export const detection = sqliteTable("detection", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dailyLogId: integer("daily_log_id").notNull().references(() => dailyLog.id),
  level: text("level", { enum: ["normal", "watch", "check"] }).notNull(),
  reasons: text("reasons", { mode: "json" }).notNull().$type<string[]>(),
  nextChecks: text("next_checks", { mode: "json" }).notNull().$type<string[]>(),
  explanationPro: text("explanation_pro").notNull(),
  explanationGuest: text("explanation_guest").notNull(),
  confidence: text("confidence", { enum: ["low", "medium", "high"] }),
  model: text("model").notNull(),
  ...timestamps,
});

export const handoverNote = sqliteTable("handover_note", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  facilityId: integer("facility_id").notNull().references(() => facility.id),
  periodFrom: text("period_from").notNull(),
  periodTo: text("period_to").notNull(),
  bodyMd: text("body_md").notNull(),
  model: text("model").notNull(),
  ...timestamps,
});

export const goyuin = sqliteTable("goyuin", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userKey: text("user_key").notNull(), // ログインなし。ブラウザ発行の匿名キー
  onsenAreaId: integer("onsen_area_id").notNull().references(() => onsenArea.id),
  obtainedVia: text("obtained_via", { enum: ["gacha", "visit"] }).notNull(),
  obtainedAt: integer("obtained_at", { mode: "timestamp" }).notNull(),
  snapshot: text("snapshot", { mode: "json" }).$type<Record<string, unknown> | null>(), // 丸正のみ
  variant: text("variant", { enum: VARIANTS }).notNull().default("washi"), // 御湯印の柄（G5）。既存の記録は washi
  photoCount: integer("photo_count").notNull().default(0), // 思い出の写真の枚数（0〜2）。ファイルは data/photos
  ...timestamps,
});

/** 湯の子。evolved_at が null のものが「いま育てている湯の子」（利用者ごとに1体）。なりかわり済みは行として残す */
export const yunoko = sqliteTable("yunoko", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userKey: text("user_key").notNull(),
  boundOnsenCode: text("bound_onsen_code"), // 通い始めた温泉地。最初の入浴で決まる（たまごの間は null）
  visits: integer("visits").notNull().default(0), // bound の温泉地に通った回数（0〜3）
  stage: integer("stage").notNull().default(0), // 0 たまご／1 湯の子／2 湯の精／3 なりかわり
  bornAt: integer("born_at", { mode: "timestamp" }).notNull(),
  evolvedAt: integer("evolved_at", { mode: "timestamp" }),
  evolvedOnsenCode: text("evolved_onsen_code"),
  ...timestamps,
});

export const MAINTENANCE_TYPES = ["pipe_cleaning", "tank_cleaning", "inspection", "repair", "other"] as const;

/** 設備メンテナンス記録（引湯管清掃など）。変化検知が「前回の清掃から何日か」を読む */
export const maintenanceEvent = sqliteTable("maintenance_event", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  facilityId: integer("facility_id").notNull().references(() => facility.id),
  eventType: text("event_type", { enum: MAINTENANCE_TYPES }).notNull(),
  eventDate: text("event_date").notNull(), // YYYY-MM-DD
  vendor: text("vendor").notNull().default(""), // 業者
  note: text("note").notNull().default(""),
  ...timestamps,
});
