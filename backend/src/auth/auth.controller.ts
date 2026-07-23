import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Disable2faDto, TotpCodeDto, Verify2faLoginDto } from './dto/two-factor.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from './auth-cookies';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    if ('requires2fa' in result && result.requires2fa) {
      return result;
    }
    if ('accessToken' in result && 'refreshToken' in result) {
      setAuthCookies(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    }
    return result;
  }

  @Post('2fa/verify-login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete login with TOTP code' })
  async verify2faLogin(
    @Body() dto: Verify2faLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verify2faLogin(dto.tempToken, dto.code);
    setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    return result;
  }

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  get2faStatus(@Req() req: Request & { user: { sub: string } }) {
    return this.authService.get2faStatus(req.user.sub);
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate TOTP secret + QR (not enabled until confirm)' })
  setup2fa(@Req() req: Request & { user: { sub: string } }) {
    return this.authService.setup2fa(req.user.sub);
  }

  @Post('2fa/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  confirm2fa(@Req() req: Request & { user: { sub: string } }, @Body() dto: TotpCodeDto) {
    return this.authService.confirm2fa(req.user.sub, dto.code);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  disable2fa(@Req() req: Request & { user: { sub: string } }, @Body() dto: Disable2faDto) {
    return this.authService.disable2fa(req.user.sub, dto.password, dto.code);
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register new user and company' })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  @ApiResponse({ status: 403, description: 'Email already exists' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    return result;
  }

  @Post('google')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in or register with Google ID token' })
  async googleAuth(@Body() dto: GoogleAuthDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.loginWithGoogle(dto.idToken, dto.companyName);
    if ('requires2fa' in result && result.requires2fa) {
      return result;
    }
    if ('accessToken' in result && 'refreshToken' in result) {
      setAuthCookies(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    }
    return result;
  }

  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token (cookie or body)' })
  async refreshToken(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      dto.refreshToken ||
      (req.cookies?.[REFRESH_COOKIE] as string | undefined);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }
    const tokens = await this.authService.refreshToken(refreshToken);
    setAuthCookies(res, tokens);
    return tokens;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  async logout(@Req() req: Request & { user: { sub: string } }, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.logout(req.user.sub);
    clearAuthCookies(res);
    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Req() req: Request & { user: { sub: string } }) {
    return this.authService.getProfile(req.user.sub);
  }
}
