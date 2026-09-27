import { connection } from "next/server";
import { Workspace } from "@/components/flow/workspace";
import { getAiInfo } from "@/lib/ai";
import { todayISO } from "@/lib/dates";
import { listMembers, listRequests } from "@/lib/services/requests";
import { ensureSession } from "@/lib/services/sessions";

export default async function Home() {
  // DB の最新状態を毎回読むため、リクエスト時にレンダリングする
  await connection();
  // 訪問者ごとの作業スペース（初回は初期データから作る）。ほかの訪問者の操作はここには出てこない
  const sessionId = await ensureSession();
  const [requests, members] = await Promise.all([listRequests(sessionId), listMembers()]);

  return <Workspace initialRequests={requests} members={members} today={todayISO()} aiInfo={getAiInfo()} />;
}
