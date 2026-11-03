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

## セットアップ（初稿、実装後に更新）

```
cp .env.example .env   # APIキーを記入
npm install
npm run seed
npm run dev
```
