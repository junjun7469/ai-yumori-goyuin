import type { SpringClass } from "./schema";

/**
 * 47温泉地 code → 色決定用の泉質分類キー（DATA_MODEL.md §5）。
 * CSV の「代表泉質」から人が判断して割り当てた。複数泉質が並ぶ「多種」は mixed。
 * 色分けのためだけの分類であり、泉質の断定ではない（画面には CSV の代表泉質をそのまま出す）。
 * 見直すときは decisions.md に理由を残す。
 */
export const SPRING_CLASS_BY_CODE: Record<string, SpringClass> = {
  "01": "mixed", "02": "sulfur", "03": "simple", "04": "mixed", "05": "sulfur",
  "06": "sulfur", "07": "simple", "08": "simple", "09": "simple", "10": "sulfur",
  "11": "sulfur", "12": "black", "13": "black", "14": "mixed", "15": "simple",
  "16": "simple", "17": "chloride", "18": "chloride", "19": "simple", "20": "sulfur",
  "21": "simple", "22": "chloride", "23": "simple", "24": "simple", "25": "simple",
  "26": "radon", "27": "sulfur", "28": "iron", "29": "bicarbonate", "30": "chloride",
  "31": "radon", "32": "sulfate", "33": "simple", "34": "radon", "35": "simple",
  "36": "sulfur", "37": "radon", "38": "simple", "39": "simple", "40": "sulfur",
  "41": "bicarbonate", "42": "sulfur", "43": "chloride", "44": "mixed", "45": "chloride",
  "46": "chloride", "47": "chloride",
};
