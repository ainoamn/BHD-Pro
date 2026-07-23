import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GoogleAuthDto {
  @IsString()
  @IsNotEmpty({ message: 'Google credential is required' })
  idToken: string;

  /** Optional company name when creating a new account via Google */
  @IsOptional()
  @IsString()
  companyName?: string;
}
