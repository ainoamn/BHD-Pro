import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DeliveryNotesService } from './delivery-notes.service';
import { CreateDeliveryNoteDto } from './dto/create-delivery-note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

@ApiTags('Delivery Notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('delivery-notes')
export class DeliveryNotesController {
  constructor(private service: DeliveryNotesService) {}

  @Get()
  findAll(@CurrentUser() user: TokenPayload) {
    return this.service.findAll(user.companyId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.findOne(user.companyId, id);
  }

  @Post()
  create(@CurrentUser() user: TokenPayload, @Body() dto: CreateDeliveryNoteDto) {
    return this.service.create(user.companyId, user.sub, dto);
  }

  @Post(':id/deliver')
  @ApiOperation({ summary: 'Confirm delivery and deduct stock' })
  deliver(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.deliver(user.companyId, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.cancel(user.companyId, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.remove(user.companyId, id);
  }
}
