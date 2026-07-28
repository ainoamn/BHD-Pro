import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { UserRole } from '@prisma/client';
import { WhatsappNotifyService } from './whatsapp-notify.service';
import { EmailNotifyService } from './email-notify.service';
import { SmsNotifyService } from './sms-notify.service';
import { StorageService } from '../storage/storage.service';

class TestMessageDto {
  @IsIn(['whatsapp', 'email', 'sms'])
  channel: 'whatsapp' | 'email' | 'sms';

  @IsString()
  @MinLength(3)
  to: string;

  @IsOptional()
  @IsString()
  body?: string;
}

@ApiTags('Messaging')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('messaging')
export class MessagingController {
  constructor(
    private whatsapp: WhatsappNotifyService,
    private email: EmailNotifyService,
    private sms: SmsNotifyService,
    private storage: StorageService,
  ) {}

  @Get('status')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Integration status for WhatsApp, Email, SMS, Storage, Payments env' })
  status() {
    return {
      whatsapp: {
        configured: this.whatsapp.isConfigured(),
        mode: this.whatsapp.mode(),
        receiptTemplate: this.whatsapp.receiptTemplateName(),
        guestTemplate: this.whatsapp.guestTemplateName(),
      },
      email: {
        configured: this.email.isConfigured(),
        mode: this.email.mode(),
      },
      sms: {
        configured: this.sms.isConfigured(),
        mode: this.sms.mode(),
      },
      storage: {
        driver: this.storage.driver(),
        s3Ready: this.storage.isS3Configured(),
      },
      payments: {
        thawani: !!(process.env.THAWANI_SECRET_KEY || process.env.THAWANI_PUBLISHABLE_KEY),
        stripe: !!(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_PUBLISHABLE_KEY),
        paypal: !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
        terminalMode: process.env.POS_TERMINAL_MODE || 'hosted',
      },
      ota: {
        note: 'Configure company zatcaConfig on /vat — mock|sandbox|live',
      },
      ai: {
        llm: !!(process.env.OPENAI_API_KEY || process.env.AI_LLM_API_KEY),
        note: 'Rules engine always on; LLM enriches summaries when key is set (HITL only)',
      },
    };
  }

  @Get('readme')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.CASHIER)
  @ApiOperation({ summary: 'Arabic/English setup guide for messaging & integrations' })
  readme() {
    return {
      titleAr: 'دليل الربط — واتساب والبريد والمدفوعات والفاتورة الإلكترونية',
      titleEn: 'Integrations setup — WhatsApp, Email, Payments, OTA',
      sections: [
        {
          id: 'whatsapp',
          titleAr: 'واتساب (Meta Cloud API) — جاهز برمجياً · التفعيل لاحقاً',
          stepsAr: [
            'الوضع الحالي: الكود يرسل تلقائياً بعد البيع/OTP عند ضبط المفاتيح — بدون Meta لا يُرسل حقيقياً.',
            'لاحقاً: business.facebook.com → محفظة أعمال → developers.facebook.com → Create App → WhatsApp.',
            'من API Setup انسخ Access Token و Phone number ID.',
            'ضعها على Render: WHATSAPP_TOKEN و WHATSAPP_PHONE_NUMBER_ID (إنتاج: System User token دائم).',
            'للاختبار الداخلي فقط: WHATSAPP_TOKEN=mock',
            'أضف أرقام المديرين في whatsappNotifyPhones — واترك autoSendPosReceipts مفعّلاً.',
            'لإيصالات أول تواصل مع العميل: أنشئ قالب Utility في WhatsApp Manager (5 متغيرات) واضبط WHATSAPP_RECEIPT_TEMPLATE — بدون قالب Meta ترفض الرسالة خارج نافذة 24 ساعة.',
            'المحاسبة: عند وضع الفاتورة SENT/PAID يُرسل نفس قالب الإيصال للعميل تلقائياً.',
            'المطاعم: إشعارات الطاولة/الحجز تستخدم نفس القالب أو WHATSAPP_GUEST_TEMPLATE.',
            'دليل كامل: docs/MESSAGING-WHATSAPP-EMAIL-GUIDE.md',
          ],
        },
        {
          id: 'email',
          titleAr: 'البريد الإلكتروني — مربوط برمجياً',
          stepsAr: [
            'الخيار أ (موصى): RESEND_API_KEY + EMAIL_FROM على نطاقك.',
            'الخيار ب: SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS.',
            'بدون مفاتيح: EMAIL_MODE=mock أو القناة off — لا إرسال حقيقي.',
            'يُرسل تلقائياً مع إيصال الكاشير إن وُجد بريد للعميل.',
            'دليل كامل: docs/MESSAGING-WHATSAPP-EMAIL-GUIDE.md',
          ],
        },
        {
          id: 'sms',
          titleAr: 'رسائل SMS (Twilio)',
          stepsAr: [
            'ضع TWILIO_ACCOUNT_SID و TWILIO_AUTH_TOKEN و TWILIO_FROM في بيئة الـ API.',
            'للاختبار بدون Twilio: TWILIO_MODE=mock',
            'تُرسل تلقائياً مع إيصالات الكاشير عند توفر رقم الجوال (إلى جانب واتساب).',
            'اختبار: POST /messaging/test بقناة sms.',
          ],
        },
        {
          id: 'ota',
          titleAr: 'الفاتورة الإلكترونية (OTA عُمان)',
          stepsAr: [
            'من صفحة الضريبة/الفوترة الإلكترونية اختر الوضع: mock أو sandbox أو live.',
            'mock يُنشئ UUID/QR/XML محلياً فوراً.',
            'sandbox يُحاكي قبول الجهة بدون HTTP خارجي.',
            'live يُرسل HTTP إلى apiBaseUrl عند ضبط clientId/clientSecret في zatcaConfig (مسار /v1/invoices افتراضياً).',
          ],
        },
        {
          id: 'otp',
          titleAr: 'OTP والموافقات والمستندات',
          stepsAr: [
            'OTP للموافقة المزدوجة: أضف أرقام المديرين ثم استخدم زر إرسال OTP من الكاشير.',
            'إيصالات الكاشير: واتساب + إيميل + SMS (إن ضُبطت) بعد البيع/الإلغاء/الاسترداد.',
            'اختبار سريع: POST /messaging/test بقناة whatsapp أو email أو sms.',
          ],
        },
        {
          id: 'payments',
          titleAr: 'دفع الشريك + Terminal tap-to-pay',
          stepsAr: [
            'اضبط مفاتيح Thawani أو Stripe أو PayPal على مستوى المنصة/الشركة.',
            'من الكاشير: دفع شريك → partner-checkout، أو «لمس/Terminal» → terminal-tap.',
            'POS_TERMINAL_MODE=mock|hosted|softpos — SoftPOS يحتاج POS_SOFTPOS_DEEP_LINK_TEMPLATE.',
            'شارة NFC في الكاشير للموافقة المزدوجة فقط — ليست دفعاً للعميل.',
          ],
        },
        {
          id: 'storage',
          titleAr: 'تخزين المرفقات',
          stepsAr: [
            'افتراضي: data URL داخل قاعدة البيانات (حتى 2MB).',
            'محلي: ATTACHMENT_STORAGE=local و ATTACHMENT_LOCAL_DIR',
            'S3: ATTACHMENT_STORAGE=s3 + S3_BUCKET/REGION/KEYS (+ تثبيت @aws-sdk/client-s3)',
          ],
        },
        {
          id: 'offline',
          titleAr: 'أوفلاين',
          stepsAr: [
            'مزامنة كاملة: GET /pos/catalog/sync',
            'تحديثات المخزون: GET /pos/stock/sync?since=ISO',
            'مبيعات الأوفلاين: طابور IndexedDB + clientSaleId لمنع التكرار عند إعادة الإرسال',
          ],
        },
        {
          id: 'ai',
          titleAr: 'مساعد AI بإشراف بشري',
          stepsAr: [
            'قواعد rules_v1 دائماً — لا تنفيذ تلقائي.',
            'عند ضبط OPENAI_API_KEY أو AI_LLM_API_KEY يُضاف ملخص LLM اختياري دون تنفيذ.',
            'زر «إرسال للمراجعة» → Management Alerts.',
          ],
        },
        {
          id: 'capacitor',
          titleAr: 'Capacitor / BLE',
          stepsAr: [
            'راجع mobile/package.json و README — غلاف أصلي حول /pos.',
            'BLE: frontend/src/lib/capacitor-ble.ts + Web Bluetooth fallback في pos-escpos.',
          ],
        },
      ],
    };
  }

  @Post('test')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Send a test WhatsApp, Email, or SMS message' })
  async test(@CurrentUser() user: TokenPayload, @Body() dto: TestMessageDto) {
    const body =
      dto.body?.trim() ||
      `رسالة اختبار من Hisaby (${user.email}) — ${new Date().toISOString()}`;

    if (dto.channel === 'whatsapp') {
      const template = this.whatsapp.receiptTemplateName();
      if (template) {
        const names = this.whatsapp.receiptParamNames();
        const res = await this.whatsapp.sendTemplate(
          dto.to,
          template,
          ['اختبار', 'Hisaby', 'TEST-001', '0.000 OMR', 'https://hisaby.pro'],
          undefined,
          names,
        );
        return {
          channel: 'whatsapp',
          ...res,
          mode: this.whatsapp.mode(),
          via: 'template',
          template,
        };
      }
      const res = await this.whatsapp.sendText(dto.to, body);
      return {
        channel: 'whatsapp',
        ...res,
        mode: this.whatsapp.mode(),
        via: 'text',
        hint: res.ok
          ? undefined
          : 'Outside the 24h window Meta requires WHATSAPP_RECEIPT_TEMPLATE (approved Utility template).',
      };
    }

    if (dto.channel === 'sms') {
      const res = await this.sms.sendText({ to: dto.to, body });
      return { channel: 'sms', ...res };
    }

    const res = await this.email.sendText({
      to: dto.to,
      subject: 'Hisaby test message',
      text: body,
    });
    return { channel: 'email', ...res };
  }
}
