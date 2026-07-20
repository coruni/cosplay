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
  const tFooter = await getTranslations({ locale, namespace: 'footer' });
  const t = await getTranslations({ locale, namespace: 'faq' });
  const faqs = t.raw('items') as Array<{ q: string; a: string }>;

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-10">
          {tFooter('faq')}
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
