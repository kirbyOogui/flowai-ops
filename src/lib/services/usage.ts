import "server-only";
import { AiError } from "@/lib/ai/errors";
import { prisma } from "@/lib/db";

// 公開デモで OpenAI の利用料が想定以上に増えないよう、AI 分析の回数に上限を設ける。
// 失敗した呼び出しも費用が発生しうるため、AI を呼ぶ前に 1 回として記録する。

const WINDOW_MS = 24 * 60 * 60 * 1000;

function limit(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export const aiLimits = () => ({
  perSession: limit("DEMO_AI_LIMIT_PER_SESSION", 20),
  total: limit("DEMO_AI_LIMIT_TOTAL", 300),
});

export async function consumeAiQuota(sessionId: string) {
  const since = new Date(Date.now() - WINDOW_MS);
  const { perSession, total } = aiLimits();
  const [mine, all] = await Promise.all([
    prisma.aiUsageLog.count({ where: { sessionId, createdAt: { gte: since } } }),
    prisma.aiUsageLog.count({ where: { createdAt: { gte: since } } }),
  ]);
  if (mine >= perSession) throw new AiError("demo_limit", `session limit ${perSession}`);
  if (all >= total) throw new AiError("demo_limit_total", `total limit ${total}`);
  await prisma.aiUsageLog.create({ data: { sessionId } });
}
