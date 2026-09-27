// デモの作業スペース（訪問者ごとのデータ）を識別する Cookie。proxy.ts とサーバーの両方から使う。

export const SESSION_COOKIE = "flowai_demo";

/** Cookie の有効期間。これを過ぎたら新しい作業スペース（初期状態）から始まる */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidSessionId(value: string | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
