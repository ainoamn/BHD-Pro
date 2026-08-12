import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const SIX_DIGIT_TOTP = /^\d{6}$/;

export class TotpCodeDto {
  @IsString()
  @Matches(SIX_DIGIT_TOTP)
  code: string;
}

export class Verify2faLoginDto {
  @IsString()
  @MaxLength(2048)
  tempToken: string;

  @IsString()
  @Matches(SIX_DIGIT_TOTP)
  code: string;
}

export class Disable2faDto {
  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @Matches(SIX_DIGIT_TOTP)
  code: string;
}

export class LoginWithTotpDto {
  @IsOptional()
  @IsString()
  @Matches(SIX_DIGIT_TOTP)
  totpCode?: string;
}
