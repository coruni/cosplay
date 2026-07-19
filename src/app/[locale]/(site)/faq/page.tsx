import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'footer' });
  return { title: `${t('faq')} — CosHub` };
}

export default async function FaqPage({ params }: Props) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'footer' });

  const faqs = [
    {
      q: 'CosHub 是什么？',
      a: 'CosHub 是一个 Cosplay 图包分享社区，汇集来自不同作品的精选写真与主题图包。',
    },
    {
      q: '如何下载图包？',
      a: '浏览图包详情页，付费图包可单次购买解锁或开通会员后使用额度下载；部分图包提供网盘等外部下载链接。',
    },
    {
      q: '会员额度如何计算？',
      a: '会员每月拥有固定下载额度，解锁或下载会消耗额度，额度按订阅周期（30 天）自动重置。',
    },
    {
      q: 'NSFW 内容如何查看？',
      a: '在页面顶部开启 NSFW 开关即可浏览成人向内容，该偏好通过 Cookie 记录。',
    },
  ];

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-10">
          {t('faq')}
        </h1>
        <div className="space-y-6">
          {faqs.map((item, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/[0.06] bg-[#262633]/60 p-6"
            >
              <h2 className="text-lg font-semibold text-foreground mb-2">
                {item.q}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
