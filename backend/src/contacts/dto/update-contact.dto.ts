import { PartialType } from '@nestjs/swagger';
import { CreateContactDto } from './create-contact.dto';
import { IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateContactDto extends PartialType(CreateContactDto) {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  currentBalance?: number;
}
