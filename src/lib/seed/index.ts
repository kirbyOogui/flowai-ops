import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { finalizeAnalysis } from "@/lib/ai/postprocess";
import { extractDueDate } from "@/lib/ai/providers/mock";
import { fromISODate, todayISO } from "@/lib/dates";
import { normalize } from "@/lib/ingestion";
import { MEMBERS } from "@/lib/nexora";
import { buildAnalysisActivities } from "@/lib/services/activity";
import { pickHistoryCandidates, type HistorySource } from "@/lib/services/history";
import { SEED_REQUESTS } from "./data";

// 初期データの投入。`npm run db:seed`（prisma/seed.ts）、訪問者の作業スペースの作成、「デモデータをリセット」から使う。
// Next.js の外（tsx）からも実行するため、server-only なモジュールには依存しない。

type Db = PrismaClient | Prisma.TransactionClient;

/** メンバー（担当者候補）は全訪問者で共通 */
export async function seedMembers(db: Db) {
  for (const [index, m] of MEMBERS.entries()) {
    const data = { name: m.name, department: m.department, role: m.role, responsibilities: m.responsibilities, sortOrder: index };
    await db.member.upsert({ where: { id: m.id }, create: { id: m.id, ...data }, update: data });
  }
}

/** 1 つの作業スペースに、初期データの依頼（原文 + 事前に生成した AI 分析結果）を登録する */
export async function seedSessionRequests(db: Db, sessionId: string, now: Date = new Date()) {
  const today = todayISO(now);
  const minute = 60_000;
  const created: HistorySource[] = [];

  // 過去の依頼との照合を再現するため、古い順に登録する
  const ordered = [...SEED_REQUESTS].sort((a, b) => b.receivedMinutesAgo - a.receivedMinutesAgo);
  for (const seed of ordered) {
    const receivedAt = new Date(now.getTime() - seed.receivedMinutesAgo * minute);
    const message = normalize(seed.input, receivedAt);
    const { sourceText } = seed.analysis.dueDate;
    const dueDate = sourceText ? extractDueDate(sourceText, today).date : null;
    const decision = finalizeAnalysis({
      ...seed.analysis,
      relatedRequest: { reasoning: seed.analysis.relatedRequest?.reasoning ?? "単独で完結した新規の依頼", requestId: null },
      dueDate: { sourceText, date: dueDate },
    });
    const history = pickHistoryCandidates(created, message);

    const activities = buildAnalysisActivities(message.metadata, decision, receivedAt, seed.latencyMs, {
      candidates: history.length,
      relatedTitle: null,
    });
    const afterAnalysis = receivedAt.getTime() + seed.latencyMs;
    if (seed.status !== "todo") {
      activities.push({
        type: "status_changed",
        actor: "human",
        description: "状態を変更：未着手 → 対応中",
        createdAt: new Date(afterAnalysis + 8 * minute),
      });
    }
    if (seed.replySent) {
      activities.push({
        type: "reply_sent",
        actor: "human",
        description: `返信を確認して送信：${message.metadata.sourceType === "slack" ? message.metadata.channel : message.requesterName}（DEMO：実際には送信されていません）`,
        createdAt: new Date(afterAnalysis + 10 * minute),
      });
    }
    if (seed.status === "done") {
      activities.push({
        type: "status_changed",
        actor: "human",
        description: "状態を変更：対応中 → 完了",
        createdAt: new Date(afterAnalysis + 180 * minute),
      });
    }

    const row = await db.request.create({
      data: {
        sessionId,
        title: decision.output.title,
        sourceType: message.sourceType,
        sourceMetadata: message.metadata,
        requesterName: message.requesterName,
        originalMessage: message.body,
        summary: decision.output.summary,
        category: decision.output.category,
        priority: decision.output.priority,
        assigneeId: decision.assigneeId,
        reviewState: decision.reviewState,
        dueDate: decision.dueDate ? fromISODate(decision.dueDate) : null,
        nextAction: decision.output.nextAction,
        replySubject: decision.output.reply.subject,
        replyDraft: decision.output.reply.body,
        replySentAt: seed.replySent ? new Date(afterAnalysis + 10 * minute) : null,
        status: seed.status,
        receivedAt,
        createdAt: receivedAt,
        analyses: {
          create: {
            provider: "seed",
            model: "precomputed",
            result: decision.output,
            assigneeConfidence: decision.assigneeConfidence,
            latencyMs: seed.latencyMs,
            createdAt: new Date(afterAnalysis),
          },
        },
        activities: { create: activities },
      },
    });
    created.unshift(row);
  }
}

/** `npm run db:seed`：メンバーを投入し、すべての作業スペースを削除する（次の訪問時に初期データから作り直される） */
export async function resetDatabase(prisma: PrismaClient) {
  await prisma.$transaction(async (tx) => {
    await seedMembers(tx);
    await tx.demoSession.deleteMany();
  });
  return { members: MEMBERS.length };
}
