import type { Metadata } from "next";
import GoyuinLayout from "../goyuin/layout";

export const metadata: Metadata = {
  title: "到着 | 御湯印図鑑",
  description: "QRで着いた温泉地の御湯印をもらう。",
};

/** QR 着地ページも、御湯印図鑑と同じ和風の枠と下タブを使う */
export default GoyuinLayout;
