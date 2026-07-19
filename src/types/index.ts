export type Locale = 'zh' | 'en' | 'ja';
export type Rating = 'sfw' | 'nsfw';
export type SortOption = 'newest' | 'popular' | 'price-low';

export interface GalleryI18n {
  title: string;
  description: string;
}

export interface Gallery {
  id: string;
  slug: string;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
  cosplayer: string;
  character: string;
  series: string;
  cover: string;
  images: string[];
  categories: string[];
  tags: string[];
  rating: Rating;
  price: number;
  isPremium: boolean;
  createdAt: string;
  viewCount: number;
  downloadCount: number;
  downloadUrl?: string;
}

export interface GalleryFilter {
  query?: string;
  category?: string;
  rating?: Rating | 'all';
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}

export interface PaymentOrder {
  orderId: string;
  galleryId: string | null;
  userId?: string | null;
  amount: number;
  status: 'pending' | 'paid' | 'failed';
  type?: 'gallery' | 'subscription';
  paymentUrl?: string;
  createdAt: string;
}

export interface SafeUser {
  id: string;
  email: string;
  username: string;
  nickname: string | null;
  avatar: string | null;
  createdAt: string;
  // Subscription / membership
  isSubscribed: boolean;
  subscriptionEndAt: string | null;
  quotaTotal: number;
  quotaUsed: number;
}
