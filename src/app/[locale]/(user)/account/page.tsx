import { requireUserForPage } from '@/lib/user-auth';
import { getSubscriptionStatus } from '@/lib/subscription';
import { ProfileEditor } from '@/components/user/profile-editor';
import { MembershipPanel } from '@/components/user/membership-panel';
import { getTranslations, getLocale } from 'next-intl/server';

const SUBSCRIPTION_PRICE = Number(process.env.SUBSCRIPTION_PRICE) || 30;

export default async function AccountPage() {
  const user = await requireUserForPage();
  const t = await getTranslations('user');
  const locale = await getLocale();
  const sub = await getSubscriptionStatus(user.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t('welcome', { name: user.nickname || user.username })}
        </h1>
      </div>

      {/* Membership */}
      <MembershipPanel
        isSubscribed={sub.isSubscribed}
        isActive={sub.isActive}
        quotaTotal={sub.quotaTotal}
        quotaUsed={sub.quotaUsed}
        quotaRemaining={sub.quotaRemaining}
        cycleEndAt={sub.cycleEndAt}
        subscriptionEndAt={sub.subscriptionEndAt}
        price={SUBSCRIPTION_PRICE}
        locale={locale}
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Info card */}
        <div className="rounded-2xl p-6 bg-[#14141f]/60 border border-white/[0.06] space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            {t('accountSettings')}
          </h2>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">{t('email')}</p>
              <p className="text-foreground">{user.email}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('username')}</p>
              <p className="text-foreground">{user.username}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('createdAt')}</p>
              <p className="text-foreground">
                {new Date(user.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Editor card */}
        <div className="rounded-2xl p-6 bg-[#14141f]/60 border border-white/[0.06]">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            {t('nickname')} / {t('avatar')}
          </h2>
          <ProfileEditor user={user} />
        </div>
      </div>
    </div>
  );
}
