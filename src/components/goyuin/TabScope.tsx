"use client";

import { usePathname } from "next/navigation";
import { bandLabel, tabOf } from "@/lib/tabs";

/**
 * 御湯印図鑑の外枠。URL からタブ色（data-tab）を決め、retro テーマでは画面上部にその色の見出し帯を出す。
 * 画面幅 768px 以上では、全体を 390×844px の「スマホの枠」に収める（それ未満は枠なしの全画面）。
 * 枠の中は独立したスクロール領域で、下タブ（tabs）は枠の内側の下に固定される。
 */
export function TabScope({ children, tabs }: { children: React.ReactNode; tabs: React.ReactNode }) {
  const path = usePathname() ?? "/goyuin";
  return (
    <div className="goyuin-theme" data-tab={tabOf(path)}>
      <div className="phone-stage">
        <div className="phone-frame">
          <div className="phone-screen">
            <div className="phone-scroll">
              <div className="screen-band only-retro" role="presentation">
                <div className="mx-auto max-w-[480px] px-5 py-1.5">■ {bandLabel(path)}</div>
              </div>
              {children}
            </div>
            {tabs}
          </div>
          <span className="phone-camera" aria-hidden />
          <span className="phone-home" aria-hidden />
        </div>
        <p className="phone-caption">ブラウザ版デモ ／ 実際はスマホアプリとして利用</p>
      </div>
    </div>
  );
}
