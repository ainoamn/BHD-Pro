import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
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
  @IsString()
  @MinLength(3)
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
          titleAr: 'واتساب (Meta Cloud API)',
          stepsAr: [
            'أنشئ تطبيق Meta Business واحصل على WhatsApp Cloud API.',
            'ضع WHATSAPP_TOKEN و WHATSAPP_PHONE_NUMBER_ID في بيئة الـ API.',
            'للاختبار بدون ميتا: WHATSAPP_TOKEN=mock',
            'فعّل الإرسال التلقائي لإيصالات الكاشير من إعدادات الحماية (dual-control).',
            'أضف أرقام المديرين في whatsappNotifyPhones لاستلام OTP وطلبات الموافقة.',
          ],
        },
        {
          id: 'email',
          titleAr: 'البريد الإلكتروني',
          stepsAr: [
            'الخيار أ: RESEND_API_KEY + EMAIL_FROM',
            'الخيار ب: SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS (+ تثبيت nodemailer)',
            'للاختبار: EMAIL_MODE=mock (يُسجَّل في سجلات الخادم فقط)',
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
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Send a test WhatsApp, Email, or SMS message' })
  async test(@CurrentUser() user: TokenPayload, @Body() dto: TestMessageDto) {
    const body =
      dto.body?.trim() ||
      `رسالة اختبار من Hisaby (${user.email}) — ${new Date().toISOString()}`;

    if (dto.channel === 'whatsapp') {
      const res = await this.whatsapp.sendText(dto.to, body);
      return { channel: 'whatsapp', ...res, mode: this.whatsapp.mode() };
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
