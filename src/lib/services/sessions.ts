import "server-only";
import { cookies } from "next/headers";
import { diffDaysISO, fromISODate, toISODate, todayISO } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { seedMembers, seedSessionRequests } from "@/lib/seed";
import { isValidSessionId, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/session";

// 訪問者ごとのデモ作業スペース。依頼データはすべて作業スペース単位で持つため、
// ある訪問者の追加・編集・送信・リセットは、ほかの訪問者の画面には反映されない。

const SESSION_TTL_MS = SESSION_MAX_AGE_SECONDS * 1000;
/** lastSeenAt の更新を間引く間隔（毎リクエストで書き込まないため） */
const TOUCH_INTERVAL_MS = 5 * 60_000;

export class SessionError extends Error {}

async function readSessionId(): Promise<string> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  // proxy.ts が必ず Cookie を付けるので、ここに来るのは proxy を通らない呼び出しだけ
  if (!isValidSessionId(value)) throw new SessionError("デモの作業スペースを特定できません");
  return value;
}

/**
 * 現在の訪問者の作業スペースを返す。初めての訪問（または期限切れ）なら、初期データから作る。
 */
export async function ensureSession(): Promise<string> {
  const sessionId = await readSessionId();

  const created = await prisma.$transaction(
    async (tx) => {
      // 同時に複数のリクエストが来ても、作成と初期データの投入は 1 回だけ行う
      const { count } = await tx.demoSession.createMany({
        data: [{ id: sessionId, anchorDate: fromISODate(todayISO()) }],
        skipDuplicates: true,
      });
      if (count === 0) return false;
      if ((await tx.member.count()) === 0) await seedMembers(tx);
      await seedSessionRequests(tx, sessionId);
      return true;
    },
    { timeout: 20_000 },
  );

  const now = Date.now();
  if (created) {
    // 新しい訪問者が来たときに、しばらく使われていない作業スペースを片付ける
    await prisma.demoSession.deleteMany({ where: { lastSeenAt: { lt: new Date(now - SESSION_TTL_MS) } } });
  } else {
    await alignSessionDates(sessionId);
    await prisma.demoSession.updateMany({
      where: { id: sessionId, lastSeenAt: { lt: new Date(now - TOUCH_INTERVAL_MS) } },
      data: { lastSeenAt: new Date(now) },
    });
  }
  return sessionId;
}

/**
 * 日付が変わってから開いたときに、この作業スペースの日付（期限・受信日時・送信日時・処理履歴など）を
 * ずれた日数分だけ進める。初期データの「今日」「明日」の依頼が、いつ開いても「今日」「明日」のままになる。
 * 訪問者が追加・編集した依頼も一緒に進めるので、日付どうしの関係は変わらない。
 */
async function alignSessionDates(sessionId: string) {
  const today = todayISO();
  const session = await prisma.demoSession.findUnique({ where: { id: sessionId }, select: { anchorDate: true } });
  if (!session) return;
  const days = diffDaysISO(toISODate(session.anchorDate), today);
  if (days <= 0) return;

  await prisma.$transaction(async (tx) => {
    // 同時に開かれても二重に進めないよう、基準日の更新に成功したリクエストだけが日付をずらす
    const { count } = await tx.demoSession.updateMany({
      where: { id: sessionId, anchorDate: session.anchorDate },
      data: { anchorDate: fromISODate(today) },
    });
    if (count === 0) return;
    await tx.$executeRaw`
      UPDATE "Request" SET
        "dueDate" = "dueDate" + ${days}::int,
        "receivedAt" = "receivedAt" + make_interval(days => ${days}::int),
        "createdAt" = "createdAt" + make_interval(days => ${days}::int),
        "replySentAt" = "replySentAt" + make_interval(days => ${days}::int)
      WHERE "sessionId" = ${sessionId}`;
    await tx.$executeRaw`
      UPDATE "ActivityLog" SET "createdAt" = "createdAt" + make_interval(days => ${days}::int)
      WHERE "requestId" IN (SELECT id FROM "Request" WHERE "sessionId" = ${sessionId})`;
    await tx.$executeRaw`
      UPDATE "AiAnalysis" SET "createdAt" = "createdAt" + make_interval(days => ${days}::int)
      WHERE "requestId" IN (SELECT id FROM "Request" WHERE "sessionId" = ${sessionId})`;
  });
}

/** 「デモデータをリセット」：この訪問者の作業スペースだけを初期状態に戻す */
export async function resetSession(sessionId: string) {
  await prisma.$transaction(
    async (tx) => {
      await tx.request.deleteMany({ where: { sessionId } });
      await tx.demoSession.update({ where: { id: sessionId }, data: { anchorDate: fromISODate(todayISO()) } });
      await seedSessionRequests(tx, sessionId);
    },
    { timeout: 20_000 },
  );
}
