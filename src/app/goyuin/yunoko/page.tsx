import { YunokoClient } from "@/components/goyuin/YunokoClient";

export const dynamic = "force-dynamic";

/** 湯の子：入浴で育つ、アプリの主役。中身は端末の匿名キーで /api/yunoko から取る */
export default function YunokoPage() {
  return <YunokoClient />;
}
