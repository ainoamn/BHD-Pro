import { IsOptional, IsString, MinLength } from 'class-validator';

export class CompleteInviteDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  username?: string;
}
