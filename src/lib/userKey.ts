"use client";
// 匿名キー：ログインなし。ブラウザの localStorage に発行して使う（課金・個人情報なし）
import { isValidUserKey } from "./gachaLogic";

export const USER_KEY_STORAGE = "yumori_user_key";

function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

/** 無ければ発行して保存する。localStorage が使えない環境では null */
export function getOrCreateUserKey(): string | null {
  try {
    let key = window.localStorage.getItem(USER_KEY_STORAGE);
    if (!key || !isValidUserKey(key)) {
      key = newKey();
      window.localStorage.setItem(USER_KEY_STORAGE, key);
    }
    return key;
  } catch {
    return null;
  }
}
