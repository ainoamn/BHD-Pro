import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BhdSsoService } from './bhd-sso.service';
import { BhdSsoController } from './bhd-sso.controller';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    NotificationsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const expiresIn = config.get<string>('jwt.expiration') as NonNullable<
          JwtModuleOptions['signOptions']
        >['expiresIn'];
        return {
          secret: config.get<string>('jwt.secret'),
          signOptions: { expiresIn },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, BhdSsoController],
  providers: [AuthService, JwtStrategy, BhdSsoService],
  exports: [AuthService, BhdSsoService],
})
export class AuthModule {}
