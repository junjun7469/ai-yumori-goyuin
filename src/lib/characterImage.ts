// キャラクター画像のパスを決める、唯一の場所。
// 今は柄（variant）に関係なく温泉地ごとの1枚を返す。将来ポーズ違いの画像が増えたら、ここだけを直す
// （例：`/characters/43_kumamoto_tsuetate_asayu.png` があればそれを返す）。
import type { Variant } from "./goyuinVariant";

export function characterImagePath(area: { characterImage: string | null }, _variant?: Variant): string | null {
  return area.characterImage;
}
