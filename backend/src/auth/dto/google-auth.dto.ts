import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class GoogleAuthDto {
  @IsString()
  @IsNotEmpty({ message: 'Google credential is required' })
  idToken: string;

  /** Optional company name when creating a new account via Google */
  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{2}$/)
  country?: string;
}
