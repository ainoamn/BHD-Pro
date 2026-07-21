import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  /** Optional when refresh token is sent via httpOnly cookie */
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
