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
import { StorageService } from '../storage/storage.service';

class TestMessageDto {
  @IsString()
  @MinLength(5)
  channel: 'whatsapp' | 'email';

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
    private storage: StorageService,
  ) {}

  @Get('status')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Integration status for WhatsApp, Email, Storage, Payments env' })
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
      storage: {
        driver: this.storage.driver(),
        s3Ready: this.storage.isS3Configured(),
      },
      payments: {
        thawani: !!(process.env.THAWANI_SECRET_KEY || process.env.THAWANI_PUBLISHABLE_KEY),
        stripe: !!(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_PUBLISHABLE_KEY),
        paypal: !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
      },
      ota: {
        note: 'Configure company zatcaConfig on /vat — mock|sandbox|live',
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
          id: 'ota',
          titleAr: 'الفاتورة الإلكترونية (OTA عُمان)',
          stepsAr: [
            'من صفحة الضريبة/الفوترة الإلكترونية اختر الوضع: mock أو sandbox أو live.',
            'mock يُنشئ UUID/QR/XML محلياً فوراً.',
            'sandbox يُحاكي طلب الإرسال ويحفظ حالة الإرسال دون ربط إنتاجي.',
            'live يحتاج بيانات اعتماد الجهة الضريبية عند توفرها في zatcaConfig.',
          ],
        },
        {
          id: 'otp',
          titleAr: 'OTP والموافقات والمستندات',
          stepsAr: [
            'OTP للموافقة المزدوجة: أضف أرقام المديرين ثم استخدم زر إرسال OTP من الكاشير.',
            'إيصالات الكاشير تُرسل تلقائياً عبر واتساب (وإيميل إن ضُبط) بعد البيع/الإلغاء/الاسترداد.',
            'إرسال مستند: استخدم رابط الإيصال العام أو sendDocumentLink من واتساب Cloud API.',
            'اختبار سريع: POST /messaging/test بقناة whatsapp أو email.',
          ],
        },
        {
          id: 'payments',
          titleAr: 'دفع الشريك (بطاقة/محفظة) — ليس شارة NFC',
          stepsAr: [
            'اضبط مفاتيح Thawani أو Stripe أو PayPal على مستوى المنصة/الشركة.',
            'من الكاشير: بعد إنشاء الفاتورة استخدم POST /pos/sales/:invoiceId/partner-checkout لفتح جلسة الدفع.',
            'Thawani UAT: THAWANI_BASE_URL الافتراضي جاهز للاختبار.',
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
          titleAr: 'مخزون أوفلاين',
          stepsAr: [
            'مزامنة كاملة: GET /pos/catalog/sync',
            'تحديثات المخزون: GET /pos/stock/sync?since=ISO — يحدّث الكاش المحلي فقط للكميات المتغيرة',
            'مبيعات الأوفلاين تُصفّ في الطابور ثم تُرسل عند عودة الشبكة',
          ],
        },
        {
          id: 'ai',
          titleAr: 'مساعد AI بإشراف بشري',
          stepsAr: [
            'صفحة التحليلات تعرض اقتراحات قواعدية فقط — لا تنفيذ تلقائي.',
            'زر «إرسال للمراجعة» ينشئ تنبيهات إدارة (Management Alerts) للموافقة البشرية.',
          ],
        },
        {
          id: 'capacitor',
          titleAr: 'Capacitor / BLE',
          stepsAr: [
            'هيكل الموبايل جاهز في mobile/ — راجع README هناك قبل البناء.',
            'BLE للطابعات/الأجهزة: استخدم الإعدادات في frontend/src/lib/capacitor-ble.ts (stubs + vendor presets).',
          ],
        },
      ],
    };
  }

  @Post('test')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Send a test WhatsApp or Email message' })
  async test(@CurrentUser() user: TokenPayload, @Body() dto: TestMessageDto) {
    const body =
      dto.body?.trim() ||
      `رسالة اختبار من Hisaby (${user.email}) — ${new Date().toISOString()}`;

    if (dto.channel === 'whatsapp') {
      const res = await this.whatsapp.sendText(dto.to, body);
      return { channel: 'whatsapp', ...res, mode: this.whatsapp.mode() };
    }

    const res = await this.email.sendText({
      to: dto.to,
      subject: 'Hisaby test message',
      text: body,
    });
    return { channel: 'email', ...res };
  }
}
