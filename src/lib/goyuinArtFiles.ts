// サーバー側専用：public/goyuin/<code>.jpg がある温泉地のコード（goyuinArt.ts が絵を決めるのに使う）
import fs from "node:fs";
import path from "node:path";

const artDir = () => process.env.ART_DIR ?? path.join("public", "goyuin");

export function hasArtFile(code: string): boolean {
  return /^\d{2}$/.test(code) && fs.existsSync(path.join(artDir(), `${code}.jpg`));
}

/** 絵のファイルがある温泉地のコード（候補のうち） */
export function artCodesAmong(codes: Iterable<string>): string[] {
  return [...new Set(codes)].filter(hasArtFile);
}
