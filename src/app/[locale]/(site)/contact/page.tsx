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
  const tFooter = await getTranslations({ locale, namespace: 'footer' });
  const t = await getTranslations({ locale, namespace: 'contact' });
  const channelTitles = t.raw('channels') as Array<{ title: string; hint: string }>;
  // Static contact values are not localized (email addresses, handles).
  const channelValues = ['mineimc@outlook.com', 'CosHub Discord', '@CosHub'];
  const icons = [MailIcon, MessageCircleIcon, SendIcon];
  const channels = channelTitles.map((c, i) => ({
    icon: icons[i],
    title: c.title,
    value: channelValues[i],
    hint: c.hint,
  }));

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
          {tFooter('contact')}
        </h1>
        <p className="text-sm text-muted-foreground mb-10 leading-relaxed">
          {t('subtitle')}
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
