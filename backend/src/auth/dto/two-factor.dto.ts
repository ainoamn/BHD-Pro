import { IsOptional, IsString, Length, MinLength } from 'class-validator';

export class TotpCodeDto {
  @IsString()
  @Length(6, 8)
  code: string;
}

export class Verify2faLoginDto {
  @IsString()
  tempToken: string;

  @IsString()
  @Length(6, 8)
  code: string;
}

export class Disable2faDto {
  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @Length(6, 8)
  code: string;
}

export class LoginWithTotpDto {
  @IsOptional()
  @IsString()
  @Length(6, 8)
  totpCode?: string;
}
