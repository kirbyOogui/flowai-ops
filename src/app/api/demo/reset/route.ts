import { toErrorResponse } from "@/lib/http";
import { listRequests } from "@/lib/services/requests";
import { ensureSession, resetSession } from "@/lib/services/sessions";

/** この訪問者の作業スペースだけを初期状態に戻す（ほかの訪問者のデータには影響しない） */
export async function POST() {
  try {
    const sessionId = await ensureSession();
    await resetSession(sessionId);
    return Response.json({ requests: await listRequests(sessionId) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
