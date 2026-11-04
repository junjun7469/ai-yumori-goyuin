# AI湯守 × 御湯印（Built with Claude: Japan 2026）

熊本・杖立温泉 丸正旅館を実証現場に、施設向け「AI湯守ダッシュボード」と一般向け「御湯印ガチャ」を1つの温泉データ基盤の上に作るプロジェクト。

- 要件：docs/PRD.md
- データ：docs/DATA_MODEL.md
- 決定事項：docs/decisions.md
- 日次ログ：docs/devlog.md
- Claude Code への指示：CLAUDE.md

## 注意

- 丸正旅館の日次計測値は分析書（2014年2月）を基準にした **模擬データ** です。実測値ではありません
- 47温泉地の泉質は代表的な分類のみ。数値は出典のあるものだけ表示します
- 本プロジェクトは医療効果・安全性を保証するものではありません。湯の管理は施設の管理者の判断を前提にしています

## 画面（開発サーバー起動後）

- AI湯守（施設向け）：`/dashboard/log` 湯日誌の入力と変化検知、`/dashboard/trend` 推移グラフ（直近60日・41℃/38℃の線・検知の印、クリックで理由）、`/dashboard/handover` 引き継ぎメモ（Sonnet が下書き、再生成可）
- 御湯印（一般向け・スマホ幅優先）：`/goyuin` ガチャ（1日1回・無料）、`/goyuin/zukan` 図鑑（地域で絞り込み）、`/goyuin/43` 詳細（杖立だけ丸正旅館の「今日の湯」。模擬データのラベル付き）

## 湯守の判断基準と評価セットの出典

- `data/yumori_rules.json`：この施設の湯守が定めた判断基準。`origin: field` は湯守の実体験・判断基準、`hypothetical` はそこから派生させた想定。AI湯守の点検では field を優先して引用します
- `eval/scenarios.json`：変化検知の評価セット（20件）。S11〜S15 は現場由来（field）、S16〜S20 は想定（hypothetical）、S01〜S10 は初期の想定。両者は混同せず区別して扱います

## セットアップ（初稿、実装後に更新）

```
cp .env.example .env   # APIキーを記入
npm install
npm run sim    # 模擬計測データを生成（data/maruso_daily_sim.json）
npm run seed   # DB 初期化と投入
npm run dev    # http://localhost:3000/dashboard/log
npm run check:api   # Claude API への接続確認（1回だけ小さく呼ぶ）
npm run eval -- --only S01,S02   # 変化検知の評価（Claude API を使う。引数なしで全20件）
npm run backfill                 # 模擬日誌への変化検知（Claude API を使う）。結果は data/maruso_detections_sim.json に保存され、seed が読み込む
```
