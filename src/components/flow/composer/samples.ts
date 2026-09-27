import type { SourceInput } from "@/lib/ingestion";

// 「新しい依頼」でワンクリック入力できるサンプル。デモを 30 秒で体験してもらうためのもの。

export type Sample = { label: string; input: SourceInput };

export const SAMPLES: Record<SourceInput["sourceType"], Sample[]> = {
  email: [
    {
      label: "見積の依頼",
      input: {
        sourceType: "email",
        sender: "株式会社カナメ商事 購買部 岡田 恵",
        subject: "Enterpriseプランのお見積もりについて",
        body: `NEXORA株式会社 ご担当者様

お世話になっております。カナメ商事の岡田です。
来月から全社（約200名）でのNEXORA Cloud導入を検討しております。

Enterpriseプランのお見積書と、導入スケジュールの案を来週水曜日までにいただけますでしょうか。
SSO連携が可能かどうかもあわせて教えてください。

よろしくお願いいたします。`,
      },
    },
    {
      label: "先日の件（過去の依頼から判断）",
      input: {
        sourceType: "email",
        sender: "株式会社ミナト精工 経理部 石井 大輔",
        subject: "先日の件",
        body: `いつもお世話になっております。ミナト精工の石井です。

先日ご相談した件、その後の対応状況はいかがでしょうか。
念のため、10月分から反映いただけるかも確認させてください。`,
      },
    },
    {
      label: "請求の問い合わせ",
      input: {
        sourceType: "email",
        sender: "株式会社サンライズ 経理部 早川 翼",
        subject: "9月分ご請求金額の確認",
        body: `お世話になっております。サンライズの早川です。

9月分の請求書を拝見したのですが、契約しているID数（40ID）と請求金額が合っていないように見えます。
お手数ですが内訳をご確認いただき、明日中にご回答いただけますでしょうか。`,
      },
    },
  ],
  slack: [
    {
      label: "至急の不具合",
      input: {
        sourceType: "slack",
        author: "佐藤 美咲",
        channel: "cs-escalation",
        message:
          "【至急】ヨツバ工業様から、設定画面の「保存」ボタンを押しても反応しないと連絡がありました。今日の16時から社内説明会で使うそうです。どなたか確認お願いします！",
      },
    },
    {
      label: "曖昧な依頼",
      input: {
        sourceType: "slack",
        author: "高橋 翔",
        channel: "random",
        message: "例のやつ、どうなりましたっけ？来週までにあると助かります🙏",
      },
    },
  ],
  form: [
    {
      label: "備品の手配",
      input: {
        sourceType: "form",
        requester: "エンジニアリング部 伊藤 蓮",
        subject: "新メンバー用PCとモニターの手配",
        content: `10月1日に開発チームへ3名が入社します。
ノートPC（開発用スペック）と27インチモニターを各3台、明後日までに発注をお願いできますか。
入館証の発行もあわせてお願いしたいです。`,
      },
    },
    {
      label: "NDAの確認",
      input: {
        sourceType: "form",
        requester: "営業部 田中 悠",
        subject: "新規商談前のNDA確認",
        content:
          "来週月曜にアルファ建設様との初回商談があり、先方から秘密保持契約書（NDA）のドラフトが届きました。先方書式のため、損害賠償と有効期間の条項を中心に確認をお願いします。",
      },
    },
  ],
};
