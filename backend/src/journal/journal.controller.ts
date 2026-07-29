import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JournalService } from './journal.service';
import { CreateJournalDto } from './dto/create-journal.dto';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

@ApiTags('Journal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('journal')
export class JournalController {
  constructor(private journalService: JournalService) {}

  @Get('accounts')
  getAccounts(@CurrentUser() user: TokenPayload) {
    return this.journalService.getAccounts(user.companyId);
  }

  @Get()
  findAll(@CurrentUser() user: TokenPayload, @Query('take') take?: string) {
    const requestedTake = take ? Number(take) : undefined;
    return this.journalService.findAll(
      user.companyId,
      Number.isFinite(requestedTake) ? requestedTake : undefined,
    );
  }

  @Get(':id')
  findOne(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.journalService.findOne(user.companyId, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  create(@CurrentUser() user: TokenPayload, @Body() dto: CreateJournalDto) {
    return this.journalService.create(user.companyId, user.sub, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  remove(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.journalService.remove(user.companyId, id);
  }
}
