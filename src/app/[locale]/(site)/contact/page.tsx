import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';
import { MailIcon, MessageCircleIcon, SendIcon } from 'lucide-react';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'footer' });
  return { title: `${t('contact')} — CosHub` };
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'footer' });

  const channels = [
    {
      icon: MailIcon,
      title: 'Email',
      value: 'support@coshub.example',
      hint: '商务合作与内容申诉请发送至该邮箱。',
    },
    {
      icon: MessageCircleIcon,
      title: '社区互助',
      value: 'CosHub Discord',
      hint: '加入社区与其他 Coser 交流、反馈问题。',
    },
    {
      icon: SendIcon,
      title: '社交媒体',
      value: '@CosHub',
      hint: '关注我们获取最新图包与活动情报。',
    },
  ];

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
          {t('contact')}
        </h1>
        <p className="text-sm text-muted-foreground mb-10 leading-relaxed">
          我们重视每一位用户的反馈，欢迎通过以下任意渠道与我们联系。
        </p>
        <div className="space-y-4">
          {channels.map((c) => (
            <div
              key={c.title}
              className="flex items-start gap-4 rounded-2xl border border-white/[0.06] bg-[#262633]/60 p-6"
            >
              <div className="flex items-center justify-center size-11 rounded-xl bg-[#ff2d78]/10 shrink-0">
                <c.icon className="size-5 text-[#ff2d78]" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">{c.title}</h2>
                <p className="text-sm text-[#00d4ff]/80 mt-0.5">{c.value}</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{c.hint}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
