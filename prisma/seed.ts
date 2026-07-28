import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── 基础分类目录（写入 Category 表，供后台选择 / 前台图标使用）──
const categories = [
  { slug: 'game',     icon: '🎮', sortOrder: 1, name: { zh: '游戏',   en: 'Game',     ja: 'ゲーム' } },
  { slug: 'anime',    icon: '🎬', sortOrder: 2, name: { zh: '动画',   en: 'Anime',    ja: 'アニメ' } },
  { slug: 'manga',    icon: '📚', sortOrder: 3, name: { zh: '漫画',   en: 'Manga',    ja: 'マンガ' } },
  { slug: 'movie',    icon: '🎥', sortOrder: 4, name: { zh: '电影',   en: 'Movie',    ja: '映画' } },
  { slug: 'original', icon: '✨', sortOrder: 5, name: { zh: '原创',   en: 'Original', ja: 'オリジナル' } },
  { slug: 'swimsuit', icon: '🏖️', sortOrder: 6, name: { zh: '泳装',   en: 'Swimsuit', ja: '水着' } },
  { slug: 'lingerie', icon: '💋', sortOrder: 7, name: { zh: '内衣',   en: 'Lingerie', ja: 'ランジェリー' } },
  { slug: 'school',   icon: '🎒', sortOrder: 8, name: { zh: '校园',   en: 'School',   ja: 'スクール' } },
  { slug: 'fantasy',  icon: '🧙', sortOrder: 9, name: { zh: '奇幻',   en: 'Fantasy',  ja: 'ファンタジー' } },
];

async function main() {
  console.log('Seeding categories...');

  for (const c of categories) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, icon: c.icon, sortOrder: c.sortOrder },
      create: c,
    });
  }
  console.log(`  ✓ ${categories.length} categories`);

  const cCount = await prisma.category.count();
  console.log(`\nDone! ${cCount} categories.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
