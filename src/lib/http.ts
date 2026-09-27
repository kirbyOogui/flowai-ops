import "server-only";
import { z } from "zod";
import { ConflictError, NotFoundError } from "@/lib/services/requests";
import { SessionError } from "@/lib/services/sessions";

// 検証エラーの既定メッセージを日本語にする
z.config(z.locales.ja());

export function jsonError(status: number, message: string, issues?: unknown) {
  return Response.json({ error: message, issues }, { status });
}

/** Route Handler 内の例外を HTTP レスポンスに変換する */
export function toErrorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return jsonError(400, error.issues[0]?.message ?? "入力内容が正しくありません", z.flattenError(error));
  }
  if (error instanceof NotFoundError) return jsonError(404, "依頼が見つかりません。デモデータがリセットされた可能性があるため、ページを再読み込みしてください。");
  if (error instanceof ConflictError) return jsonError(409, error.message);
  if (error instanceof SessionError) return jsonError(400, `${error.message}。ページを再読み込みしてください。`);
  console.error(error);
  return jsonError(500, "サーバーでエラーが発生しました");
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new z.ZodError([{ code: "custom", message: "JSONの形式が正しくありません", path: [], input: undefined }]);
  }
}
