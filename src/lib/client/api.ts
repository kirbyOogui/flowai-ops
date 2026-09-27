import type { AiErrorCode } from "@/lib/ai/errors";
import type { AnalysisStepKey } from "@/lib/ai/steps";
import type { SourceInput } from "@/lib/ingestion";
import type { RequestPatch } from "@/lib/services/requests";
import type { AnalyzeEvent, RequestDTO } from "@/lib/types";

// ブラウザから API Route を呼ぶための薄いラッパー

export class ApiError extends Error {}

async function call<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  } catch {
    throw new ApiError("サーバーに接続できませんでした。通信状況を確認してください。");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error ?? `エラーが発生しました（${res.status}）`);
  return data as T;
}

export async function patchRequest(id: string, patch: RequestPatch): Promise<RequestDTO> {
  const data = await call<{ request: RequestDTO }>(`/api/requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return data.request;
}

export async function sendReply(id: string, reply: { subject: string; body: string }): Promise<RequestDTO> {
  const data = await call<{ request: RequestDTO }>(`/api/requests/${id}/send-reply`, {
    method: "POST",
    body: JSON.stringify(reply),
  });
  return data.request;
}

export async function resetDemo(): Promise<RequestDTO[]> {
  const data = await call<{ requests: RequestDTO[] }>("/api/demo/reset", { method: "POST" });
  return data.requests;
}

export class AnalyzeError extends Error {
  constructor(readonly code: AiErrorCode) {
    super(code);
  }
}

/** /api/analyze を呼び、ストリームで届く進捗を onStep に流しながら、登録された Request を返す */
export async function analyzeRequest(
  input: SourceInput,
  { onStep, signal }: { onStep: (step: AnalysisStepKey) => void; signal?: AbortSignal },
): Promise<RequestDTO> {
  let res: Response;
  try {
    res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new AnalyzeError("api_error");
  }
  if (!res.body) throw new AnalyzeError("api_error");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handle = (line: string): RequestDTO | undefined => {
    if (!line.trim()) return;
    let event: AnalyzeEvent;
    try {
      event = JSON.parse(line) as AnalyzeEvent;
    } catch {
      throw new AnalyzeError("invalid_output");
    }
    if (event.type === "step") onStep(event.step);
    if (event.type === "error") throw new AnalyzeError(event.code);
    if (event.type === "done") return event.request;
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const result = handle(line);
        if (result) return result;
      }
      if (done) break;
    }
    const result = handle(buffer);
    if (result) return result;
  } catch (error) {
    if (error instanceof AnalyzeError || signal?.aborted) throw error;
    throw new AnalyzeError("api_error");
  }
  // 完了イベントが来ないまま切断された
  throw new AnalyzeError(res.ok ? "api_error" : "validation");
}
