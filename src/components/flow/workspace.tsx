"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MousePointerClick, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ApiError, patchRequest, resetDemo } from "@/lib/client/api";
import { todayISO } from "@/lib/dates";
import type { RequestPatch } from "@/lib/services/requests";
import type { MemberDTO, RequestDTO } from "@/lib/types";
import { AnalyticsView } from "./analytics-view";
import { MembersView } from "./members-view";
import { NewRequestDialog } from "./composer/new-request-dialog";
import { RequestDetail } from "./request-detail";
import { AppHeader, MobileNav, SideNav, type View } from "./shell";
import { HomeView, InboxView, sortByAttention, TasksView } from "./views";
import { WorkspaceContext, type AiInfo, type WorkspaceContextValue } from "./workspace-context";

const DESKTOP_QUERY = "(min-width: 1280px)";

function useIsDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(DESKTOP_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

export function Workspace({
  initialRequests,
  members,
  today: initialToday,
  aiInfo,
}: {
  initialRequests: RequestDTO[];
  members: MemberDTO[];
  today: string;
  aiInfo: AiInfo;
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [view, setView] = useState<View>("home");
  // undefined = まだ誰も選んでいない（PC では要対応順の先頭を自動で表示する）
  const [chosenId, setSelectedId] = useState<string | null | undefined>(undefined);
  const [composerOpen, setComposerOpen] = useState(false);
  const [recentIds, setRecentIds] = useState<Set<string>>(new Set());
  const [resetting, setResetting] = useState(false);
  const [today, setToday] = useState(initialToday);
  const isDesktop = useIsDesktop();

  // 開いたまま日付をまたいでも「今日」「明日」の表示がずれないよう、1分ごとに暦日を確認する
  useEffect(() => {
    const timer = setInterval(() => setToday(todayISO()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const selectedId = chosenId !== undefined ? chosenId : isDesktop ? (sortByAttention(requests)[0]?.id ?? null) : null;

  const upsertRequest = useCallback((request: RequestDTO) => {
    setRequests((list) => {
      const exists = list.some((r) => r.id === request.id);
      return exists ? list.map((r) => (r.id === request.id ? request : r)) : [request, ...list];
    });
  }, []);

  const updateRequest = useCallback(
    async (id: string, patch: RequestPatch) => {
      try {
        const updated = await patchRequest(id, patch);
        upsertRequest(updated);
        return updated;
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : "更新に失敗しました");
        return null;
      }
    },
    [upsertRequest],
  );

  const memberById = useCallback((id: string | null) => members.find((m) => m.id === id), [members]);

  const handleCreated = useCallback(
    (request: RequestDTO) => {
      upsertRequest(request);
      setSelectedId(request.id);
      setRecentIds((s) => new Set(s).add(request.id));
      setTimeout(() => {
        setRecentIds((s) => {
          const next = new Set(s);
          next.delete(request.id);
          return next;
        });
      }, 5000);
    },
    [upsertRequest],
  );

  const handleReset = async () => {
    setResetting(true);
    try {
      const fresh = await resetDemo();
      setRequests(fresh);
      setSelectedId(isDesktop ? (sortByAttention(fresh)[0]?.id ?? null) : null);
      toast.success("デモデータを初期状態に戻しました");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "リセットに失敗しました");
    } finally {
      setResetting(false);
    }
  };

  const ctx = useMemo<WorkspaceContextValue>(
    () => ({ requests, members, memberById, today, aiInfo, updateRequest, upsertRequest, selectRequest: setSelectedId }),
    [requests, members, memberById, today, aiInfo, updateRequest, upsertRequest],
  );

  const selected = requests.find((r) => r.id === selectedId) ?? null;
  const listProps = { requests, selectedId, recentIds, onNewRequest: () => setComposerOpen(true) };
  const counts = {
    home: requests.filter((r) => r.reviewState === "needs_review").length,
    inbox: requests.length,
    tasks: requests.filter((r) => r.status !== "done").length,
  };

  return (
    <WorkspaceContext.Provider value={ctx}>
      <div className="flex h-dvh flex-col">
        <AppHeader aiInfo={aiInfo} />
        <div className="flex min-h-0 flex-1">
          <SideNav view={view} onChange={setView} counts={counts} onReset={handleReset} resetting={resetting} />

          <main className="min-w-0 flex-1 overflow-y-auto px-4 pt-5 pb-24 sm:px-6 md:pb-8">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
                className="mx-auto max-w-5xl"
              >
                {view === "home" && <HomeView {...listProps} />}
                {view === "inbox" && <InboxView {...listProps} />}
                {view === "tasks" && <TasksView {...listProps} />}
                {view === "members" && <MembersView requests={requests} onNewRequest={listProps.onNewRequest} />}
                {view === "analytics" && <AnalyticsView requests={requests} onNewRequest={listProps.onNewRequest} />}
              </motion.div>
            </AnimatePresence>
          </main>

          {isDesktop && (
            <aside aria-label="仕事の詳細" className="w-[460px] shrink-0 overflow-hidden border-l bg-card 2xl:w-[520px]">
              {/* 初回表示はアニメーションさせない（SSR の HTML をそのまま見せる） */}
              <AnimatePresence mode="wait" initial={false}>
                {selected ? (
                  <motion.div key={selected.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }} className="h-full">
                    <RequestDetail request={selected} />
                  </motion.div>
                ) : (
                  <DetailEmptyState key="empty" onNewRequest={listProps.onNewRequest} />
                )}
              </AnimatePresence>
            </aside>
          )}
        </div>
        <MobileNav view={view} onChange={setView} />
      </div>

      {!isDesktop && (
        <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
          <SheetContent side="right" showCloseButton={false} className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
            <SheetTitle className="sr-only">仕事の詳細</SheetTitle>
            {selected && <RequestDetail request={selected} onClose={() => setSelectedId(null)} />}
          </SheetContent>
        </Sheet>
      )}

      <NewRequestDialog open={composerOpen} onOpenChange={setComposerOpen} requests={requests} onCreated={handleCreated} />
    </WorkspaceContext.Provider>
  );
}

function DetailEmptyState({ onNewRequest }: { onNewRequest: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-primary">
        <MousePointerClick className="size-6" aria-hidden />
      </span>
      <p className="mt-4 text-sm font-semibold">仕事を選択してください</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        AIの分析結果・返信案・AI処理履歴がここに表示されます。
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onNewRequest}>
        <Plus data-icon="inline-start" />
        新しい依頼を作成
      </Button>
    </div>
  );
}
