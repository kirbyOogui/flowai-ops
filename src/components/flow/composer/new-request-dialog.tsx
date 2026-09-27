"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, CheckCircle2, CircleAlert, ExternalLink, Plus, RotateCw, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AI_ERROR_INFO, type AiErrorCode } from "@/lib/ai/errors";
import type { AnalysisStepKey } from "@/lib/ai/steps";
import { AnalyzeError, analyzeRequest } from "@/lib/client/api";
import { SOURCE_LABEL, SOURCE_TYPES, type SourceType } from "@/lib/domain";
import type { SourceInput } from "@/lib/ingestion";
import type { RequestDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AnalysisFields } from "../analysis-fields";
import { AiMark, PriorityBadge, SOURCE_ICON, SourceBadge } from "../badges";
import { useWorkspace } from "../workspace-context";
import { AnalysisProgress } from "./analysis-progress";
import { SAMPLES } from "./samples";

type FieldDef = { name: string; label: string; placeholder: string; multiline?: boolean };

// 受付元ごとの入力項目。キーは sourceInputSchema のフィールド名と一致させる
const FIELDS: Record<SourceType, FieldDef[]> = {
  email: [
    { name: "sender", label: "差出人", placeholder: "例：Asteria Inc. 山口 真由" },
    { name: "subject", label: "件名", placeholder: "例：Proプランへの変更とお見積書のお願い" },
    { name: "body", label: "本文", placeholder: "メール本文を入力してください", multiline: true },
  ],
  slack: [
    { name: "author", label: "投稿者", placeholder: "例：高橋 翔" },
    { name: "channel", label: "チャンネル", placeholder: "例：marketing" },
    { name: "message", label: "メッセージ", placeholder: "Slackのメッセージを入力してください", multiline: true },
  ],
  form: [
    { name: "requester", label: "依頼者", placeholder: "例：マーケティング部 大野 さくら" },
    { name: "subject", label: "件名", placeholder: "例：新LP用バナー制作のお願い" },
    { name: "content", label: "依頼内容", placeholder: "依頼内容を入力してください", multiline: true },
  ],
};

const SOURCE_HINT: Record<SourceType, string> = {
  email: "顧客・取引先からのメール",
  slack: "社内チャンネルの投稿",
  form: "社内依頼フォーム",
};

type Drafts = Record<SourceType, Record<string, string>>;
const emptyDrafts = (): Drafts => ({ email: {}, slack: {}, form: {} });

type Phase =
  | { name: "input" }
  | { name: "analyzing"; step: AnalysisStepKey | null }
  | { name: "finishing" }
  | { name: "failed"; step: AnalysisStepKey | null; code: AiErrorCode }
  | { name: "done"; requestId: string };

export function NewRequestDialog({
  open,
  onOpenChange,
  requests,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requests: RequestDTO[];
  onCreated: (request: RequestDTO) => void;
}) {
  const { aiInfo, selectRequest } = useWorkspace();
  const [source, setSource] = useState<SourceType>("email");
  const [drafts, setDrafts] = useState<Drafts>(emptyDrafts);
  const [phase, setPhase] = useState<Phase>({ name: "input" });
  const abortRef = useRef<AbortController | null>(null);

  const fields = FIELDS[source];
  const values = drafts[source];
  const complete = fields.every((f) => values[f.name]?.trim());
  const aiUnavailable = aiInfo.provider === "openai" && !aiInfo.configured;

  const setValue = (name: string, value: string) =>
    setDrafts((d) => ({ ...d, [source]: { ...d[source], [name]: value } }));

  const applySample = (input: SourceInput) => {
    const { sourceType, ...rest } = input;
    setDrafts((d) => ({ ...d, [sourceType]: rest as Record<string, string> }));
  };

  const reset = () => {
    abortRef.current?.abort();
    setDrafts(emptyDrafts());
    setPhase({ name: "input" });
  };

  const handleOpenChange = (next: boolean) => {
    // 分析中に閉じると「登録されたか分からない」状態になるため、完了か失敗まで待つ
    if (!next && (phase.name === "analyzing" || phase.name === "finishing")) return;
    if (!next) {
      // 分析結果を見た後に閉じたら、次回は空の状態から始める
      if (phase.name === "done") setTimeout(reset, 200);
      else if (phase.name !== "input") setPhase({ name: "input" });
    }
    onOpenChange(next);
  };

  const analyze = async () => {
    if (!complete) return;
    const controller = new AbortController();
    abortRef.current = controller;
    let lastStep: AnalysisStepKey | null = null;
    setPhase({ name: "analyzing", step: null });
    try {
      const created = await analyzeRequest({ sourceType: source, ...values } as SourceInput, {
        signal: controller.signal,
        onStep: (step) => {
          lastStep = step;
          setPhase({ name: "analyzing", step });
        },
      });
      onCreated(created);
      // 全ステップ完了（100%）を一瞬見せてから結果に切り替える
      setPhase({ name: "finishing" });
      await new Promise((r) => setTimeout(r, 650));
      if (controller.signal.aborted) return;
      setPhase({ name: "done", requestId: created.id });
    } catch (error) {
      if (controller.signal.aborted) return;
      setPhase({ name: "failed", step: lastStep ?? "read", code: error instanceof AnalyzeError ? error.code : "api_error" });
    }
  };

  const created = phase.name === "done" ? requests.find((r) => r.id === phase.requestId) : undefined;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl" showCloseButton={phase.name !== "analyzing" && phase.name !== "finishing"}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AiMark label="AI自動振り分け" />
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-800">DEMO MODE</span>
          </div>
          <DialogTitle className="text-base">
            {phase.name === "done" ? "AI分析結果" : "新しい依頼"}
          </DialogTitle>
          <DialogDescription>
            {phase.name === "done"
              ? "AIが決めた内容で仕事として登録しました。必要なら、ここで直接修正できます。"
              : "受付元を選んで依頼を入力すると、AIが分類・重要度・担当者・期限・次のアクション・返信案を決めて仕事として登録します。"}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait" initial={false}>
          {phase.name === "input" && (
            <motion.div key="input" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="grid gap-5">
              <fieldset>
                <legend className="mb-2 text-xs font-semibold text-muted-foreground">依頼の受付元</legend>
                <div role="radiogroup" className="grid grid-cols-3 gap-2">
                  {SOURCE_TYPES.map((s) => {
                    const Icon = SOURCE_ICON[s];
                    const active = source === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setSource(s)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all sm:flex-row sm:text-left",
                          active ? "border-primary bg-accent ring-1 ring-primary/40" : "hover:border-primary/30 hover:bg-muted/50",
                        )}
                      >
                        <Icon className={cn("size-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{SOURCE_LABEL[s]}</span>
                          <span className="hidden text-[11px] text-muted-foreground sm:block">{SOURCE_HINT[s]}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Wand2 className="size-3.5" aria-hidden />
                  サンプルを入力：
                </span>
                {SAMPLES[source].map((sample) => (
                  <Button key={sample.label} variant="outline" size="xs" onClick={() => applySample(sample.input)}>
                    {sample.label}
                  </Button>
                ))}
              </div>

              <motion.div key={source} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-3">
                {fields.map((f) => (
                  <div key={f.name} className="grid gap-1.5">
                    <Label htmlFor={`field-${f.name}`}>
                      {f.label}
                      <span className="text-destructive" aria-hidden>
                        *
                      </span>
                    </Label>
                    {f.multiline ? (
                      <Textarea
                        id={`field-${f.name}`}
                        value={values[f.name] ?? ""}
                        onChange={(e) => setValue(f.name, e.target.value)}
                        placeholder={f.placeholder}
                        rows={7}
                        maxLength={5000}
                        required
                      />
                    ) : (
                      <Input
                        id={`field-${f.name}`}
                        value={values[f.name] ?? ""}
                        onChange={(e) => setValue(f.name, e.target.value)}
                        placeholder={f.placeholder}
                        maxLength={200}
                        required
                      />
                    )}
                  </div>
                ))}
              </motion.div>

              {aiUnavailable && (
                <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {AI_ERROR_INFO.missing_api_key.title}。{AI_ERROR_INFO.missing_api_key.message}
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center">
                <p className="text-xs text-muted-foreground sm:mr-auto">
                  {aiInfo.provider === "mock" ? "Mock AI（キーワード判定・開発用）で分析します" : `OpenAI ${aiInfo.model} で分析します`}
                </p>
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  キャンセル
                </Button>
                <Button onClick={analyze} disabled={!complete || aiUnavailable}>
                  <Sparkles data-icon="inline-start" />
                  AIで分析する
                </Button>
              </div>
            </motion.div>
          )}

          {(phase.name === "analyzing" || phase.name === "finishing" || phase.name === "failed") && (
            <motion.div key="progress" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-5">
              <AnalysisProgress
                active={phase.name === "finishing" ? "register" : phase.step}
                phase={phase.name === "failed" ? "failed" : phase.name === "finishing" ? "done" : "running"}
              />
              {phase.name === "failed" && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="alert"
                  className="rounded-xl border border-destructive/30 bg-destructive/5 p-4"
                >
                  <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
                    <CircleAlert className="size-4" aria-hidden />
                    {AI_ERROR_INFO[phase.code].title}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{AI_ERROR_INFO[phase.code].message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">入力内容は保持されています。依頼はまだ登録されていません。</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPhase({ name: "input" })}>
                      <ArrowLeft data-icon="inline-start" />
                      入力に戻る
                    </Button>
                    {AI_ERROR_INFO[phase.code].retryable && (
                      <Button size="sm" onClick={analyze}>
                        <RotateCw data-icon="inline-start" />
                        再試行
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {phase.name === "done" && created && (
            <motion.div key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4">
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                <span className="font-medium">仕事として登録しました</span>
                <span className="text-xs text-emerald-700">
                  {created.reviewState === "needs_review" ? "（担当者のみ確認待ち）" : "（担当者に自動で割り当て済み）"}
                </span>
              </div>

              <div className="rounded-xl border border-ai/15">
                <div className="flex flex-wrap items-center gap-2 border-b border-ai/10 bg-gradient-to-r from-ai-soft/80 to-transparent px-4 py-3">
                  <SourceBadge source={created.sourceType} />
                  <PriorityBadge priority={created.priority} />
                  <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{created.title}</h3>
                </div>
                <div className="px-4">
                  <AnalysisFields request={created} />
                  <div className="grid gap-1.5 border-t py-3 sm:grid-cols-[7.5rem_1fr] sm:gap-3">
                    <span className="text-xs font-medium text-muted-foreground">返信案</span>
                    <p className="line-clamp-4 rounded-lg bg-muted/60 p-3 text-[13px] leading-relaxed whitespace-pre-wrap">{created.replyDraft}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={reset}>
                  <Plus data-icon="inline-start" />
                  続けて依頼を作成
                </Button>
                <Button
                  onClick={() => {
                    selectRequest(created.id);
                    handleOpenChange(false);
                  }}
                >
                  <ExternalLink data-icon="inline-start" />
                  詳細を開いて返信を確認
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
