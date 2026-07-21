import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

@ApiTags('Companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  @Get('me')
  getMyCompany(@CurrentUser() user: TokenPayload) {
    return this.companiesService.getCompany(user.companyId);
  }

  @Put('me')
  updateMyCompany(@CurrentUser() user: TokenPayload, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.updateCompany(user.companyId, dto);
  }
}
