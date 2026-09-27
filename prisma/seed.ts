import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { resetDatabase } from "../src/lib/seed";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL が設定されていません（.env を確認してください）");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const result = await resetDatabase(prisma);
    console.log(`✓ メンバー ${result.members}名を投入しました（依頼の初期データは、訪問者ごとに初回アクセス時に作られます）`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
