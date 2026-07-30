import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { createHash } from 'crypto';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { assertProductionSecrets } from './common/crypto/secrets.crypto';
import { initSentry } from './observability/sentry';

async function bootstrap() {
  assertProductionSecrets();
  await initSentry();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const trustProxyHops = Number(
    process.env.TRUST_PROXY_HOPS ||
      (process.env.NODE_ENV === 'production' ? '1' : '0'),
  );
  if (Number.isInteger(trustProxyHops) && trustProxyHops > 0) {
    app.set('trust proxy', trustProxyHops);
  }

  // Attachments / company logo travel as base64 data URLs (~2MB ceiling → ~2.8MB JSON).
  // Keep rawBody for payment webhooks via Nest's useBodyParser.
  app.useBodyParser('json', { limit: '4mb' });
  app.useBodyParser('urlencoded', { limit: '4mb', extended: true });

  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: (origin, callback) => {
      const raw = process.env.CORS_ORIGIN || 'http://localhost:3000';
      const allowed = raw.split(',').map((s) => s.trim()).filter(Boolean);
      const allowVercelPreviews =
        process.env.CORS_ALLOW_VERCEL_PREVIEWS === '1' ||
        process.env.CORS_ALLOW_VERCEL_PREVIEWS === 'true';
      if (
        !origin ||
        allowed.includes('*') ||
        allowed.includes(origin) ||
        (allowVercelPreviews &&
          /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin))
      ) {
        callback(null, true);
        return;
      }
      // Do not pass Error — that becomes HTTP 500; just deny the origin
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Company-ID'],
  });

  app.setGlobalPrefix('api');

  // Allow X-API-Key / Bearer qk_* before JWT guards
  const prisma = app.get(PrismaService);
  app.use(async (req: any, _res: any, next: () => void) => {
    try {
      const headerKey = req.headers['x-api-key'];
      const auth = req.headers['authorization'] as string | undefined;
      let secret: string | undefined;
      if (typeof headerKey === 'string' && headerKey.startsWith('qk_')) {
        secret = headerKey.trim();
      } else if (typeof auth === 'string' && auth.startsWith('Bearer qk_')) {
        secret = auth.slice(7).trim();
      }

      if (secret) {
        const keyHash = createHash('sha256').update(secret).digest('hex');
        const row = await prisma.companyApiKey.findFirst({
          where: { keyHash, revokedAt: null },
          include: { company: { select: { isActive: true } } },
        });
        if (row?.company.isActive) {
          req.user = {
            sub: row.createdById || `api-key:${row.id}`,
            email: `api-key@${row.companyId}.local`,
            role: 'ACCOUNTANT',
            companyId: row.companyId,
          };
          req.apiKeyAuthenticated = true;
          prisma.companyApiKey
            .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
            .catch(() => undefined);
        }
      }
    } catch {
      // ignore and fall through to JWT
    }
    next();
  });

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('BHD Pro API')
      .setDescription('Omani Accounting SaaS API — سلطنة عُمان')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`BHD Pro API running on http://localhost:${port}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Swagger docs: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
