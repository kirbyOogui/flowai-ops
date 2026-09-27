import { z } from "zod";
import type { SourceType } from "@/lib/domain";

// 受付元（Source）ごとの入力を、AI Pipeline が扱う共通形式 NormalizedMessage に揃える層。
// 現在は DEMO 用の Simulator 入力のみだが、Gmail API / Slack Events API などの本物の
// アダプタを追加する場合も、ここに SourceAdapter を 1 つ足すだけで以降の処理は変わらない。

const text = (label: string, max: number) =>
  z
    .string({ error: `${label}を入力してください` })
    .trim()
    .min(1, `${label}を入力してください`)
    .max(max, `${label}は${max}文字以内で入力してください`);

export const sourceInputSchema = z.discriminatedUnion("sourceType", [
  z.object({
    sourceType: z.literal("email"),
    sender: text("差出人", 120),
    subject: text("件名", 200),
    body: text("本文", 5000),
  }),
  z.object({
    sourceType: z.literal("slack"),
    author: text("投稿者", 80),
    channel: text("チャンネル", 80),
    message: text("メッセージ", 5000),
  }),
  z.object({
    sourceType: z.literal("form"),
    requester: text("依頼者", 120),
    subject: text("件名", 200),
    content: text("依頼内容", 5000),
  }),
]);

export type SourceInput = z.infer<typeof sourceInputSchema>;

/** Request.sourceMetadata に保存する受付元ごとの付帯情報 */
export type SourceMetadata =
  | { sourceType: "email"; from: string; subject: string }
  | { sourceType: "slack"; author: string; channel: string }
  | { sourceType: "form"; requester: string; subject: string; formName: string };

export type NormalizedMessage = {
  sourceType: SourceType;
  requesterName: string;
  /** 件名がない Source（Slack）は null */
  subject: string | null;
  body: string;
  metadata: SourceMetadata;
  receivedAt: Date;
};

type SourceAdapter<T extends SourceInput> = (input: T, receivedAt: Date) => NormalizedMessage;

const normalizeChannel = (channel: string) => `#${channel.replace(/^#+/, "")}`;

const adapters: { [K in SourceType]: SourceAdapter<Extract<SourceInput, { sourceType: K }>> } = {
  email: (input, receivedAt) => ({
    sourceType: "email",
    requesterName: input.sender,
    subject: input.subject,
    body: input.body,
    metadata: { sourceType: "email", from: input.sender, subject: input.subject },
    receivedAt,
  }),
  slack: (input, receivedAt) => ({
    sourceType: "slack",
    requesterName: input.author,
    subject: null,
    body: input.message,
    metadata: { sourceType: "slack", author: input.author, channel: normalizeChannel(input.channel) },
    receivedAt,
  }),
  form: (input, receivedAt) => ({
    sourceType: "form",
    requesterName: input.requester,
    subject: input.subject,
    body: input.content,
    metadata: {
      sourceType: "form",
      requester: input.requester,
      subject: input.subject,
      formName: "社内依頼フォーム",
    },
    receivedAt,
  }),
};

export function normalize(input: SourceInput, receivedAt: Date = new Date()): NormalizedMessage {
  const adapter = adapters[input.sourceType] as SourceAdapter<SourceInput>;
  return adapter(input, receivedAt);
}

/** 画面表示・AI入力用に、受付元の情報を 1 行で表す */
export function describeOrigin(metadata: SourceMetadata): string {
  switch (metadata.sourceType) {
    case "email":
      return `メール / 差出人: ${metadata.from}`;
    case "slack":
      return `Slack / ${metadata.channel} / 投稿者: ${metadata.author}`;
    case "form":
      return `${metadata.formName} / 依頼者: ${metadata.requester}`;
  }
}
