// (b) 分析書を持たない温泉地の成分プロファイル：泉質の分類名と一言の特徴だけ。数値は載せない（CLAUDE.md 絶対ルール2）。
// 出典は「観光協会等の公開情報をもとに記載（要確認）」。分析書がある杖立（43）は src/lib/springAnalysis.ts が JSON から作る。
export const PUBLIC_INFO_SOURCE = "観光協会等の公開情報をもとに記載（要確認）";
export const ANALYSIS_SOURCE = "丸正旅館 温泉分析書（2014年）より";

export const SPRING_SUMMARIES: Record<string, { classes: string; feature: string }> = {
  "01": { classes: "硫黄泉・塩化物泉・硫酸塩泉・含鉄泉など9種類の泉質", feature: "「温泉のデパート」と呼ばれる多彩さ" },
  "02": { classes: "酸性・含硫黄-アルミニウム-硫酸塩・塩化物泉", feature: "pH1.5〜2.0前後の強酸性、白濁" },
  "03": { classes: "単純温泉", feature: "弱アルカリ性、やわらかな湯" },
  "04": { classes: "硫黄泉・炭酸水素塩泉・塩化物泉・単純温泉など多種", feature: "国内の泉質分類の大半がそろう" },
  "06": { classes: "酸性・含硫黄-アルミニウム-硫酸塩・塩化物泉", feature: "強酸性の硫黄泉" },
};
