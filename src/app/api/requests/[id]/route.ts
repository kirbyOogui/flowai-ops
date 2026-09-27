import { readJson, toErrorResponse } from "@/lib/http";
import { requestPatchSchema, updateRequest } from "@/lib/services/requests";
import { ensureSession } from "@/lib/services/sessions";

export async function PATCH(request: Request, ctx: RouteContext<"/api/requests/[id]">) {
  try {
    const sessionId = await ensureSession();
    const { id } = await ctx.params;
    const patch = requestPatchSchema.parse(await readJson(request));
    return Response.json({ request: await updateRequest(sessionId, id, patch) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
