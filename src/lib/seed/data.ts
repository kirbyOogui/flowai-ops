import type { AnalysisOutput } from "@/lib/ai/schema";
import type { Confidence, RequestStatus } from "@/lib/domain";
import type { SourceInput } from "@/lib/ingestion";

// 初期データ。各依頼は「受信した原文」と「その原文に対して AI が出した分析結果」の組で持つ。
// 分析結果は Request の各項目と AiAnalysis（provider: seed）の両方に反映され、
// 新規の依頼と同じく AI Processing Trace に表示される。
// dueDate.date は seed 実行時に dueDate.sourceText から算出する（いつ開いても自然な日付になるように）。

export type SeedRequest = {
  input: SourceInput;
  receivedMinutesAgo: number;
  latencyMs: number;
  analysis: Omit<AnalysisOutput, "dueDate" | "relatedRequest"> & {
    dueDate: { sourceText: string | null };
    /** 過去の依頼との照合結果。省略時は「単独で完結した新規の依頼」 */
    relatedRequest?: { reasoning: string };
  };
  confidence: Confidence;
  status: RequestStatus;
  replySent?: boolean;
};

export const SEED_REQUESTS: SeedRequest[] = [
  {
    input: {
      sourceType: "email",
      sender: "Asteria Inc. 山口 真由",
      subject: "Proプランへの変更とお見積書のお願い",
      body: `NEXORA株式会社
ご担当者様

いつもお世話になっております。Asteria Inc.の山口です。

現在Starterプラン（30ID）を利用しておりますが、利用部署の拡大に伴い、Proプランへの変更を検討しております。
50IDでご利用した場合のお見積書を、今日中にお送りいただけますでしょうか。
明日の社内稟議にかける予定です。

よろしくお願いいたします。`,
    },
    receivedMinutesAgo: 25,
    latencyMs: 5200,
    confidence: "high",
    status: "todo",
    analysis: {
      intent: "Proプラン（50ID）へ変更する場合の見積書を本日中に受け取りたい",
      title: "Proプラン変更に伴う見積書作成",
      summary: "Asteria社がStarter（30ID）からPro（50ID）への変更を検討。明日の稟議用に本日中の見積書送付を希望。",
      category: "sales",
      priority: "high",
      priorityReason: "既存顧客のアップセルで本日中の期限あり",
      assignee: {
        reasoning: "見積作成と顧客提案は営業の担当。財務処理は発生前の段階",
        memberId: "tanaka",
        confidence: "high",
      },
      dueDate: { sourceText: "今日中" },
      nextAction: "Proプラン50IDの見積書を作成し、本日中に山口様へ送付する。",
      reply: {
        subject: "Re: Proプランへの変更とお見積書のお願い",
        body: `Asteria Inc.
山口 真由様

いつもお世話になっております。NEXORA株式会社です。
Proプランへの変更のご検討、誠にありがとうございます。

50IDでご利用の場合のお見積書を作成し、本日中にお送りいたします。
担当は営業の田中が務めます。ご不明点がございましたらお気軽にお申し付けください。

引き続きよろしくお願いいたします。

NEXORA株式会社`,
      },
      missingInformation: ["契約期間（月額・年額）の希望"],
    },
  },
  {
    input: {
      sourceType: "email",
      sender: "株式会社オルビス 情報システム部 今井 誠",
      subject: "【至急】ダッシュボードが表示されません",
      body: `お世話になっております。株式会社オルビスの今井です。

本日朝から、NEXORA Cloudのダッシュボード画面が真っ白になり表示されません。
Chrome・Edgeの両方で同じ症状です。

本日15時の役員会でダッシュボードの数値を使う予定のため、大変困っております。
今日中の復旧、もしくは回避方法を教えていただけないでしょうか。`,
    },
    receivedMinutesAgo: 50,
    latencyMs: 6100,
    confidence: "medium",
    status: "in_progress",
    analysis: {
      intent: "ダッシュボードの表示不具合を本日中に復旧、または回避策を知りたい",
      title: "ダッシュボード表示不具合の調査・復旧",
      summary: "オルビス社でダッシュボードが真っ白になり表示不可。本日15時の役員会で使用するため当日中の復旧を希望。",
      category: "engineering",
      priority: "urgent",
      priorityReason: "顧客業務が停止し本日15時に利用予定",
      assignee: {
        reasoning: "画面が表示されない不具合でフロントエンドの調査が主。顧客連絡はCSと連携",
        memberId: "ito",
        confidence: "medium",
      },
      dueDate: { sourceText: "今日中" },
      nextAction: "ブラウザのコンソールエラーと直近のリリース差分を確認して原因を特定する。顧客への一次連絡はCSの佐藤さんと分担する。",
      reply: {
        subject: "Re: 【至急】ダッシュボードが表示されません",
        body: `株式会社オルビス
今井 誠様

お世話になっております。NEXORA株式会社です。
ご不便をおかけしており、誠に申し訳ございません。

ただいま担当エンジニアが原因の調査を開始いたしました。
本日15時の役員会に間に合うよう、復旧または回避方法を優先してご案内いたします。
進捗がわかり次第、改めてご連絡いたします。

NEXORA株式会社`,
      },
      missingInformation: ["エラーが出ているアカウントのID", "症状が出始めたおおよその時刻"],
    },
  },
  {
    input: {
      sourceType: "slack",
      author: "高橋 翔",
      channel: "marketing",
      message:
        "@森さん 来週の展示会で配る導入事例スライド、最新版をドライブに上げました！明後日までにレビューしてもらえると助かります🙏 特にROIの数字の見せ方が気になってます",
    },
    receivedMinutesAgo: 95,
    latencyMs: 4300,
    confidence: "high",
    status: "in_progress",
    analysis: {
      intent: "展示会用の導入事例スライドを明後日までにレビューしてほしい",
      title: "展示会用導入事例スライドのレビュー",
      summary: "来週の展示会で配布する導入事例スライドのレビュー依頼。ROIの数字の見せ方を特に確認してほしい。",
      category: "marketing",
      priority: "high",
      priorityReason: "社外配布物で展示会前に期限が迫る",
      assignee: {
        reasoning: "展示会とコンテンツはマーケティング責任者の担当領域",
        memberId: "mori",
        confidence: "high",
      },
      dueDate: { sourceText: "明後日まで" },
      nextAction: "ドライブの最新版スライドを確認し、ROIの表現を中心にコメントを返す。",
      reply: {
        subject: "",
        body: "高橋さん、共有ありがとうございます！明後日までにレビューして、ROIの見せ方を中心にコメントを返しますね。",
      },
      missingInformation: [],
    },
  },
  {
    input: {
      sourceType: "form",
      requester: "マーケティング部 高橋 翔",
      subject: "新LP用バナー制作のお願い",
      content: `11月公開予定の新しいLP（Enterprise向け）で使うバナーを制作してほしいです。

・サイズ：1200×628 / 1080×1080 / 300×250 の3種類
・訴求：「セキュリティ」と「導入実績」
・参考：既存のStarter向けバナーのトーン

来週中にラフを見られると嬉しいです。`,
    },
    receivedMinutesAgo: 180,
    latencyMs: 4800,
    confidence: "high",
    status: "todo",
    analysis: {
      intent: "Enterprise向け新LPのバナー3サイズを制作してほしい",
      title: "新LP用バナー制作（3サイズ）",
      summary: "11月公開のEnterprise向けLPのバナー3サイズを制作。訴求はセキュリティと導入実績、来週中にラフ希望。",
      category: "design",
      priority: "medium",
      priorityReason: "公開は11月で来週中のラフ確認で足りる",
      assignee: {
        reasoning: "バナーなどクリエイティブ制作はプロダクトデザイナーの担当",
        memberId: "suzuki",
        confidence: "high",
      },
      dueDate: { sourceText: "来週中" },
      nextAction: "既存のStarter向けバナーを確認し、3サイズのラフ案を作成する。",
      reply: {
        subject: "【受付】新LP用バナー制作のお願い",
        body: `高橋さん

バナー制作のご依頼を受け付けました。デザインの鈴木が担当します。
来週中にラフをご確認いただけるよう進めます。
進捗はFlowAI OPS上でご確認いただけます。`,
      },
      missingInformation: ["LPの公開日（11月の何日か）"],
    },
  },
  {
    input: {
      sourceType: "email",
      sender: "株式会社Lumen 法務部 藤田 亜紀",
      subject: "利用契約書（修正版）のご確認",
      body: `NEXORA株式会社 ご担当者様

株式会社Lumenの藤田です。
先日いただいた利用契約書について、第12条（損害賠償の上限）と第15条（データの取り扱い）に修正を加えた版を添付いたします。

明日までにご確認いただき、問題なければ締結手続きに進めたいと考えております。`,
    },
    receivedMinutesAgo: 240,
    latencyMs: 5600,
    confidence: "high",
    status: "in_progress",
    analysis: {
      intent: "修正した利用契約書を明日までに確認してほしい",
      title: "利用契約書（修正版）の法務確認",
      summary: "Lumen社から第12条（損害賠償上限）・第15条（データ取り扱い）を修正した契約書が届いた。明日までの確認を希望。",
      category: "legal",
      priority: "high",
      priorityReason: "締結直前の契約条項で明日が期限",
      assignee: {
        reasoning: "契約条項の修正確認とリスク判断は法務の担当",
        memberId: "kobayashi",
        confidence: "high",
      },
      dueDate: { sourceText: "明日まで" },
      nextAction: "第12条・第15条の修正箇所を自社標準と比較し、受け入れ可否とリスクをまとめる。",
      reply: {
        subject: "Re: 利用契約書（修正版）のご確認",
        body: `株式会社Lumen 法務部
藤田 亜紀様

お世話になっております。NEXORA株式会社です。
修正版の利用契約書をお送りいただき、ありがとうございます。

第12条および第15条の修正箇所について、弊社法務にて確認し、明日中にご連絡いたします。

引き続きよろしくお願いいたします。

NEXORA株式会社`,
      },
      missingInformation: [],
    },
  },
  {
    input: {
      sourceType: "email",
      sender: "株式会社ミナト精工 経理部 石井 大輔",
      subject: "請求書の宛名変更について",
      body: `いつもお世話になっております。ミナト精工の石井です。

10月1日付で社名が「株式会社ミナトテクノロジーズ」に変更となります。
10月分以降の請求書の宛名を新社名に変更していただけますでしょうか。

お手数ですが、今月末までにご対応いただけますと幸いです。`,
    },
    receivedMinutesAgo: 420,
    latencyMs: 3900,
    confidence: "high",
    status: "todo",
    analysis: {
      intent: "社名変更に伴い10月分以降の請求書の宛名を変更してほしい",
      title: "請求書の宛名変更（社名変更対応）",
      summary: "ミナト精工が10/1付で社名変更。10月分以降の請求書宛名を新社名へ変更してほしい（今月末まで）。",
      category: "finance",
      priority: "low",
      priorityReason: "期限まで余裕があり定型の変更作業",
      assignee: {
        reasoning: "請求書の発行・修正は財務の担当業務",
        memberId: "nakamura",
        confidence: "high",
      },
      dueDate: { sourceText: "今月末まで" },
      nextAction: "請求先マスタの宛名を「株式会社ミナトテクノロジーズ」に更新し、10月分から反映されることを確認する。",
      reply: {
        subject: "Re: 請求書の宛名変更について",
        body: `株式会社ミナト精工 経理部
石井 大輔様

いつもお世話になっております。NEXORA株式会社です。
社名変更のご連絡をいただき、ありがとうございます。

10月分以降の請求書の宛名を「株式会社ミナトテクノロジーズ」に変更いたします。
今月末までに対応し、完了しましたらご連絡いたします。

NEXORA株式会社`,
      },
      missingInformation: ["登記上の住所変更の有無"],
    },
  },
  {
    input: {
      sourceType: "slack",
      author: "加藤 晴",
      channel: "product-release",
      message:
        "新しい「承認フロー」機能のリリース記事、下書きができました。公開前に表現のチェックをお願いしたいです。今週中に見てもらえると嬉しいです！",
    },
    receivedMinutesAgo: 1500,
    latencyMs: 4100,
    confidence: "high",
    status: "done",
    replySent: true,
    analysis: {
      intent: "新機能のリリース記事の表現を今週中にチェックしてほしい",
      title: "新機能リリース記事の確認",
      summary: "「承認フロー」機能のリリース記事の下書きが完成。公開前の表現チェックを今週中に依頼。",
      category: "marketing",
      priority: "medium",
      priorityReason: "社外公開物だが今週中で期限に余裕",
      assignee: {
        reasoning: "リリース記事はマーケティングのコンテンツ領域。仕様の確認は起票者が担う",
        memberId: "mori",
        confidence: "high",
      },
      dueDate: { sourceText: "今週中" },
      nextAction: "下書きを読み、表記ゆれと訴求の表現を修正提案する。",
      reply: {
        subject: "",
        body: "加藤さん、ありがとうございます！今週中に表現をチェックしてコメントしますね。",
      },
      missingInformation: [],
    },
  },
  {
    input: {
      sourceType: "form",
      requester: "カスタマーサクセス部 西田 陽介",
      subject: "北斗物流様 利用データのCSV出力",
      content: `北斗物流様より、四半期レビューで使う利用状況データ（部署別のアクティブユーザー数、7〜9月分）をCSVで出してほしいと依頼がありました。
管理画面からの出力方法が分からないとのことなので、出力の支援をお願いします。今週中に先方へ渡したいです。`,
    },
    receivedMinutesAgo: 1800,
    latencyMs: 4600,
    confidence: "high",
    status: "todo",
    analysis: {
      intent: "顧客向けに利用状況データをCSV出力する支援をしてほしい",
      title: "顧客データCSV出力の支援",
      summary: "北斗物流様の四半期レビュー用に、部署別アクティブユーザー数（7〜9月）のCSV出力を支援。今週中に提供したい。",
      category: "customer_success",
      priority: "medium",
      priorityReason: "既存顧客の定例資料で今週中の期限",
      assignee: {
        reasoning: "既存顧客の利用支援とデータ提供はCSマネージャーの担当",
        memberId: "sato",
        confidence: "high",
      },
      dueDate: { sourceText: "今週中" },
      nextAction: "管理画面で部署別アクティブユーザー数（7〜9月）を出力し、手順書とあわせて西田さんに共有する。",
      reply: {
        subject: "【受付】北斗物流様 利用データのCSV出力",
        body: `西田さん

ご依頼を受け付けました。CSの佐藤が担当します。
今週中に先方へお渡しできるよう、CSVと出力手順をあわせて準備します。
進捗はFlowAI OPS上でご確認いただけます。`,
      },
      missingInformation: [],
    },
  },
  {
    input: {
      sourceType: "email",
      sender: "松本 拓海",
      subject: "二次面接の日程について",
      body: `NEXORA株式会社 採用ご担当者様

先日は一次面接の機会をいただき、ありがとうございました。松本です。
二次面接のご案内をいただいた件で、候補日を以下のとおりお送りいたします。

・平日の18時以降
・土曜日の午前

ご調整いただけますと幸いです。`,
    },
    receivedMinutesAgo: 2600,
    latencyMs: 4400,
    confidence: "high",
    status: "todo",
    analysis: {
      intent: "二次面接の日程を候補日の中で調整してほしい",
      title: "二次面接の日程調整",
      summary: "候補者の松本様から二次面接の希望日時（平日18時以降・土曜午前）が届いた。面接官との日程調整が必要。",
      category: "hr",
      priority: "medium",
      priorityReason: "候補者体験に関わるが期限の指定はない",
      assignee: {
        reasoning: "採用・面接の日程調整は人事の担当",
        memberId: "watanabe",
        confidence: "high",
      },
      dueDate: { sourceText: null },
      nextAction: "面接官の空き状況を確認し、松本様へ候補日時を2〜3件提示する。",
      reply: {
        subject: "Re: 二次面接の日程について",
        body: `松本 拓海様

NEXORA株式会社 採用担当です。
ご希望の日程をお送りいただき、ありがとうございます。

面接官の予定を確認のうえ、平日18時以降または土曜日午前の中から、具体的な候補日時を改めてご連絡いたします。
今しばらくお待ちください。

NEXORA株式会社`,
      },
      missingInformation: [],
    },
  },
  {
    input: {
      sourceType: "slack",
      author: "高橋 翔",
      channel: "general",
      message: "先日お願いした件、その後どうなってますか？来週の打ち合わせで使いたいので、確認お願いします🙏",
    },
    receivedMinutesAgo: 12,
    latencyMs: 3700,
    confidence: "low",
    status: "todo",
    analysis: {
      intent: "以前に依頼した件の進捗を知りたい",
      relatedRequest: {
        reasoning: "高橋さんの過去の依頼が2件（展示会スライド・LPバナー）あり、どちらか特定できない",
      },
      title: "「先日の件」の進捗確認",
      summary: "高橋さんから「先日お願いした件」の進捗確認。展示会スライドとLPバナーのどちらを指すか依頼文からは分からない。",
      category: "marketing",
      priority: "medium",
      priorityReason: "来週の打ち合わせで使うが期限の明記なし",
      assignee: {
        reasoning: "候補の展示会スライド（森）とLPバナー（鈴木）で担当が異なり決められない",
        memberId: null,
        confidence: "low",
      },
      dueDate: { sourceText: null },
      nextAction: "高橋さんに、展示会スライドとLPバナーのどちらの件かを確認し、担当者を決める。",
      reply: {
        subject: "",
        body: "高橋さん、ご連絡ありがとうございます！先日いただいたご依頼が「展示会の導入事例スライドのレビュー」と「新LP用バナーの制作」の2件あるのですが、どちらの件でしょうか？確認でき次第、担当者から状況をお伝えします。",
      },
      missingInformation: ["「先日お願いした件」がどちらの依頼か"],
    },
  },
];
