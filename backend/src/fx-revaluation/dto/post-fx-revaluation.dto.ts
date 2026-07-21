import { IsArray, IsDateString, IsOptional, IsUUID } from 'class-validator';

export class PostFxRevaluationDto {
  @IsDateString()
  asOf: string;

  /** Optional subset of invoice IDs from preview; default = all with gain/loss */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  invoiceIds?: string[];
}
