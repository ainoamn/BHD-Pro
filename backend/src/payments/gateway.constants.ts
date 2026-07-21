import { PaymentGatewaySlug } from '@prisma/client';

export const GATEWAY_META: Record<
  PaymentGatewaySlug,
  {
    nameAr: string;
    nameEn: string;
    configKeys: { key: string; labelAr: string; labelEn: string; secret?: boolean }[];
    sortOrder: number;
    online: boolean;
  }
> = {
  THAWANI: {
    nameAr: 'ثواني',
    nameEn: 'Thawani',
    sortOrder: 1,
    online: true,
    configKeys: [
      { key: 'publishableKey', labelAr: 'المفتاح العام', labelEn: 'Publishable key', secret: false },
      { key: 'secretKey', labelAr: 'المفتاح السري', labelEn: 'Secret key', secret: true },
      { key: 'webhookSecret', labelAr: 'سر Webhook', labelEn: 'Webhook secret', secret: true },
      { key: 'baseUrl', labelAr: 'رابط API', labelEn: 'API base URL', secret: false },
    ],
  },
  STRIPE: {
    nameAr: 'Stripe',
    nameEn: 'Stripe',
    sortOrder: 2,
    online: true,
    configKeys: [
      { key: 'publishableKey', labelAr: 'المفتاح العام', labelEn: 'Publishable key', secret: false },
      { key: 'secretKey', labelAr: 'المفتاح السري', labelEn: 'Secret key', secret: true },
      { key: 'webhookSecret', labelAr: 'سر Webhook', labelEn: 'Webhook secret', secret: true },
    ],
  },
  PAYPAL: {
    nameAr: 'PayPal',
    nameEn: 'PayPal',
    sortOrder: 3,
    online: true,
    configKeys: [
      { key: 'clientId', labelAr: 'Client ID', labelEn: 'Client ID', secret: false },
      { key: 'clientSecret', labelAr: 'Client Secret', labelEn: 'Client secret', secret: true },
      { key: 'webhookId', labelAr: 'Webhook ID', labelEn: 'Webhook ID', secret: false },
    ],
  },
  BANK_TRANSFER: {
    nameAr: 'تحويل بنكي',
    nameEn: 'Bank transfer',
    sortOrder: 4,
    online: false,
    configKeys: [
      { key: 'bankName', labelAr: 'اسم البنك', labelEn: 'Bank name' },
      { key: 'accountName', labelAr: 'اسم الحساب', labelEn: 'Account name' },
      { key: 'accountNumber', labelAr: 'رقم الحساب', labelEn: 'Account number' },
      { key: 'iban', labelAr: 'IBAN', labelEn: 'IBAN' },
      { key: 'instructions', labelAr: 'تعليمات', labelEn: 'Instructions' },
    ],
  },
  MANUAL: {
    nameAr: 'دفع يدوي',
    nameEn: 'Manual payment',
    sortOrder: 5,
    online: false,
    configKeys: [{ key: 'instructions', labelAr: 'تعليمات', labelEn: 'Instructions' }],
  },
};

export const ONLINE_GATEWAYS: PaymentGatewaySlug[] = ['THAWANI', 'STRIPE', 'PAYPAL'];
