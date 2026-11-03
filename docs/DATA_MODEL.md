# データモデル・API 仕様（初稿 2026-11-03）

SQLite + Drizzle。全テーブルに `created_at`, `updated_at`。模擬データは `is_simulated` で区別する。

## 1. テーブル

### onsen_area（温泉地マスタ：47→151）

| 列 | 型 | 説明 |
| --- | --- | --- |
| id | integer PK | |
| code | text unique | `01`〜`47`（CSV の code） |
| prefecture | text | 都道府県 |
| name | text | 温泉地名 |
| reading | text | よみ |
| spring_type | text | 代表泉質（分類のみ） |
| spring_type_class | text | 色決定用の分類キー：sulfur / chloride / bicarbonate / simple / sulfate / iron / radon / black / mixed |
| why_famous | text | 選定理由・特徴（一言） |
| character_image | text nullable | `/characters/02_aomori_sukayu.png`。null ならフォールバック SVG |
| source_url | text nullable | 出典。null なら画面に「要確認」 |
| source_status | text | `verified` / `unverified` / `analysis_sheet` |

### facility（施設）

| 列 | 型 | 説明 |
| --- | --- | --- |
| id | integer PK | |
| onsen_area_id | FK | 杖立 = code 43 |
| name | text | 丸正旅館 |
| has_ai_yumori | boolean | true なら御湯印に「今日の湯」を出す |

### analysis_sheet（温泉分析書）

| 列 | 型 | 説明 |
| --- | --- | --- |
| id | integer PK | |
| facility_id | FK | |
| analyzed_at | date | 2014-02-25 |
| lab | text | 株式会社同仁グローカル |
| source_name | text | 杖立温泉（ひごや協同泉源） |
| spring_type | text | ナトリウム－塩化物温泉（低張性 弱酸性 高温泉） |
| data | json | 下記 2 の JSON |
| needs_verification | json | 要確認項目の配列 |

### daily_log（湯日誌）

| 列 | 型 | 説明 |
| --- | --- | --- |
| id | integer PK | |
| facility_id | FK | |
| logged_at | datetime | |
| temp_chamber_c | real nullable | チャンバー温度（℃）。基準 91.5 |
| temp_bath_c | real nullable | 浴槽温度（℃）。40〜43℃前後が目安 |
| flow_l_per_min | real nullable | 湯量（L/分）。計測器の値。基準 185.7 |
| clarity | text | `clear` / `slightly_cloudy` / `cloudy` |
| smell | text | `normal` / `stronger` / `different` |
| actions | text | 作業内容（加水、清掃、配管確認 など自由記述） |
| note | text | 一言 |
| weather | text nullable | `sunny` / `rain` / `heavy_rain` / `snow`（模擬は生成時に付与） |
| is_simulated | boolean | |

### detection（変化検知の結果）

| 列 | 型 | 説明 |
| --- | --- | --- |
| id | integer PK | |
| daily_log_id | FK | |
| level | text | `normal` / `watch` / `check` |
| reasons | json | 文字列配列 |
| next_checks | json | 「湯守なら次に見ること」配列 |
| explanation_pro | text | 湯守向けの説明 |
| explanation_guest | text | 宿泊者向けの説明 |
| model | text | 使ったモデル名 |
| created_at | datetime | |

### handover_note（引き継ぎメモ）

| 列 | 型 | 説明 |
| --- | --- | --- |
| id | integer PK | |
| facility_id | FK | |
| period_from / period_to | date | |
| body_md | text | Markdown |
| model | text | |

### goyuin（御湯印の所持）

| 列 | 型 | 説明 |
| --- | --- | --- |
| id | integer PK | |
| user_key | text | ログインなし。ブラウザ発行の匿名キー |
| onsen_area_id | FK | |
| obtained_via | text | `gacha` / `visit` |
| obtained_at | datetime | |
| snapshot | json nullable | 取得時点の「今日の湯」（丸正のみ） |

## 2. 分析書 JSON（`data/maruso_analysis_2014.json`）

```json
{
  "facility": "丸正旅館",
  "source_name": "杖立温泉（ひごや協同泉源）",
  "analyzed_at": "2014-02-25",
  "sampled_at": "2014-02-13",
  "lab": "株式会社同仁グローカル",
  "spring_type": "ナトリウム－塩化物温泉",
  "classification": { "osmotic": "低張性", "ph_class": "弱酸性", "temp_class": "高温泉" },
  "field": {
    "temp_c": 91.5,
    "air_temp_c": 12.0,
    "flow_l_per_min": 185.7,
    "ph": { "value": 2.01, "needs_verification": true, "note": "画像上の読み取り。泉質分類『弱酸性』と整合しないため原本確認" },
    "ec_ms_per_cm_25c": 0.464,
    "appearance": "無色透明・無味・無臭・微弱硫化水素臭"
  },
  "lab_results": {
    "density_g_per_cm3": 1.0001,
    "ph": { "value": 1.87, "needs_verification": true },
    "evaporation_residue_g_per_kg": 1.734
  },
  "cations_mg": { "Li": 0.7, "Na": 181.8, "K": 18.1, "NH4": 5.3, "Ca": 43.7, "Sr": 0.1, "total": 249.7 },
  "anions_mg": { "OH": 0.2, "F": 1.7, "Cl": 542.4, "Br": 2.1, "I": 0.5, "HSO4": 0.5, "SO4": 112.7, "HCO3": 1.8, "total": 661.9 },
  "non_dissociated_mg": { "H2SiO3": 116.1, "HBO2": 98.3, "total": 214.4 },
  "dissolved_gas_mg": { "CO2": "<0.1", "H2S": null },
  "needs_verification": [
    "pH（2.01 / 1.87）が泉質分類『弱酸性』と整合しない",
    "陽イオン mval% 合計が 11.68 と読める（各群で100%になるはず）",
    "Li が表では 0.7mg、下段の記載では 1.3mg",
    "分析から10年以上経過。再分析の時期を施設に確認"
  ],
  "source": "温泉分析書 第K13108663号（画像）",
  "note": "分析値は源泉の値であり、浴槽の値と一致しない"
}
```

## 3. 変化検知の出力スキーマ（Claude の構造化出力）

```json
{
  "level": "watch",
  "reasons": ["湯量が3日連続で基準（185.7 L/分）の −8% 以下。継続的な減少の可能性"],
  "next_checks": ["引湯管の詰まりを目視", "貯湯槽の水位", "共同泉源側の変化を組合に確認"],
  "explanation_pro": "…",
  "explanation_guest": "…",
  "confidence": "medium"
}
```

`level` の決め方（最初のルール、eval で磨く）：
- `check`：基準から ±10% を超える温度変化（チャンバー）、湯量が基準（185.7 L/分）の −8% 以下の日が3日以上、匂い `different`、濁り `cloudy` が2日以上
- `watch`：上記に近づく傾向、天候で説明できる一時的変化
- `normal`：それ以外

## 4. API

| メソッド | パス | 内容 |
| --- | --- | --- |
| GET | `/api/areas` | 47温泉地一覧 |
| GET | `/api/areas/:code` | 詳細＋丸正なら `today` を含む |
| POST | `/api/logs` | 湯日誌を保存→検知を実行→detection を返す |
| GET | `/api/logs?days=60` | 推移 |
| POST | `/api/handover` | 引き継ぎメモ生成 |
| POST | `/api/gacha` | 1日1回。`user_key` ごとに判定 |
| GET | `/api/goyuin?user_key=` | 所持一覧 |

## 5. 泉質分類→フォールバック SVG の色

| spring_type_class | 本体色 | 湯の色 |
| --- | --- | --- |
| sulfur | #E8C547 | #F2E36B |
| chloride | #5FA8D3 | #CFEAF7 |
| bicarbonate | #E9DCC9 | #F7F1E6 |
| simple | #9FD3C7 | #E6F6F3 |
| sulfate | #7FC8B5 | #D9F0EA |
| iron | #B5651D | #C97A3A |
| radon | #8EC9FF | #DCEFFF |
| black | #3B3B3B | #1E1E1E |
| mixed | 虹グラデーション | 虹グラデーション |
