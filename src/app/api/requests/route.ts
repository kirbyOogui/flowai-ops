import { toErrorResponse } from "@/lib/http";
import { listRequests } from "@/lib/services/requests";
import { ensureSession } from "@/lib/services/sessions";

export async function GET() {
  try {
    const sessionId = await ensureSession();
    return Response.json({ requests: await listRequests(sessionId) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
