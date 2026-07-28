import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateDisputeStatusDto {
  @IsString()
  @IsIn(['OPEN', 'REVIEWED', 'RESOLVED', 'DISMISSED'])
  status!: 'OPEN' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED';
}

export class ListDisputesQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['OPEN', 'REVIEWED', 'RESOLVED', 'DISMISSED', 'ALL'])
  status?: string;
}
