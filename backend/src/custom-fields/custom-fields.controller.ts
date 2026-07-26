import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CustomFieldsService } from './custom-fields.service';
import { CustomFieldDefinitionDto } from './dto/custom-field.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { CustomFieldEntity } from '@prisma/client';

@ApiTags('Custom Fields')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('custom-fields')
export class CustomFieldsController {
  constructor(private service: CustomFieldsService) {}

  @Get()
  @ApiQuery({ name: 'entityType', required: false, enum: CustomFieldEntity })
  findAll(
    @CurrentUser() user: TokenPayload,
    @Query('entityType') entityType?: CustomFieldEntity,
  ) {
    return this.service.findAll(user.companyId, entityType);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  create(@CurrentUser() user: TokenPayload, @Body() dto: CustomFieldDefinitionDto) {
    return this.service.create(user.companyId, dto);
  }

  @Put(':id')
  @Throttle({ default: { limit: 40, ttl: 60000 } })
  update(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: Partial<CustomFieldDefinitionDto>,
  ) {
    return this.service.update(user.companyId, id, dto);
  }

  @Delete(':id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  remove(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.remove(user.companyId, id);
  }
}
