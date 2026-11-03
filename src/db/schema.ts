// DATA_MODEL.md §1 に対応。将来 PostgreSQL に移せるよう、SQLite 固有機能は使わず
// 日付は text(ISO)、時刻は timestamp、JSON は text(mode: json) で持つ。
import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  tempC: real("temp_c"),
  point: text("point", { enum: ["source", "bath"] }).notNull(),
  flowLevel: text("flow_level", { enum: ["more", "normal", "less"] }).notNull(),
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
  ...timestamps,
});
