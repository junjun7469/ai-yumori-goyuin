import Image from "next/image";
import type { SpringClass } from "@/db/schema";
import { fallbackCharacterDataUri } from "@/lib/fallbackCharacter";

type Props = {
  area: { code: string; name: string; characterImage: string | null; springTypeClass: SpringClass };
  /** next/image の sizes（画面幅に応じた縮小配信のため） */
  sizes?: string;
  priority?: boolean;
  /** 未所持の見た目（モノトーン） */
  dim?: boolean;
  className?: string;
};

/** 画像がある温泉地は縮小配信、無い温泉地は泉質分類から作った SVG（fallbackCharacter.ts） */
export function CharacterImage({ area, sizes = "(max-width: 640px) 45vw, 200px", priority = false, dim = false, className = "" }: Props) {
  const filter = dim ? "grayscale(1) opacity(0.45)" : undefined;
  return (
    <div className={`relative aspect-square w-full ${className}`} style={{ filter }}>
      {area.characterImage ? (
        <Image src={area.characterImage} alt={`${area.name}のキャラクター`} fill sizes={sizes} priority={priority} className="object-contain" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fallbackCharacterDataUri(area.springTypeClass, area.code)} alt={`${area.name}のキャラクター（仮の絵）`} className="h-full w-full object-contain" />
      )}
    </div>
  );
}
