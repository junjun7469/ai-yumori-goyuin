// 湯日誌 MCP サーバー（stdio）。Claude Code が .mcp.json 経由で起動し、同じ SQLite を「読み取り専用」で参照する。
// stdout は MCP の通信に使うため、ログは必ず stderr に出す
import Database from "better-sqlite3";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { findDays, getBaseline, getLatestLog, getMaintenance, getYumoriRules, queryLogs, METRICS, OPS } from "./queries";

const ROOT = path.resolve(__dirname, "../..") // tsx が CommonJS として動かすので __dirname を使う;
const DB_FILE = path.resolve(ROOT, process.env.YUMORI_DB ?? "data/yumori.db");
const RULES_FILE = path.resolve(ROOT, "data/yumori_rules.json");

// readonly: 書き込みは SQLite 側で拒否される。fileMustExist: 空の DB を勝手に作らない
const db = new Database(DB_FILE, { readonly: true, fileMustExist: true });
db.pragma("query_only = ON");

const server = new McpServer({ name: "yumori-server", version: "0.1.0" });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD（日本時間）");

/** 結果を JSON テキストで返す。例外は isError で返し、サーバーは落とさない */
function respond(fn: () => unknown) {
  try {
    return { content: [{ type: "text" as const, text: JSON.stringify(fn(), null, 2) }] };
  } catch (e) {
    return { isError: true, content: [{ type: "text" as const, text: `エラー: ${e instanceof Error ? e.message : String(e)}` }] };
  }
}
const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

server.registerTool("get_latest_log", {
  title: "最新の湯日誌と検知結果",
  description: "丸正旅館の最新の湯日誌（浴槽温度・チャンバー温度・湯量・濁り・におい・一言）と、その検知結果（level・理由・確認事項）を返す。最新が模擬データのときは、湯守が入力した最新の記録も並べて返す。各記録に is_simulated（true＝模擬データ／false＝湯守の入力）が付く",
  inputSchema: {},
  annotations: RO,
}, async () => respond(() => getLatestLog(db)));

server.registerTool("query_logs", {
  title: "期間の湯日誌一覧",
  description: "指定した期間（日本時間の日付、両端を含む）の湯日誌の一覧と、浴槽温度・チャンバー温度・湯量の最小・最大・平均を返す。『先週の湯量の推移』などに使う。各記録に is_simulated（模擬データ／湯守の入力）と検知結果が付く。最大200件",
  inputSchema: { from: date.describe("開始日 YYYY-MM-DD"), to: date.describe("終了日 YYYY-MM-DD（この日を含む）") },
  annotations: RO,
}, async ({ from, to }) => respond(() => queryLogs(db, from, to)));

server.registerTool("find_days", {
  title: "条件に合う日を探す",
  description: "条件に合う湯日誌の日を返す。例：浴槽温度が41℃未満＝{metric:'bath_temp_c', op:'lt', value:41}／湯量が基準−8%以下＝{metric:'flow_l_per_min', op:'lte', vs_baseline_pct:-8}。基準は分析書（湯量185.7 L/分・チャンバー91.5℃）。浴槽温度は基準がないので value で指定する。各日に is_simulated が付く",
  inputSchema: {
    metric: z.enum(METRICS).describe("bath_temp_c＝浴槽温度（℃）／chamber_temp_c＝チャンバー温度（℃）／flow_l_per_min＝湯量（L/分）"),
    op: z.enum(OPS).describe("lt＝未満／lte＝以下／gt＝超／gte＝以上"),
    value: z.number().optional().describe("しきい値（℃ か L/分）。vs_baseline_pct とどちらか一方"),
    vs_baseline_pct: z.number().optional().describe("基準値に対する％。-8 なら基準の−8%（湯量とチャンバー温度のみ）"),
    from: date.optional().describe("探す期間の開始日（省略可）"),
    to: date.optional().describe("探す期間の終了日（省略可）"),
  },
  annotations: RO,
}, async (c) => respond(() => findDays(db, c)));

server.registerTool("get_baseline", {
  title: "分析書の基準値",
  description: "分析書（2014-02）の基準値（湯量・チャンバー温度に使う泉温）、泉質分類、pH、要確認の項目、分析からの経過年数を返す。基準値は源泉の値で、浴槽の値とは別。分析書は模擬ではないが、読み取りは原本未照合",
  inputSchema: {},
  annotations: RO,
}, async () => respond(() => getBaseline(db)));

server.registerTool("get_maintenance", {
  title: "メンテナンス記録と経過日数",
  description: "引湯管清掃などの設備メンテナンス記録と、今日（または as_of）までの経過日数を返す。引湯管清掃は、前回からの経過日数と、次回の目安（前回＋約90日。湯守の判断基準 R2 からの目安で、要否は管理者が判断）も返す。引湯管清掃の記録がなければ、その旨を返す（日数を推測しない）。各記録に is_simulated が付く（維持管理記録は画面から入力されたものだけなので、すべて湯守の入力）",
  inputSchema: {
    event_type: z.enum(["pipe_cleaning", "tank_cleaning", "inspection", "repair", "other"]).optional().describe("pipe_cleaning＝引湯管清掃 など。省略で全種類"),
    as_of: date.optional().describe("経過日数の基準日（省略で今日・日本時間）"),
  },
  annotations: RO,
}, async (a) => respond(() => getMaintenance(db, a)));

server.registerTool("get_yumori_rules", {
  title: "湯守の判断基準",
  description: "この施設の湯守が定めた判断基準（例：浴槽40℃を切ると引湯管に成分が付着し湯量が減る／約3か月に1度の引湯管清掃／38℃は危険信号）を返す。origin=field は湯守の実体験・判断基準、hypothetical はそこから派生させた想定で、混同しないこと",
  inputSchema: {},
  annotations: RO,
}, async () => respond(() => getYumoriRules(RULES_FILE)));

async function main() {
  await server.connect(new StdioServerTransport());
  console.error(`[yumori-server] 起動しました（読み取り専用）DB: ${DB_FILE}`);
}
main().catch((e) => { console.error("[yumori-server] 起動に失敗:", e); process.exit(1); });
