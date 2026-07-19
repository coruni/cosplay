import crypto from 'crypto';
import { prisma } from './db';
import { invalidateGalleryCaches } from './data';
import type { PaymentOrder } from '@/types';

interface YipayConfig {
  pid: string;
  key: string;
  apiUrl: string;
  /** Default channel for the gateway's method-selection page. Empty = let gateway choose. */
  channel: string;
}

const config: YipayConfig = {
  pid: process.env.YIPAY_PID || '1000',
  key: process.env.YIPAY_KEY || 'demo_key_placeholder',
  // Base URL of the gateway, e.g. https://pay.example.com (no trailing /submit.php)
  apiUrl: process.env.YIPAY_API_URL || 'https://pay.example.com',
  channel: process.env.YIPAY_CHANNEL || '',
};

/**
 * Mock payment is ONLY allowed in non-production AND when no real gateway is
 * configured. In production we NEVER fall back to mock — a missing YIPAY_PID
 * there is a hard configuration error, not a reason to fake a successful order.
 */
export function isMockPaymentEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && !process.env.YIPAY_PID;
}

function md5(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex');
}

function generateSign(params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .filter((k) => params[k] !== '' && k !== 'sign' && k !== 'sign_type')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');

  return md5(sorted + config.key);
}

export async function createPaymentOrder(
  gallerySlug: string | null,
  galleryName: string,
  amount: number,
  baseUrl: string,
  userId?: string,
  type: 'gallery' | 'subscription' = 'gallery',
  locale: string = 'zh'
): Promise<PaymentOrder> {
  // The payment routes live under /[locale]/(site)/payment/*, so callback and
  // return URLs MUST carry the locale prefix (a gateway POSTing to a
  // locale-less /payment/notify would 404 via the i18n middleware).
  const localePrefix = `/${locale}`;
  const orderId = `COS${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  // Resolve slug → DB id for storage. The URL query param carries the slug
  // directly so the success page can build a /gallery/<slug> link without
  // needing another DB lookup. (Previously the resolved DB id was put in the
  // URL under the name `galleryId`, which the success page then used as a
  // slug — producing a 404 on the "view content" button.)
  let dbId: string | null = null;
  if (gallerySlug) {
    const g = await prisma.gallery.findUnique({
      where: { slug: gallerySlug },
      select: { id: true },
    });
    dbId = g?.id ?? null;
  }

  const slugPart = gallerySlug ? `&gallerySlug=${encodeURIComponent(gallerySlug)}` : '';

  const params: Record<string, string> = {
    pid: config.pid,
    out_trade_no: orderId,
    notify_url: `${baseUrl}${localePrefix}/payment/notify`,
    return_url: `${baseUrl}${localePrefix}/payment/success?orderId=${orderId}${slugPart}`,
    name: galleryName,
    money: amount.toFixed(2),
    sitename: 'CosHub',
  };

  // Optional payment channel — omit to let the gateway show the method-selection page.
  if (config.channel) {
    params.type = config.channel;
  }

  params.sign = generateSign(params);
  params.sign_type = 'MD5';

  // 模拟模式：仅在「非生产环境且未配置真实网关」时启用；生产环境永不 mock。
  if (isMockPaymentEnabled()) {
    console.log('[Mock Payment] Created order:', orderId, 'Amount:', amount, 'Type:', type);

    // Store in database
    await prisma.paymentOrder.create({
      data: {
        orderId,
        galleryId: dbId,
        amount,
        status: 'pending',
        type,
        paymentUrl: `${baseUrl}${localePrefix}/payment/success?orderId=${orderId}${slugPart}&type=${type}&mock=true`,
        userId,
      },
    });

    return {
      orderId,
      galleryId: dbId,
      amount,
      status: 'pending',
      type,
      paymentUrl: `${baseUrl}${localePrefix}/payment/success?orderId=${orderId}${slugPart}&type=${type}&mock=true`,
      createdAt: new Date().toISOString(),
    };
  }

  // 真实支付模式必须配齐易支付参数，否则会用占位符生成指向假网关的链接。
  // 生产环境缺配置属于硬性错误，直接抛出以便尽早暴露（而非静默 mock）。
  if (!process.env.YIPAY_PID || !process.env.YIPAY_KEY || !process.env.YIPAY_API_URL) {
    throw new Error(
      'Payment gateway not configured: YIPAY_PID / YIPAY_KEY / YIPAY_API_URL are required in production.'
    );
  }

  // 存储到数据库
  await prisma.paymentOrder.create({
    data: {
      orderId,
      galleryId: dbId,
      amount,
      status: 'pending',
      type,
      userId,
    },
  });

  // 真实易支付流程：构造带签名的 submit.php 跳转链接，浏览器直接前往网关支付页。
  // 易支付的 submit.php 是浏览器导航端点（返回自动提交表单），不能走 POST fetch。
  const payUrl = `${config.apiUrl.replace(/\/+$/, '')}/submit.php?${new URLSearchParams(params).toString()}`;

  // 记录支付链接，供前端 window.location.href 跳转
  await prisma.paymentOrder.update({
    where: { orderId },
    data: { paymentUrl: payUrl },
  });

  return {
    orderId,
    galleryId: dbId,
    amount,
    status: 'pending',
    paymentUrl: payUrl,
    createdAt: new Date().toISOString(),
  };
}

export function verifyPaymentNotify(params: Record<string, string>): boolean {
  const receivedSign = params.sign;
  if (!receivedSign) return false;

  const calculatedSign = generateSign(params);
  if (receivedSign !== calculatedSign) return false;

  // 易支付在交易成功时回传 trade_status=TRADE_SUCCESS/TRADE_FINISHED。
  // 若网关明确给出非成功状态，则视为无效通知（忽略空值，保持向后兼容）。
  const status = params.trade_status;
  if (status && status !== 'TRADE_SUCCESS' && status !== 'TRADE_FINISHED') {
    return false;
  }

  return true;
}

export async function confirmPayment(orderId: string): Promise<boolean> {
  // 更新数据库
  await prisma.paymentOrder.update({
    where: { orderId },
    data: { status: 'paid', paidAt: new Date() },
  });

  // 清除相关缓存
  await invalidateGalleryCaches();

  return true;
}

export async function getPaymentOrder(orderId: string) {
  return prisma.paymentOrder.findUnique({ where: { orderId } });
}
