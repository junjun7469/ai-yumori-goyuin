#!/usr/bin/env node
// コミット前チェック（CLAUDE.md「フック（pre-commit）」）。1つでも見つかればコミットを止める（exit 1）。
//   1. .env（秘密情報のファイル）がコミットに入っていないか
//   2. APIキーらしい文字列 sk-ant-… がコミットに入っていないか
//   3. 模擬データ（isSimulated / 今日の湯 など）を出す画面に「模擬」の表示がない箇所
// 使い方：コミット時に git が自動で実行 ／ 手動で全体を点検：node .claude/hooks/pre-commit-check.mjs --all
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { basename } from "node:path";

const ALL = process.argv.includes("--all");
const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

// 対象ファイル（コミットに入るもの＝ステージ済み。--all は git 管理下の全ファイル）
const files = (ALL ? git("ls-files") : git("diff", "--cached", "--name-only", "--diff-filter=ACM"))
  .split("\n").filter(Boolean);

const readText = (f) => {
  try {
    const buf = ALL ? readFileSync(f) : execFileSync("git", ["show", `:${f}`], { maxBuffer: 64 * 1024 * 1024 });
    return buf.includes(0) ? null : buf.toString("utf8"); // バイナリは見ない
  } catch { return null; }
};

const problems = [];
const add = (rule, file, line, msg) => problems.push({ rule, file, line, msg });

// ---- 1. .env の混入 ----------------------------------------------------------
const ENV_OK = new Set([".env.example", ".env.sample", ".env.template"]);
for (const f of files) {
  const b = basename(f);
  if ((b === ".env" || b.startsWith(".env.")) && !ENV_OK.has(b)) {
    add("env", f, 0, "秘密情報のファイル（.env）がコミットに入っています。git rm --cached で外し、.gitignore を確認してください");
  }
}

// ---- 2. sk-ant- 文字列 ---------------------------------------------------------
// 実際のキーの形（sk-ant- のあと英数字が続く）だけを見る。説明文中の「sk-ant-」という語や、x だけのダミーは通す
const KEY_RE = /sk-ant-[A-Za-z0-9_-]{10,}/g;
const isDummy = (s) => /^sk-ant-[xX*_.-]+$/.test(s) || /^sk-ant-(api\d*-)?(your|example|dummy|test|xxx)/i.test(s);
const texts = new Map();
for (const f of files) {
  const t = readText(f);
  if (t == null) continue;
  texts.set(f, t);
  t.split("\n").forEach((ln, i) => {
    for (const m of ln.matchAll(KEY_RE)) {
      if (!isDummy(m[0])) add("api-key", f, i + 1, `APIキーらしい文字列（${m[0].slice(0, 12)}…）があります。.env に移し、すでに公開した可能性があるならキーを再発行してください`);
    }
  });
}

// ---- 3. 模擬データを出す画面に「模擬」表示があるか -------------------------------------
// 画面＝src/app（api を除く）と src/components の .tsx。模擬データに由来する値を扱う画面は、
// 自分で「模擬」と書くか、「模擬」を出す部品（ファイル名で import）を使っていなければならない
const SCREEN_RE = /^src\/(app|components)\/.+\.tsx$/;
const isScreen = (f) => SCREEN_RE.test(f) && !f.startsWith("src/app/api/") && !/\.test\.tsx$/.test(f);
const SIM_RE = /isSimulated|is_simulated|getTodayYu|listTodayYus|\bTodayYu\b|trendData|getTrend|maruso_daily_sim/;
const screenFiles = (ALL ? files : git("ls-files").split("\n").filter(Boolean)).filter(isScreen);
const screenText = (f) => texts.get(f) ?? (existsSync(f) ? readFileSync(f, "utf8") : "");
const labelled = new Set(); // 「模擬」を含む画面ファイルの名前（部品）
for (const f of screenFiles) if (screenText(f).includes("模擬")) labelled.add(basename(f).replace(/\.tsx$/, ""));
for (const f of files.filter(isScreen)) {
  const t = screenText(f);
  const m = SIM_RE.exec(t);
  if (!m || t.includes("模擬")) continue;
  const usesLabelled = [...labelled].some((name) => new RegExp(`from\\s+["'][^"']*\\/${name}["']`).test(t) || new RegExp(`from\\s+["']\\./${name}["']`).test(t));
  if (usesLabelled) continue;
  const line = t.slice(0, m.index).split("\n").length;
  add("sim-label", f, line, `模擬データに由来する値（${m[0]}）を扱うのに「模擬」の表示がありません。「模擬」を出す部品（例：TodayYuCard）を使うか、画面に「模擬」と書いてください`);
}

// ---- 結果 ----------------------------------------------------------------------
if (problems.length === 0) {
  console.log(`✔ コミット前チェック：問題なし（${files.length} ファイル）`);
  process.exit(0);
}
const NAMES = { env: ".env の混入", "api-key": "APIキーの混入", "sim-label": "模擬ラベルの欠落" };
console.error(`✘ コミット前チェック：${problems.length} 件の問題があり、コミットを止めました\n`);
for (const p of problems) console.error(`  [${NAMES[p.rule]}] ${p.file}${p.line ? `:${p.line}` : ""}\n    ${p.msg}`);
console.error("\n直したあと、もう一度 git add → git commit してください（確認だけなら node .claude/hooks/pre-commit-check.mjs --all）");
process.exit(1);
