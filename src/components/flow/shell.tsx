"use client";

import { BarChart3, Building2, House, Inbox, KanbanSquare, RotateCcw, Sparkles, Users, Workflow, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AiInfo } from "./workspace-context";

export type View = "home" | "inbox" | "tasks" | "members" | "analytics";

export const NAV_ITEMS: { view: View; label: string; icon: LucideIcon }[] = [
  { view: "home", label: "ホーム", icon: House },
  { view: "inbox", label: "受信箱", icon: Inbox },
  { view: "tasks", label: "仕事一覧", icon: KanbanSquare },
  { view: "members", label: "メンバー", icon: Users },
  { view: "analytics", label: "分析", icon: BarChart3 },
];

export function AppHeader({ aiInfo }: { aiInfo: AiInfo }) {
  const aiLabel =
    aiInfo.provider === "mock" ? "Mock AI" : aiInfo.configured ? `OpenAI ${aiInfo.model}` : "APIキー未設定";
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur sm:px-5">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Workflow className="size-4.5" aria-hidden />
        </span>
        <span className="text-[15px] font-bold tracking-tight">
          FlowAI <span className="text-primary">OPS</span>
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                className={cn(
                  "hidden h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset md:inline-flex",
                  aiInfo.provider === "openai" && aiInfo.configured
                    ? "bg-ai-soft text-ai ring-ai/20"
                    : "bg-amber-50 text-amber-800 ring-amber-200",
                )}
              />
            }
          >
            <Sparkles className="size-3.5" aria-hidden />
            {aiLabel}
          </TooltipTrigger>
          <TooltipContent>
            {aiInfo.provider === "mock"
              ? "開発用のモックAI（キーワード判定）で動作中です"
              : aiInfo.configured
                ? "依頼の分析に実際のOpenAI APIを使用しています"
                : "OPENAI_API_KEY が設定されていません"}
          </TooltipContent>
        </Tooltip>
        <span className="hidden items-center gap-1.5 text-sm font-medium text-muted-foreground sm:inline-flex">
          <Building2 className="size-4" aria-hidden />
          NEXORA株式会社
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="inline-flex h-6 items-center rounded-md bg-amber-100 px-2 text-[11px] font-bold tracking-wider text-amber-800 ring-1 ring-amber-300 ring-inset" />
            }
          >
            DEMO
          </TooltipTrigger>
          <TooltipContent className="max-w-64">
            デモ環境です。Gmail・Slackには接続しておらず、受信と送信はシミュレーションです。AIによる分析とワークフロー処理は実際に動作します。操作内容はこのブラウザだけに保存され、ほかの人には見えません。
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}

export function SideNav({
  view,
  onChange,
  counts,
  onReset,
  resetting,
}: {
  view: View;
  onChange: (view: View) => void;
  counts: Partial<Record<View, number>>;
  onReset: () => void;
  resetting: boolean;
}) {
  return (
    <nav aria-label="メインメニュー" className="hidden w-56 shrink-0 flex-col border-r bg-sidebar p-3 md:flex">
      <ul className="space-y-0.5">
        {NAV_ITEMS.map(({ view: v, label, icon: Icon }) => {
          const active = v === view;
          return (
            <li key={v}>
              <button
                type="button"
                onClick={() => onChange(v)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-muted",
                )}
              >
                <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
                {label}
                {counts[v] ? (
                  <span
                    className={cn(
                      "ml-auto rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {counts[v]}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto space-y-3">
        <div className="rounded-xl border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground">DEMO MODE</p>
          メール・Slack・フォームの受信と返信の送信はシミュレーションです。AIの分析とワークフローは実際に動作します。
          <span className="mt-1.5 block">あなたの操作はこのブラウザだけに保存され、ほかの人の画面には反映されません。</span>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={onReset} disabled={resetting}>
          <RotateCcw data-icon="inline-start" className={cn(resetting && "animate-spin")} />
          デモデータを初期状態に戻す
        </Button>
      </div>
    </nav>
  );
}

export function MobileNav({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  return (
    <nav
      aria-label="メインメニュー"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {NAV_ITEMS.map(({ view: v, label, icon: Icon }) => {
        const active = v === view;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-current={active ? "page" : undefined}
            className={cn("flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
