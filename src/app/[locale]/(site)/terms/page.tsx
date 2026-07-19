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
  return { title: `${t('terms')} — CosHub` };
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'footer' });

  const sections = [
    {
      h: '内容版权',
      p: '图包内容版权归原作者与 Cosplayer 所有，平台仅提供展示与分发渠道，请勿未经授权转载或商用。',
    },
    {
      h: '用户责任',
      p: '您需对账号下的行为负责，不得上传或传播违法、侵权或违反公序良俗的内容。',
    },
    {
      h: '会员与购买',
      p: '会员额度按订阅周期提供，已解锁图包永久可用；虚拟商品一经解锁不予退款。',
    },
    {
      h: '服务变更',
      p: '我们保留在合理范围内调整服务条款与功能的权利，重大变更将通过站点公告通知。',
    },
  ];

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
          {t('terms')}
        </h1>
        <p className="text-sm text-muted-foreground mb-10 leading-relaxed">
          使用 CosHub 即表示您同意以下服务条款。
        </p>
        <div className="space-y-6">
          {sections.map((s) => (
            <section key={s.h}>
              <h2 className="text-lg font-semibold text-foreground mb-2">{s.h}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.p}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
