import type { Category, Confidence, Priority, RequestStatus, ReviewState, SourceType } from "./domain";
import type { AiErrorCode } from "./ai/errors";
import type { AnalysisStepKey } from "./ai/steps";
import type { SourceMetadata } from "./ingestion";

// サーバー → クライアントに渡すデータの形（日付は ISO 文字列）

export type MemberDTO = {
  id: string;
  name: string;
  department: string;
  role: string;
  responsibilities: string[];
};

export type ActivityDTO = {
  id: string;
  type: string;
  actor: "ai" | "human" | "system";
  description: string;
  createdAt: string;
};

/** 関連する依頼へのリンク表示用 */
export type RequestLinkDTO = {
  id: string;
  title: string;
  receivedAt: string;
  assigneeId: string | null;
  status: RequestStatus;
};

export type AnalysisDTO = {
  provider: string;
  model: string;
  assigneeConfidence: Confidence;
  latencyMs: number | null;
  createdAt: string;
  intent: string | null;
  /** 過去の依頼と照合した結果の説明 */
  relationReasoning: string | null;
  priorityReason: string | null;
  assigneeReasoning: string | null;
  /** AI が最初に提案した担当者（人が変更しても残る） */
  suggestedAssigneeId: string | null;
  dueSourceText: string | null;
  missingInformation: string[];
};

export type RequestDTO = {
  id: string;
  title: string;
  sourceType: SourceType;
  sourceMetadata: SourceMetadata;
  requesterName: string;
  originalMessage: string;
  summary: string;
  category: Category;
  priority: Priority;
  assigneeId: string | null;
  reviewState: ReviewState;
  dueDate: string | null;
  nextAction: string;
  replySubject: string;
  replyDraft: string;
  replySentAt: string | null;
  status: RequestStatus;
  /** AI が「この依頼の元になった」と判断した過去の依頼 */
  relatedRequest: RequestLinkDTO | null;
  receivedAt: string;
  updatedAt: string;
  analysis: AnalysisDTO | null;
  activities: ActivityDTO[];
};

/** /api/analyze がストリームで返すイベント（NDJSON 1 行 = 1 イベント） */
export type AnalyzeEvent =
  | { type: "step"; step: AnalysisStepKey }
  | { type: "done"; request: RequestDTO }
  | { type: "error"; code: AiErrorCode; detail?: string };
