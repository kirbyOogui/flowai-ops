import { readJson, toErrorResponse } from "@/lib/http";
import { sendReplySchema, sendReplySimulated } from "@/lib/services/requests";
import { ensureSession } from "@/lib/services/sessions";

/** DEMO MODE: 実際のメール / Slack には送信せず、送信したことだけを記録する */
export async function POST(request: Request, ctx: RouteContext<"/api/requests/[id]/send-reply">) {
  try {
    const sessionId = await ensureSession();
    const { id } = await ctx.params;
    const input = sendReplySchema.parse(await readJson(request));
    return Response.json({ request: await sendReplySimulated(sessionId, id, input), simulated: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
