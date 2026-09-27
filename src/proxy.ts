import { NextResponse, type NextRequest } from "next/server";
import { isValidSessionId, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/session";

/**
 * 訪問者ごとにデモの作業スペースの ID（Cookie）を割り当てる。
 * 初回アクセスでも同じリクエストの中でサーバーが ID を読めるよう、リクエスト側の Cookie にも書き込む。
 */
export function proxy(request: NextRequest) {
  const current = request.cookies.get(SESSION_COOKIE)?.value;
  const sessionId = isValidSessionId(current) ? current : crypto.randomUUID();

  request.cookies.set(SESSION_COOKIE, sessionId);
  const response = NextResponse.next({ request: { headers: request.headers } });
  // 有効期限を毎回延ばし、使い続けている間は同じ作業スペースを使えるようにする
  response.cookies.set({
    name: SESSION_COOKIE,
    value: sessionId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export const config = {
  matcher: ["/", "/api/:path*"],
};
