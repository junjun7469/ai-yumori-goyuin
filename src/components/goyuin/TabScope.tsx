"use client";

import { usePathname } from "next/navigation";
import { bandLabel, tabOf } from "@/lib/tabs";

/** 御湯印図鑑の外枠。URL からタブ色（data-tab）を決め、retro テーマでは画面上部にその色の見出し帯を出す */
export function TabScope({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "/goyuin";
  return (
    <div className="goyuin-theme" data-tab={tabOf(path)}>
      <div className="screen-band only-retro" role="presentation">
        <div className="mx-auto max-w-[480px] px-5 py-1.5">■ {bandLabel(path)}</div>
      </div>
      {children}
    </div>
  );
}
