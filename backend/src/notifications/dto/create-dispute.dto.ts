import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class CreateDisputeDto {
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  reporterPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reporterName?: string;
}
