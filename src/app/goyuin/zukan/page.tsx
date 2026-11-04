import { redirect } from "next/navigation";

/** 旧「図鑑」。いまは /goyuin（御湯印図鑑）の「御湯印を探す」に統合した */
export default function ZukanRedirect() {
  redirect("/goyuin?tab=search");
}
