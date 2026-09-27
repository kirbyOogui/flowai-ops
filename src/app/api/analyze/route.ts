import { runAnalysisPipeline } from "@/lib/ai";
import { AiError } from "@/lib/ai/errors";
import { todayISO } from "@/lib/dates";
import { normalize, sourceInputSchema } from "@/lib/ingestion";
import { getAiInfo } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { ensureSession } from "@/lib/services/sessions";
import { consumeAiQuota } from "@/lib/services/usage";
import { findHistoryCandidates } from "@/lib/services/history";
import { createRequestFromAnalysis } from "@/lib/services/requests";
import type { AnalyzeEvent } from "@/lib/types";

export const maxDuration = 90;

/**
 * 依頼を受け付けて AI で分析し、Request として登録する。
 * 進捗を逐次返すため、レスポンスは NDJSON（1行 = 1 AnalyzeEvent）のストリーム。
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsed = sourceInputSchema.safeParse(body);
  if (!parsed.success) {
    const event: AnalyzeEvent = { type: "error", code: "validation", detail: parsed.error.issues[0]?.message };
    return new Response(`${JSON.stringify(event)}\n`, {
      status: 400,
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
    });
  }

  let sessionId: string;
  try {
    sessionId = await ensureSession();
  } catch {
    const event: AnalyzeEvent = { type: "error", code: "validation", detail: "session" };
    return new Response(`${JSON.stringify(event)}\n`, { status: 400, headers: { "Content-Type": "application/x-ndjson; charset=utf-8" } });
  }
  const message = normalize(parsed.data);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: AnalyzeEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true; // クライアントが切断済み
        }
      };

      try {
        // 「先日の件」のような依頼に備え、同じ依頼者の過去の依頼を候補として AI に渡す
        if (getAiInfo().provider === "openai") await consumeAiQuota(sessionId);
        const history = await findHistoryCandidates(prisma, sessionId, message);
        const result = await runAnalysisPipeline(message, {
          today: todayISO(message.receivedAt),
          history,
          onStep: (step) => send({ type: "step", step }),
          signal: request.signal,
        });
        send({ type: "step", step: "register" });
        try {
          const created = await createRequestFromAnalysis(sessionId, message, result, history);
          send({ type: "done", request: created });
        } catch (error) {
          console.error("[analyze] failed to save request", error);
          send({ type: "error", code: "internal" });
        }
      } catch (error) {
        const aiError = error instanceof AiError ? error : new AiError("api_error", String(error));
        console.error(`[analyze] ${aiError.code}: ${aiError.message}`);
        send({ type: "error", code: aiError.code });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
