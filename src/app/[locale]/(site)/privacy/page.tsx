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
  return { title: `${t('privacy')} — CosHub` };
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'footer' });

  const sections = [
    {
      h: '信息收集',
      p: '我们仅在您注册、订阅会员或购买图包时收集必要的账号与交易信息，用于提供与维护服务。',
    },
    {
      h: '信息使用',
      p: '您的信息用于身份验证、订单处理、额度管理与服务通知，我们不会出售您的个人信息。',
    },
    {
      h: 'Cookie',
      p: '我们使用 Cookie 记录登录状态与 NSFW 显示偏好（仅本地偏好，不含个人身份内容）。',
    },
    {
      h: '您的权利',
      p: '您可随时在用户中心修改昵称与头像，或联系我们注销账号并处理相关数据。',
    },
  ];

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
          {t('privacy')}
        </h1>
        <p className="text-sm text-muted-foreground mb-10 leading-relaxed">
          本隐私政策说明 CosHub 如何收集、使用与保护您的信息。
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
