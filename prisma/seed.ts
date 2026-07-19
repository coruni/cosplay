import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const galleries = [
  {
    slug: 'nier-2b-gothic',
    titleZh: '尼尔：自动人形 2B 哥特风格',
    titleEn: 'Nier Automata 2B Gothic Style',
    titleJa: 'ニーア オートマタ 2B ゴシックスタイル',
    descriptionZh: '经典 2B 角色的暗黑哥特风格演绎，精致服装与场景氛围完美融合。',
    descriptionEn: 'A dark gothic interpretation of the iconic 2B character, with exquisite costume and atmospheric setting.',
    descriptionJa: '象徴的な2Bキャラクターのダークゴシック解釈、精巧な衣装と雰囲気のある設定。',
    cosplayer: 'Yuki Tanaka', character: '2B', series: 'Nier: Automata',
    cover: '/images/sfw/nier-2b-cover.jpg',
    images: Array.from({length:8},(_,i)=>`/images/sfw/nier-2b-0${i+1}.jpg`),
    categories: ['game','fantasy'], tags: ['2B','Nier','Gothic','Dark','Sword'],
    rating: 'sfw', price: 0, isPremium: false, viewCount: 15820, downloadCount: 3420,
  },
  {
    slug: 'genshin-raiden-shogun',
    titleZh: '原神 雷电将军 和风雅致',
    titleEn: 'Genshin Impact Raiden Shogun Elegance',
    titleJa: '原神 雷電将軍 和の優雅',
    descriptionZh: '雷电将军的唯美和风 Cosplay，细腻还原了稻妻的神韵。',
    descriptionEn: 'A beautiful Japanese-style cosplay of Raiden Shogun, capturing the essence of Inazuma.',
    descriptionJa: '雷電将軍の美しい和風コスプレ、稲妻の神髄を捉えています。',
    cosplayer: 'Hana Kimura', character: 'Raiden Shogun', series: 'Genshin Impact',
    cover: '/images/sfw/raiden-cover.jpg',
    images: Array.from({length:6},(_,i)=>`/images/sfw/raiden-0${i+1}.jpg`),
    categories: ['game','anime'], tags: ['Raiden','Genshin','Japanese','Kimono','Elegant'],
    rating: 'sfw', price: 0, isPremium: false, viewCount: 23450, downloadCount: 5100,
  },
  {
    slug: 'cyberpunk-edgerunners-lucy',
    titleZh: '赛博朋克边缘行者 Lucy 霓虹之夜',
    titleEn: 'Cyberpunk Edgerunners Lucy Neon Nights',
    titleJa: 'サイバーパンク エッジランナーズ ルーシー ネオンナイト',
    descriptionZh: 'Lucy 的赛博朋克风格 Cosplay，霓虹灯光下的未来感造型。',
    descriptionEn: 'Cyberpunk-style Lucy cosplay with futuristic aesthetics under neon lights.',
    descriptionJa: 'ネオンライトの下での未来的な美学を持つルーシーのサイバーパンクスタイルコスプレ。',
    cosplayer: 'Rina Sato', character: 'Lucy', series: 'Cyberpunk: Edgerunners',
    cover: '/images/sfw/lucy-cover.jpg',
    images: Array.from({length:7},(_,i)=>`/images/sfw/lucy-0${i+1}.jpg`),
    categories: ['anime','fantasy'], tags: ['Lucy','Cyberpunk','Neon','Sci-Fi','Silver Hair'],
    rating: 'sfw', price: 0, isPremium: false, viewCount: 18900, downloadCount: 4200,
  },
  {
    slug: 'evangelion-asuka-plugsuit',
    titleZh: 'EVA 明日香 战斗服经典',
    titleEn: 'Evangelion Asuka Plugsuit Classic',
    titleJa: 'エヴァ アスカ プラグスーツクラシック',
    descriptionZh: '明日香经典红色战斗服 Cosplay，完美还原 EVA 的经典造型。',
    descriptionEn: 'Classic red plugsuit Asuka cosplay, perfectly recreating the iconic Evangelion look.',
    descriptionJa: 'クラシックな赤いプラグスーツのアスカコスプレ、象徴的なエヴァンゲリオンのルックを完璧に再現。',
    cosplayer: 'Mika Yamamoto', character: 'Asuka Langley', series: 'Evangelion',
    cover: '/images/sfw/asuka-cover.jpg',
    images: Array.from({length:5},(_,i)=>`/images/sfw/asuka-0${i+1}.jpg`),
    categories: ['anime'], tags: ['Asuka','EVA','Plugsuit','Red','Classic'],
    rating: 'sfw', price: 0, isPremium: false, viewCount: 22100, downloadCount: 4800,
  },
  {
    slug: 'spy-x-family-yor-forger',
    titleZh: '间谍过家家 约尔 暗夜玫瑰',
    titleEn: 'Spy x Family Yor Forger Night Rose',
    titleJa: 'スパイファミリー ヨル ナイトローズ',
    descriptionZh: '约尔·福杰的优雅杀手造型，黑色礼服与玫瑰的经典搭配。',
    descriptionEn: 'Elegant assassin Yor Forger in a black dress with roses, the classic combination.',
    descriptionJa: '黒いドレスとバラのクラシックな組み合わせ、エレガントな暗殺者ヨル・フォージャー。',
    cosplayer: 'Sakura Ito', character: 'Yor Forger', series: 'Spy x Family',
    cover: '/images/sfw/yor-cover.jpg',
    images: Array.from({length:6},(_,i)=>`/images/sfw/yor-0${i+1}.jpg`),
    categories: ['anime'], tags: ['Yor','Spy x Family','Dress','Rose','Elegant'],
    rating: 'sfw', price: 9.9, isPremium: true, viewCount: 12500, downloadCount: 2100,
  },
  {
    slug: 'honkai-kiana-kaslana',
    titleZh: '崩坏3 琪亚娜 月光骑士',
    titleEn: 'Honkai Impact Kiana Moonlight Knight',
    titleJa: '崩壊3rd キアナ ムーンライトナイト',
    descriptionZh: '琪亚娜·卡斯兰娜的月光骑士 Cosplay，华丽战斗服展现女武神魅力。',
    descriptionEn: "Kiana Kaslana's Moonlight Knight cosplay, showcasing Valkyrie charm in magnificent battle armor.",
    descriptionJa: 'キアナ・カスラナのムーンライトナイトコスプレ、壮大な戦闘服でヴァルキリーの魅力を披露。',
    cosplayer: 'Mei Chen', character: 'Kiana Kaslana', series: 'Honkai Impact 3rd',
    cover: '/images/sfw/kiana-cover.jpg',
    images: Array.from({length:7},(_,i)=>`/images/sfw/kiana-0${i+1}.jpg`),
    categories: ['game','fantasy'], tags: ['Kiana','Honkai','Valkyrie','White','Armor'],
    rating: 'sfw', price: 0, isPremium: false, viewCount: 9800, downloadCount: 1800,
  },
  {
    slug: 'genshin-yae-miko-shrine',
    titleZh: '原神 八重神子 神社巫女',
    titleEn: 'Genshin Impact Yae Miko Shrine Maiden',
    titleJa: '原神 八重神子 神社の巫女',
    descriptionZh: '八重神子的神社巫女主题 Cosplay，粉色狐耳与和风神社的完美结合。',
    descriptionEn: 'Yae Miko shrine maiden themed cosplay, a perfect blend of pink fox ears and Japanese shrine aesthetics.',
    descriptionJa: '八重神子の神社巫女テーマコスプレ、ピンクの狐耳と和風神社の美学の完璧な融合。',
    cosplayer: 'Yuna Watanabe', character: 'Yae Miko', series: 'Genshin Impact',
    cover: '/images/sfw/yae-cover.jpg',
    images: Array.from({length:5},(_,i)=>`/images/sfw/yae-0${i+1}.jpg`),
    categories: ['game','fantasy'], tags: ['Yae Miko','Genshin','Fox','Shrine','Pink'],
    rating: 'sfw', price: 12.9, isPremium: true, viewCount: 15600, downloadCount: 3200,
  },
  {
    slug: 'chainsaw-man-makima',
    titleZh: '电锯人 玛奇玛 支配恶魔',
    titleEn: 'Chainsaw Man Makima Control Devil',
    titleJa: 'チェンソーマン マキマ 支配の悪魔',
    descriptionZh: '玛奇玛的职场西装风格 Cosplay，冷艳知性的支配恶魔。',
    descriptionEn: "Makima's office suit style cosplay, the cold and intellectual Control Devil.",
    descriptionJa: 'マキマのオフィススーツスタイルコスプレ、冷たく知的な支配の悪魔。',
    cosplayer: 'Ryo Hayashi', character: 'Makima', series: 'Chainsaw Man',
    cover: '/images/sfw/makima-cover.jpg',
    images: Array.from({length:6},(_,i)=>`/images/sfw/makima-0${i+1}.jpg`),
    categories: ['anime','manga'], tags: ['Makima','Chainsaw Man','Suit','Red Hair','Office'],
    rating: 'sfw', price: 0, isPremium: false, viewCount: 20100, downloadCount: 4500,
  },
  {
    slug: 'azur-lane-enterprise',
    titleZh: '碧蓝航线 企业号 碧海航迹',
    titleEn: 'Azur Lane Enterprise Ocean Voyage',
    titleJa: 'アズールレーン エンタープライズ 海洋航路',
    descriptionZh: '企业号的舰娘 Cosplay，白色海军风与海浪的绝美组合。',
    descriptionEn: 'Enterprise shipgirl cosplay, a gorgeous combination of white naval style and ocean waves.',
    descriptionJa: 'エンタープライズ艦娘コスプレ、白い海軍スタイルと海の波の豪華な組み合わせ。',
    cosplayer: 'Nami Suzuki', character: 'Enterprise', series: 'Azur Lane',
    cover: '/images/sfw/enterprise-cover.jpg',
    images: Array.from({length:7},(_,i)=>`/images/sfw/enterprise-0${i+1}.jpg`),
    categories: ['game','school'], tags: ['Enterprise','Azur Lane','Naval','White','Ocean'],
    rating: 'sfw', price: 0, isPremium: false, viewCount: 11300, downloadCount: 2500,
  },
  {
    slug: 'fate-saber-lion-king',
    titleZh: 'Fate Saber 狮子王 王者之姿',
    titleEn: 'Fate Saber Lion King Royal Presence',
    titleJa: 'Fate セイバー 獅子王 王者の姿',
    descriptionZh: 'Saber 狮子王的华丽铠甲 Cosplay，王者气质与圣剑光芒交相辉映。',
    descriptionEn: 'Magnificent armored Saber Lion King cosplay, where royal presence meets the glow of Excalibur.',
    descriptionJa: '壮大な鎧のセイバー獅子王コスプレ、王者の存在感とエクスカリバーの輝きが出会う。',
    cosplayer: 'Rei Takahashi', character: 'Saber (Lion King)', series: 'Fate/Grand Order',
    cover: '/images/sfw/saber-cover.jpg',
    images: Array.from({length:8},(_,i)=>`/images/sfw/saber-0${i+1}.jpg`),
    categories: ['game','anime','fantasy'], tags: ['Saber','Fate','Lion King','Armor','Excalibur'],
    rating: 'sfw', price: 15.9, isPremium: true, viewCount: 28700, downloadCount: 6800,
  },
  {
    slug: 'touhou-reimu-hakurei',
    titleZh: '东方Project 博丽灵梦 幻想乡巫女',
    titleEn: 'Touhou Project Reimu Hakurei Gensokyo Maiden',
    titleJa: '東方Project 博麗霊夢 幻想郷の巫女',
    descriptionZh: '博丽灵梦的经典红白巫女服 Cosplay，在樱花树下展现幻想乡的悠闲日常。',
    descriptionEn: 'Classic red-white shrine maiden Reimu cosplay, capturing the leisurely daily life of Gensokyo under cherry blossoms.',
    descriptionJa: '桜の下で幻想郷ののどかな日常を捉えた、クラシックな紅白巫女服の霊夢コスプレ。',
    cosplayer: 'Aoi Nakamura', character: 'Reimu Hakurei', series: 'Touhou Project',
    cover: '/images/sfw/reimu-cover.jpg',
    images: Array.from({length:5},(_,i)=>`/images/sfw/reimu-0${i+1}.jpg`),
    categories: ['game','anime'], tags: ['Reimu','Touhou','Shrine Maiden','Cherry Blossom','Red'],
    rating: 'sfw', price: 0, isPremium: false, viewCount: 8900, downloadCount: 1600,
  },
  {
    slug: 'arknights-texas-lappland',
    titleZh: '明日方舟 德克萨斯 荒野之狼',
    titleEn: 'Arknights Texas Lone Wolf',
    titleJa: 'アークナイツ テキサス 荒野の狼',
    descriptionZh: '德克萨斯的冷酷杀手风格 Cosplay，黑灰主调展现企鹅物流干员的帅气一面。',
    descriptionEn: "Texas's cold-blooded killer style cosplay, black-gray tones showcasing the cool side of Penguin Logistics.",
    descriptionJa: 'テキサスの冷血な殺し屋スタイルコスプレ、白黒のトーンでペンギン物流のクールな一面を見せる。',
    cosplayer: 'Kyo Tanaka', character: 'Texas', series: 'Arknights',
    cover: '/images/sfw/texas-cover.jpg',
    images: Array.from({length:6},(_,i)=>`/images/sfw/texas-0${i+1}.jpg`),
    categories: ['game'], tags: ['Texas','Arknights','Wolf','Dark','Cool'],
    rating: 'sfw', price: 8.9, isPremium: true, viewCount: 6700, downloadCount: 980,
  },

  // ──────────────────────────────────────────────────────────────
  // NSFW 测试数据 (rating = 'nsfw')
  // 这些条目用于验证内容分级过滤与订阅/付费墙逻辑。
  // 内容定位为 18+ 成熟向 Cosplay（性感/私房风），不含露骨色情描写。
  // ──────────────────────────────────────────────────────────────
  {
    slug: 'azur-lane-purifier-beach',
    titleZh: '碧蓝航线 净化者 沙滩私房',
    titleEn: 'Azur Lane Purifier Beach Boudoir',
    titleJa: 'アズールレーン パリファイアー ビーチブージー',
    descriptionZh: '净化者的夏日沙滩私房写真，比基尼与浪花的性感组合，仅限 18+ 会员浏览。',
    descriptionEn: 'A summer beach boudoir set of Purifier — bikini and waves in a sultry combination, 18+ members only.',
    descriptionJa: 'パリファイアーの夏のビーチブージーセット、ビキニと波のセクシーな組み合わせ、18歳以上限定。',
    cosplayer: 'Nami Suzuki', character: 'Purifier', series: 'Azur Lane',
    cover: '/images/nsfw/purifier-cover.jpg',
    images: Array.from({length:6},(_,i)=>`/images/nsfw/purifier-0${i+1}.jpg`),
    categories: ['game','swimsuit'], tags: ['Purifier','Azur Lane','Bikini','Beach','Mature'],
    rating: 'nsfw', price: 19.9, isPremium: true, viewCount: 31200, downloadCount: 7600,
  },
  {
    slug: 'genshin-yelan-night',
    titleZh: '原神 夜兰 夜色魅影',
    titleEn: 'Genshin Impact Yelan Midnight Seduction',
    titleJa: '原神 ヤラン 夜の誘惑',
    descriptionZh: '夜兰的成熟私房风格 Cosplay，紧身旗袍与暗夜灯光的撩人质感。',
    descriptionEn: "Yelan's mature boudoir style cosplay, with a figure-hugging qipao and the alluring glow of midnight lighting.",
    descriptionJa: 'ヤランの成熟したブージースタイルコスプレ、ボディラインのqipaoと真夜中の光の誘惑。',
    cosplayer: 'Hana Kimura', character: 'Yelan', series: 'Genshin Impact',
    cover: '/images/nsfw/yelan-cover.jpg',
    images: Array.from({length:7},(_,i)=>`/images/nsfw/yelan-0${i+1}.jpg`),
    categories: ['game','lingerie'], tags: ['Yelan','Genshin','Qipao','Seductive','Mature'],
    rating: 'nsfw', price: 24.9, isPremium: true, viewCount: 27800, downloadCount: 6400,
  },
  {
    slug: 'fate-morgana-seductive',
    titleZh: 'Fate 摩根 暗夜女王',
    titleEn: 'Fate Morgan Dark Queen',
    titleJa: 'Fate モルガン 暗き女王',
    descriptionZh: '摩根的暗黑妖艳主题 Cosplay，深紫长裙与神秘气场的成熟演绎。',
    descriptionEn: 'Morgan in a dark, seductive theme — deep violet gown and a mysterious, mature aura.',
    descriptionJa: 'モルガンのダークで妖艶なテーマ、深紫のドレスと神秘的な成熟したオーラ。',
    cosplayer: 'Rei Takahashi', character: 'Morgan', series: 'Fate/Grand Order',
    cover: '/images/nsfw/morgan-cover.jpg',
    images: Array.from({length:6},(_,i)=>`/images/nsfw/morgan-0${i+1}.jpg`),
    categories: ['game','fantasy'], tags: ['Morgan','Fate','Violet','Seductive','Mature'],
    rating: 'nsfw', price: 21.9, isPremium: true, viewCount: 19900, downloadCount: 4300,
  },
  {
    slug: 'nier-a2-dark',
    titleZh: '尼尔：自动人形 A2 破损之躯',
    titleEn: 'Nier Automata A2 Broken Form',
    titleJa: 'ニーア オートマタ A2 崩壊の姿',
    descriptionZh: 'A2 的破损战斗服 Cosplay，绷带与伤痕勾勒出的成熟野性之美。',
    descriptionEn: "A2's tattered battle outfit cosplay, where bandages and scars trace a mature, feral beauty.",
    descriptionJa: 'A2のぼろぼろの戦闘服コスプレ、包帯と傷跡が描く成熟した野性的な美しさ。',
    cosplayer: 'Yuki Tanaka', character: 'A2', series: 'Nier: Automata',
    cover: '/images/nsfw/a2-cover.jpg',
    images: Array.from({length:5},(_,i)=>`/images/nsfw/a2-0${i+1}.jpg`),
    categories: ['game','fantasy'], tags: ['A2','Nier','Bandage','Feral','Mature'],
    rating: 'nsfw', price: 17.9, isPremium: true, viewCount: 16400, downloadCount: 3500,
  },
  {
    slug: 'kill-la-kill-ryuko-satsuki',
    titleZh: '斩服少女 缠流子&皋月 双生对峙',
    titleEn: 'Kill la Kill Ryuko & Satsuki Twin Standoff',
    titleJa: 'キルラキル 流子＆皐月 ツイン対決',
    descriptionZh: '缠流子与皋月的对决主题私房写真，战斗服的成熟变体演绎。',
    descriptionEn: 'A standoff-themed boudoir set of Ryuko and Satsuki, a mature variant of their battle costumes.',
    descriptionJa: '流子と皐月の対決テーマのブージーセット、戦闘服の成熟したバリエーション。',
    cosplayer: 'Mika Yamamoto', character: 'Ryuko & Satsuki', series: 'Kill la Kill',
    cover: '/images/nsfw/klk-cover.jpg',
    images: Array.from({length:8},(_,i)=>`/images/nsfw/klk-0${i+1}.jpg`),
    categories: ['anime','lingerie'], tags: ['Kill la Kill','Ryuko','Satsuki','Mature','Twin'],
    rating: 'nsfw', price: 26.9, isPremium: true, viewCount: 22100, downloadCount: 5200,
  },
  {
    slug: 'queens-blade-leina',
    titleZh: '女皇之刃 蕾娜 战士之姿',
    titleEn: 'Queen\'s Blade Leina Warrior Pose',
    titleJa: 'クイーンズブレイド レイナ 戦士の姿',
    descriptionZh: '蕾娜的成熟战士风格 Cosplay，盔甲与肌肤的性感平衡。',
    descriptionEn: "Leina's mature warrior style cosplay, balancing armor and skin in a sultry equilibrium.",
    descriptionJa: 'レイナの成熟した戦士スタイルコスプレ、鎧と肌のセクシーなバランス。',
    cosplayer: 'Sakura Ito', character: 'Leina', series: 'Queen\'s Blade',
    cover: '/images/nsfw/leina-cover.jpg',
    images: Array.from({length:6},(_,i)=>`/images/nsfw/leina-0${i+1}.jpg`),
    categories: ['anime','fantasy'], tags: ['Queens Blade','Leina','Warrior','Armor','Mature'],
    rating: 'nsfw', price: 18.9, isPremium: true, viewCount: 14300, downloadCount: 2900,
  },
];

// ── 测试用户 (密码统一为 password123，bcrypt 成本 10 与线上一致) ──
// 注意：Nickname / 订阅状态用于验证配额与会员墙逻辑。
const users = [
  {
    email: 'subscriber@example.com',
    username: 'subscriber',
    nickname: '订阅会员',
    password: 'password123',
    isSubscribed: true,
    quotaTotal: 120,
    quotaUsed: 35,
  },
  {
    email: 'freeuser@example.com',
    username: 'freeuser',
    nickname: '免费用户',
    password: 'password123',
    isSubscribed: false,
    quotaTotal: 120,
    quotaUsed: 8,
  },
  {
    email: 'admin@example.com',
    username: 'admin',
    nickname: '管理员',
    password: 'password123',
    isSubscribed: true,
    quotaTotal: 9999,
    quotaUsed: 0,
  },
];

// ── 测试订单：覆盖 paid / pending / failed 与 gallery / subscription 类型 ──
// galleryId / userId 在 main() 中根据 slug / username 解析为真实主键。
const orders = [
  { orderId: 'ORD-NSFW-0001', gallerySlug: 'azur-lane-purifier-beach', userUsername: 'subscriber', amount: 19.9, status: 'paid', type: 'gallery' },
  { orderId: 'ORD-NSFW-0002', gallerySlug: 'genshin-yelan-night',        userUsername: 'subscriber', amount: 24.9, status: 'paid', type: 'gallery' },
  // 订阅型订单同样需要 galleryId（schema 中该字段为必填），这里关联一个旗舰付费图集作为订阅套餐载体。
  { orderId: 'ORD-SUB-0001',  gallerySlug: 'fate-saber-lion-king',         userUsername: 'subscriber', amount: 29.9, status: 'paid', type: 'subscription' },
  { orderId: 'ORD-NSFW-0003', gallerySlug: 'fate-morgana-seductive',     userUsername: 'freeuser',   amount: 21.9, status: 'pending', type: 'gallery' },
  { orderId: 'ORD-NSFW-0004', gallerySlug: 'kill-la-kill-ryuko-satsuki', userUsername: 'freeuser',   amount: 26.9, status: 'failed', type: 'gallery' },
];

async function main() {
  console.log('Seeding database...');

  // 1) Galleries (SFW + NSFW)
  const slugToId = new Map<string, string>();
  for (const g of galleries) {
    const row = await prisma.gallery.upsert({
      where: { slug: g.slug },
      update: g,
      create: g,
    });
    slugToId.set(g.slug, row.id);
    console.log(`  ✓ gallery ${g.slug} [${g.rating}]`);
  }

  // 2) Users
  const now = new Date();
  const cycleEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const usernameToId = new Map<string, string>();
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const row = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        username: u.username,
        nickname: u.nickname,
        passwordHash,
        isSubscribed: u.isSubscribed,
        quotaTotal: u.quotaTotal,
        quotaUsed: u.quotaUsed,
        subscriptionStartAt: u.isSubscribed ? now : null,
        subscriptionEndAt: u.isSubscribed ? cycleEnd : null,
      },
      create: {
        email: u.email,
        username: u.username,
        nickname: u.nickname,
        passwordHash,
        isSubscribed: u.isSubscribed,
        quotaTotal: u.quotaTotal,
        quotaUsed: u.quotaUsed,
        subscriptionStartAt: u.isSubscribed ? now : null,
        subscriptionEndAt: u.isSubscribed ? cycleEnd : null,
      },
    });
    usernameToId.set(u.username, row.id);
    console.log(`  ✓ user ${u.username}`);
  }

  // 3) PaymentOrders
  for (const o of orders) {
    const userId = o.userUsername ? usernameToId.get(o.userUsername) : undefined;
    const galleryId = o.gallerySlug ? slugToId.get(o.gallerySlug) : undefined;
    await prisma.paymentOrder.upsert({
      where: { orderId: o.orderId },
      update: { userId, galleryId, amount: o.amount, status: o.status, type: o.type },
      create: {
        orderId: o.orderId,
        userId,
        galleryId,
        amount: o.amount,
        status: o.status,
        type: o.type,
        paidAt: o.status === 'paid' ? now : null,
      },
    });
    console.log(`  ✓ order ${o.orderId} [${o.status}/${o.type}]`);
  }

  const [gCount, uCount, oCount] = await Promise.all([
    prisma.gallery.count(),
    prisma.user.count(),
    prisma.paymentOrder.count(),
  ]);
  const nsfwCount = await prisma.gallery.count({ where: { rating: 'nsfw' } });
  console.log(`\nDone! ${gCount} galleries (${nsfwCount} nsfw), ${uCount} users, ${oCount} orders.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
