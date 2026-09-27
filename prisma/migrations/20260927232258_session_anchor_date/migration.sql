-- AlterTable
ALTER TABLE "DemoSession" ADD COLUMN     "anchorDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 既存の作業スペースは、作成した日（日本時間）を基準日にする
UPDATE "DemoSession" SET "anchorDate" = ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::date;
