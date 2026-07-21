import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EmployeeClaimsService } from './employee-claims.service';
import {
  CreateEmployeeClaimDto,
  UpdateEmployeeClaimDto,
  RejectClaimDto,
} from './dto/employee-claim.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

@ApiTags('Employee Claims')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('employee-claims')
export class EmployeeClaimsController {
  constructor(private service: EmployeeClaimsService) {}

  @Get()
  findAll(@CurrentUser() user: TokenPayload) {
    return this.service.findAll(user.companyId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.findOne(user.companyId, id);
  }

  @Post()
  create(@CurrentUser() user: TokenPayload, @Body() dto: CreateEmployeeClaimDto) {
    return this.service.create(user.companyId, user.sub, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeClaimDto,
  ) {
    return this.service.update(user.companyId, id, dto);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit claim for approval' })
  submit(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.submit(user.companyId, id);
  }

  @Post(':id/approve')
  approve(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.approve(user.companyId, id);
  }

  @Post(':id/reject')
  reject(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: RejectClaimDto,
  ) {
    return this.service.reject(user.companyId, id, dto);
  }

  @Post(':id/pay')
  @ApiOperation({ summary: 'Mark approved claim as paid/reimbursed' })
  markPaid(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.markPaid(user.companyId, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.remove(user.companyId, id);
  }
}
