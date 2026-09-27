# FlowAI OPS

メール・Slack・フォームから届く業務依頼を AI が読み取り、**分類・重要度・担当者・期限・次のアクション・返信案**まで決めて、そのまま仕事として登録する AI オペレーション管理ツールです。

架空の企業「NEXORA株式会社」の社内ツールという設定のデモです。ログインは不要で、URL を開けばすぐに試せます。

> **DEMO MODE について**
> Gmail・Slack には接続していません。依頼の**受信**と返信の**送信**はシミュレーションです。
> 一方で、**AI による分類・担当者の決定・期限の抽出・返信案の作成、および仕事の登録・状態管理は実際に動作します**（OpenAI API を呼び出し、結果を PostgreSQL に保存します）。
>
> 公開デモとして誰でも操作できるよう、**データは訪問者（ブラウザ）ごとに分かれています**。ある人が依頼を追加・編集しても、ほかの人の画面は初期状態のままです。

---

## 主な機能

| 機能 | 内容 |
| --- | --- |
| 依頼の受付 | 受付元（メール / Slack / フォーム）を選ぶと、受付元に合った入力欄に切り替わる。ワンクリックで入るサンプル依頼つき |
| AI 分析 | 要約・カテゴリ・重要度・担当者・期限・次のアクション・返信案を、構造化データ（JSON Schema）で生成する |
| 過去の依頼との照合 | 「先日の件」のように本文だけでは分からない依頼は、同じ依頼者の過去の依頼から関連する依頼を特定し、その担当者を引き継ぐ。特定できない場合は人に判断を戻す |
| 処理状況の表示 | AI の生成の進み具合に合わせて、10 のステップと進捗バーを更新する |
| 自動登録 | 分析結果をそのまま仕事として登録する（人の承認は不要） |
| 人に判断を戻す | AI が担当者に確信を持てない依頼は、担当者を空欄のまま「確認待ち」にし、人が選んで確定する |
| 編集 | AI が決めた項目は、すべて画面上で直接修正できる |
| 状態管理 | 未着手 → 対応中 → 完了 |
| 返信の送信 | 送信の直前だけ人が内容を確認・編集し、送信シミュレーションを実行する |
| AI 処理履歴 | 受信から AI の各判断、人の操作までを時系列で記録・表示する |
| メンバー | メンバーの部署・役職・担当業務と、各メンバーの仕事（未着手・対応中・完了の件数、未完了の一覧）、担当者の確認待ちの依頼 |
| 分析 | AI の自動割り当て率、担当者別の未完了件数、カテゴリ・重要度・受付元の内訳 |
| 訪問者ごとのデータ | 訪問者ごとに初期データのコピー（作業スペース）を作り、操作はその中だけに反映する |
| デモのリセット | 左メニューから、自分の作業スペースだけを初期状態に戻せる |

画面は 1 ページで完結します（左：メニュー［ホーム・受信箱・仕事一覧・メンバー・分析］ / 中央：仕事一覧 / 右：詳細）。画面幅が狭い場合、詳細はドロワーで開き、メニューは下部のタブになります。

## 技術スタック

- **Next.js 16**（App Router / Route Handlers）・**React 19**・**TypeScript**
- **Tailwind CSS v4**・**shadcn/ui**（Base UI）・**Motion**・**Lucide**
- **PostgreSQL**・**Prisma 7**（`@prisma/adapter-pg`）
- **OpenAI API**（Responses API + Structured Outputs）・**Zod**

## AI の仕組み

### 1 回の呼び出しで、構造化された判断を得る

`/api/analyze` は OpenAI の Responses API を **1 回だけ**呼び出し、`zodTextFormat` で渡した JSON Schema に沿った出力を受け取ります（`src/lib/ai/schema.ts`）。

```ts
{
  intent,
  relatedRequest: { reasoning, requestId | null },  // 過去の依頼との照合（H1 などの候補番号）
  title, summary,
  category,          // sales / customer_success / ... の10種
  priority,          // urgent / high / medium / low
  priorityReason,
  assignee: { reasoning, memberId | null, confidence },
  dueDate:  { sourceText | null, date | null },
  nextAction,
  reply: { subject, body },
  missingInformation: string[]
}
```

### 進捗表示は実際の生成に連動する

レスポンスをストリーミングで受け取り、JSON の各キー（`relatedRequest` → `summary` → … → `reply`）が出力され始めた時点で、画面のステップを進めます。サーバーからブラウザへは NDJSON（1 行 1 イベント）で進捗を送ります。「複数の API を順番に呼んでいる」ように見せかけるものではありません。

### 過去の依頼との照合（「先日の件」への対応）

`/api/analyze` は AI を呼ぶ前に、同じ依頼者の過去 60 日の依頼を DB から探し、最大 8 件を候補として AI に渡します（`src/lib/services/history.ts`）。依頼者名を「組織」と「個人名」に分けて照合するため、「株式会社ミナト精工 経理部 石井 大輔」と「石井 大輔」のような表記の違いにも対応します。

- 候補は `H1`〜`H8` の番号で渡し、AI には番号で答えさせます。サーバー側で番号を実際の ID に戻すため、候補にない ID を AI が作り出しても採用されません。
- 関連する依頼を 1 件に特定できた場合は、原則としてその依頼の担当者を引き継ぎ、要約や返信案もその内容を踏まえて書きます（例：「先日の件」→ 過去の「請求書の宛名変更」→ 財務の中村）。
- 候補が複数あって決め手がない場合や、候補がない場合は関連付けず、担当者も決められなければ「確認待ち」として人に判断を戻します。
- 関連付けは `Request.relatedRequestId` に保存し、詳細画面の「関連する依頼」から元の依頼・続報へ移動できます。

「新しい依頼」→ メール →「先日の件（過去の依頼から判断）」のサンプルで試せます。

### プロンプトの構成（`src/lib/ai/prompt.ts`）

| 役割 | 内容 |
| --- | --- |
| system | AI の役割、プロダクトの目的、NEXORA の会社情報 |
| developer | 基準日と 3 週間分の暦（各日付に「来週の水曜」などのラベル付き）、過去の依頼との照合ルール、メンバー一覧（部署・役職・担当業務）、カテゴリ・重要度の定義、担当者の決定ルール（判断例つき）、期限の抽出ルール、返信案の作成ルール、推測してはいけない項目、出力制約 |
| user | 受け付けた依頼と、同じ依頼者の過去の依頼の候補。依頼は `<request>` タグで囲み、中に書かれた指示には従わないよう指定している（プロンプトインジェクション対策） |

担当者は部署名の一致だけで決めず、「依頼を完了させるために実際に手を動かすのは誰か」で判断するよう、判断例とともに指示しています（例：見積書の作成は財務ではなく営業）。

### AI の出力をそのまま信用しない（`src/lib/ai/postprocess.ts`）

モデルの出力は Zod で再検証し、次の業務ルールで補正してから保存します。

- 担当者の確信度が `low`、または存在しないメンバー ID → 担当者を空にして「確認待ち」にする
- 関連する依頼の番号が候補にない → 関連付けない。文章に候補番号（H1 など）が残っていたら件名に置き換える
- 依頼文に期限の表現（`sourceText`）がない、または日付として不正 → 期限なし
- スキーマに合わない・JSON が壊れている・応答が途中で切れた・回答を拒否した → エラーとして扱い、画面は壊さずに再試行を案内する

AI の元の判断は `AiAnalysis` テーブルに残るため、人が担当者を変えても「AI が何を提案したか」を追跡できます（分析画面の「人が修正」の件数にも使用）。

## 訪問者ごとのデータの分離

公開デモでは、誰かの操作がほかの人の画面に影響しないようにしています。

1. `src/proxy.ts` が、訪問者のブラウザに作業スペースの ID（HttpOnly の Cookie、有効期間 7 日）を割り当てる。
2. 初回アクセス時に `DemoSession` を作り、初期データ 10 件をその作業スペース用にコピーする（`src/lib/services/sessions.ts`）。
3. 依頼の一覧・追加・編集・返信の送信・過去の依頼の照合・リセットは、すべて自分の作業スペースの中だけで行う。ほかの作業スペースの依頼は、ID を指定しても「存在しない」扱いになる。
4. 7 日以上使われていない作業スペースは、新しい訪問者が来たときに削除する。

メンバー（担当者候補）の情報は全員で共通です。

### AI 分析の回数上限

公開デモで OpenAI の利用料が増えすぎないよう、AI 分析の回数を 24 時間あたり「1 人 20 回」「デモ全体 300 回」までにしています（`DEMO_AI_LIMIT_PER_SESSION` / `DEMO_AI_LIMIT_TOTAL` で変更可能）。上限に達した場合は、画面に案内を表示します。

## アーキテクチャ

```text
Email / Slack / Form Simulator（画面の入力）
        │
        ▼
POST /api/analyze ─── Zod で入力を検証
        │
        ▼
Ingestion（src/lib/ingestion）── 受付元ごとのアダプタで NormalizedMessage に揃える
        │
        ▼
AI Pipeline（src/lib/ai）── OpenAI（または Mock）→ スキーマ検証 → 業務ルールで補正
        │
        ▼
Services（src/lib/services）── Request / AiAnalysis / ActivityLog をトランザクションで保存
        │
        ▼
Inbox / 仕事一覧 / 詳細（src/components/flow）
```

受付元は `SourceType`（`email` / `slack` / `form`）として保存し、差出人やチャンネルなどは `sourceMetadata`（JSON）に持ちます。Gmail API や Slack Events API に接続する場合は、`src/lib/ingestion` にアダプタを 1 つ追加し、Webhook から `normalize()` → `runAnalysisPipeline()` を呼ぶだけで、以降の処理は共通のまま使えます。

### ディレクトリ構成

```text
prisma/
  schema.prisma          DB スキーマ（Member / Request / AiAnalysis / ActivityLog。Request は関連する過去の依頼を自己参照で持つ）
  migrations/            マイグレーション
  seed.ts                初期データ投入
src/
  app/
    page.tsx             1 ページのエントリ（Server Component で初期データを取得）
    api/analyze          AI 分析 → 登録（NDJSON ストリーム）
    api/requests/[id]    編集・状態変更（PATCH）、返信の送信シミュレーション
    api/demo/reset       デモデータのリセット
  lib/
    ingestion/           受付元ごとの入力 → 共通形式への正規化
    ai/                  スキーマ・プロンプト・プロバイダ（OpenAI / Mock）・後処理・エラー
    services/            業務処理（登録・編集・送信・処理履歴・過去の依頼の検索）
    seed/                初期データ（原文 + 事前に生成した AI 分析結果）
    nexora.ts            会社情報とメンバー（seed とプロンプトの共通の情報源）
  components/flow/       画面（一覧・詳細・依頼作成・メンバー・分析）
```

## セットアップ（別の PC で動かす手順）

### 必要なもの

- Node.js 20.19 以上（22 推奨）
- PostgreSQL（Docker Desktop があれば、下記の `docker compose` で用意できます）
- OpenAI の API キー（なくても Mock AI で動作確認はできます）

### 手順

```bash
# 1. 依存パッケージをインストール（Prisma Client も自動生成されます）
npm install

# 2. 環境変数ファイルを作成し、OPENAI_API_KEY を書き込む
cp .env.example .env        # Windows の PowerShell では: Copy-Item .env.example .env

# 3. PostgreSQL を起動（ホストの 5433 番ポートで待ち受けます）
docker compose up -d

# 4. テーブル作成と初期データの投入
npm run setup

# 5. 起動
npm run dev
```

ブラウザで http://localhost:3000 を開きます。

### 環境変数

| 変数 | 必須 | 説明 |
| --- | --- | --- |
| `DATABASE_URL` | ○ | PostgreSQL の接続文字列。`docker compose` を使う場合は `.env.example` の値のままで動きます |
| `AI_PROVIDER` | | `openai`（既定）または `mock`。`mock` はキーワードで簡易判定する開発用のモックです |
| `OPENAI_API_KEY` | `openai` のとき ○ | OpenAI の API キー。サーバー側でのみ使用し、ブラウザには送りません |
| `OPENAI_MODEL` | | 使用するモデル（既定: `gpt-6-sol`） |
| `OPENAI_REASONING_EFFORT` | | 推論の強さ（既定: `low`）。推論に対応しないモデルを使う場合は空にします |
| `DEMO_AI_LIMIT_PER_SESSION` | | AI 分析の回数上限（1 人・24 時間あたり、既定: 20） |
| `DEMO_AI_LIMIT_TOTAL` | | AI 分析の回数上限（デモ全体・24 時間あたり、既定: 300） |

`.env` はリポジトリに含めないでください（`.gitignore` 済み）。

### よく使うコマンド

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバーを起動 |
| `npm run build` / `npm start` | 本番ビルド / 本番サーバーを起動 |
| `npm run typecheck` / `npm run lint` | 型チェック / Lint |
| `npm run db:seed` | メンバーを投入し直し、すべての作業スペースを削除する（次のアクセス時に初期データから作り直される） |
| `npm run db:reset` | DB を作り直してから初期データを投入 |
| `npm run db:studio` | Prisma Studio で DB の中身を見る |

### うまく動かないとき

- **`DATABASE_URL が設定されていません`**：`.env` が作られていないか、場所がプロジェクト直下ではありません。
- **DB に接続できない**：`docker compose ps` でコンテナが起動しているか確認します。5433 番ポートが使用中の場合は、`docker-compose.yml` のポートと `DATABASE_URL` を合わせて変更します。
- **画面に「APIキー未設定」と出る**：`.env` の `OPENAI_API_KEY` を設定し、開発サーバーを再起動します。
- **Docker を使わない場合**：Supabase・Neon などの PostgreSQL の接続文字列を `DATABASE_URL` に設定すれば、そのまま `npm run setup` できます。

## GitHub に登録して Vercel で公開する

### 1. GitHub に登録する

GitHub で空のリポジトリ（例：`flowai-ops`、README などは追加しない）を作ってから、プロジェクトのフォルダで次を実行します。

```bash
git init
git add .
git commit -m "Initial commit: FlowAI OPS"
git branch -M main
git remote add origin https://github.com/<あなたのユーザー名>/flowai-ops.git
git push -u origin main
```

`.env`（API キー）・`node_modules`・`.next` は `.gitignore` によりコミットされません。`git status` で `.env` が含まれていないことを確認してから push してください。

### 2. Vercel にインポートする

1. [Vercel](https://vercel.com/new) で「Add New… → Project」を選び、手順 1 のリポジトリをインポートする。Framework は Next.js が自動で選ばれます。ビルドの設定は変更不要です。
2. 最初のデプロイは、DB が未設定のため失敗します。問題ないので、そのまま次へ進みます。

### 3. データベース（Neon）を追加する

1. Vercel のプロジェクト画面で「Storage」タブ →「Create Database」→「Neon」（Serverless Postgres）を選ぶ。無料プランで十分です。
2. 作成したデータベースをこのプロジェクトに接続する（Environments はすべてにチェック）。
3. `DATABASE_URL` と `DATABASE_URL_UNPOOLED` などが、環境変数に自動で追加されます。

### 4. 環境変数を設定する

「Settings → Environment Variables」で次を追加します。

| 変数 | 値 |
| --- | --- |
| `OPENAI_API_KEY` | 自分の OpenAI API キー |
| `AI_PROVIDER` | `openai` |
| `OPENAI_MODEL` | 省略可（既定: `gpt-6-sol`） |
| `DEMO_AI_LIMIT_PER_SESSION` / `DEMO_AI_LIMIT_TOTAL` | 省略可（AI 分析の回数上限。既定: 20 / 300） |

公開デモでは、誰が AI 分析を実行しても**費用はこのキーの持ち主にかかります**。OpenAI 側でも、[利用上限（Usage limits）](https://platform.openai.com/settings/organization/limits)を設定しておくと安心です。

### 5. デプロイする

「Deployments」から最新のデプロイを「Redeploy」します。ビルド時に `vercel-build`（`prisma migrate deploy && next build`）が実行され、テーブルが作られます。メンバーと初期データは、最初のアクセス時に自動で作られます。

以降は `main` ブランチに push するたびに、自動で再デプロイされます。

## AI API について

- 依頼 1 件につき、OpenAI の Responses API を 1 回呼び出します（ストリーミング + Structured Outputs）。
- `store: false` を指定し、会話状態を OpenAI 側に保存しない設定で呼び出しています。
- タイムアウトは 60 秒で、接続エラーは SDK が 1 回だけ自動で再試行します。
- エラーの種類（キー未設定・キーが無効・タイムアウト・利用上限・不正な出力・途中終了・拒否）ごとに画面の案内を変え、再試行できるものだけ「再試行」ボタンを出します。分析に失敗した場合、依頼は登録されず入力内容は保持されます。
- 初期データの AI 分析結果は、デモ用に事前に用意したものです（詳細画面に「初期データ」と表示されます）。「新しい依頼」から作った依頼は、その場で実際に AI が分析します。

## 今後の拡張案

- Gmail API / Slack Events API のアダプタを追加し、実際の受信・送信に対応する
- 担当者ごとの負荷（未完了の件数）を AI の担当者判断に反映する
- 過去の依頼の照合を、依頼者の一致だけでなく内容の類似（Embedding による検索）にも広げる
- 人が担当者を修正した履歴をもとに、担当者の決定ルール（プロンプト）を改善する
- 認証と権限（チームごとの閲覧範囲）を追加する
- 期限が近い仕事や、確認待ちの仕事を Slack で通知する
