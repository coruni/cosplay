import crypto from 'crypto';
import { prisma } from './db';
import { invalidateGalleryCaches } from './data';
import type { PaymentOrder } from '@/types';

interface YipayConfig {
  pid: string;
  key: string;
  apiUrl: string;
}

const config: YipayConfig = {
  pid: process.env.YIPAY_PID || '1000',
  key: process.env.YIPAY_KEY || 'demo_key_placeholder',
  apiUrl: process.env.YIPAY_API_URL || 'https://pay.example.com/api',
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
    type: 'alipay',
    out_trade_no: orderId,
    notify_url: `${baseUrl}${localePrefix}/payment/notify`,
    return_url: `${baseUrl}${localePrefix}/payment/success?orderId=${orderId}${galleryPart}`,
    name: galleryName,
    money: amount.toFixed(2),
    sitename: 'CosHub',
  };

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

  // 真实请求易支付 API
  try {
    const response = await fetch(`${config.apiUrl}/submit.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });

    const text = await response.text();
    const payUrl = text.includes('http') ? text.trim() : `${config.apiUrl}/pay/${orderId}`;

    // Update with payment URL
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
  } catch (error) {
    console.error('[Payment Error]', error);
    await prisma.paymentOrder.update({
      where: { orderId },
      data: { status: 'failed' },
    });
    throw new Error('Failed to create payment order');
  }
}

export function verifyPaymentNotify(params: Record<string, string>): boolean {
  const receivedSign = params.sign;
  if (!receivedSign) return false;

  const calculatedSign = generateSign(params);
  return receivedSign === calculatedSign;
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
