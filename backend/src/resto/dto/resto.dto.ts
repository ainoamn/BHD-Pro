import { IsString } from 'class-validator';

export class LinkRestoDto {
  @IsString()
  key: string;
}
