import Image from "next/image";
import type { SpringClass } from "@/db/schema";
import { characterImagePath } from "@/lib/characterImage";
import { fallbackCharacterDataUri } from "@/lib/fallbackCharacter";
import type { Variant } from "@/lib/goyuinVariant";

/** retro 用：どの表示サイズでも幅96pxの画像を取る（Next の画像最適化が用意する幅のひとつ） */
const pixelLoader = ({ src }: { src: string }) => `/_next/image?url=${encodeURIComponent(src)}&w=96&q=60`;

type Props = {
  area: { code: string; name: string; characterImage: string | null; springTypeClass: SpringClass };
  /** next/image の sizes（画面幅に応じた縮小配信のため） */
  sizes?: string;
  priority?: boolean;
  /** 未所持の見た目（モノトーン） */
  dim?: boolean;
  className?: string;
  /** 柄。今は画像に影響しない（画像パスの解決は characterImagePath に集約） */
  variant?: Variant;
};

/** 画像がある温泉地は縮小配信、無い温泉地は泉質分類から作った SVG（fallbackCharacter.ts） */
export function CharacterImage({ area, sizes = "(max-width: 640px) 45vw, 200px", priority = false, dim = false, className = "", variant }: Props) {
  const src = characterImagePath(area, variant);
  const filter = dim ? "grayscale(1) opacity(0.45)" : undefined;
  return (
    <div className={`relative aspect-square w-full ${className}`} style={{ filter }}>
      {src ? (
        <>
          <Image src={src} alt={`${area.name}のキャラクター`} fill sizes={sizes} priority={priority} className="only-washi object-contain" />
          {/* retro：画像最適化で幅96pxまで落とし、ドットのまま拡大して緑の4階調にする（元画像は変えない）。retro でないときは読み込まれない */}
          <Image src={src} alt="" aria-hidden fill sizes="96px" loader={pixelLoader} className="only-retro char-pixel object-contain" />
        </>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fallbackCharacterDataUri(area.springTypeClass, area.code)} alt={`${area.name}のキャラクター（仮の絵）`} className="char-pixel h-full w-full object-contain" />
      )}
    </div>
  );
}
