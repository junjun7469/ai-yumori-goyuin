// モデル名はここに集約する（CLAUDE.md）。変更するときは理由を decisions.md にも残す。

/**
 * 日次の変化検知（日誌1件ごとに走る）: Haiku 5.5。
 * 理由：毎回走るので安く速いこと。判定ルールは明文化されていて機械的な要素が大きく、
 * 難しい文章生成は求めない。精度は eval（npm run eval）で確認し、足りなければ上げる。
 */
export const DETECTION_MODEL = "claude-haiku-5-5";

/** 検知の思考の深さ。Haiku 5.5 の既定は medium。ルールは明文化済みなので上げない（eval で確認） */
export const DETECTION_EFFORT = "medium" as const;

/**
 * 引き継ぎメモ（D4）と、湯の声の突き合わせコメント（/dashboard/voices）: Sonnet 5.5。
 * 理由：どちらもボタンを押したときだけ走り頻度が低く、文章の質を優先したいため。
 * 湯の声のコメントは、集計済みの数字とひとことを読み比べて言い換える作業で、計算はさせない。
 */
export const WRITING_MODEL = "claude-sonnet-5-5";

/** 引き継ぎメモの思考の深さ。Sonnet 5.5 の既定は high だが、与えた材料を整理して書く作業なので medium にして時間と費用を抑える */
export const WRITING_EFFORT = "medium" as const;
