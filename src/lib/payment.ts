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
  galleryId: string | null,
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

  const galleryPart = galleryId ? `&galleryId=${galleryId}` : '';

  const params: Record<string, string> = {
    pid: config.pid,
    out_trade_no: orderId,
    notify_url: `${baseUrl}${localePrefix}/payment/notify`,
    return_url: `${baseUrl}${localePrefix}/payment/success?orderId=${orderId}${galleryPart}`,
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

  // 在模拟模式下，直接返回成功
  if (!process.env.YIPAY_PID) {
    console.log('[Mock Payment] Created order:', orderId, 'Amount:', amount, 'Type:', type);

    // Store in database
    await prisma.paymentOrder.create({
      data: {
        orderId,
        galleryId,
        amount,
        status: 'pending',
        type,
        paymentUrl: `${baseUrl}${localePrefix}/payment/success?orderId=${orderId}${galleryPart}&type=${type}&mock=true`,
        userId,
      },
    });

    return {
      orderId,
      galleryId,
      amount,
      status: 'pending',
      type,
      paymentUrl: `${baseUrl}${localePrefix}/payment/success?orderId=${orderId}${galleryPart}&type=${type}&mock=true`,
      createdAt: new Date().toISOString(),
    };
  }

  // 存储到数据库
  await prisma.paymentOrder.create({
    data: {
      orderId,
      galleryId,
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
    galleryId,
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
