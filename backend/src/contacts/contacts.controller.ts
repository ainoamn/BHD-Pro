import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { ContactType } from '@prisma/client';

@ApiTags('Contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private contactsService: ContactsService) {}

  @Get()
  @ApiQuery({ name: 'type', required: false, enum: ContactType })
  findAll(@CurrentUser() user: TokenPayload, @Query('type') type?: ContactType) {
    return this.contactsService.findAll(user.companyId, type);
  }

  @Get(':id')
  findOne(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.contactsService.findOne(user.companyId, id);
  }

  @Post()
  create(@CurrentUser() user: TokenPayload, @Body() dto: CreateContactDto) {
    return this.contactsService.create(user.companyId, dto);
  }

  @Put(':id')
  update(@CurrentUser() user: TokenPayload, @Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contactsService.update(user.companyId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.contactsService.remove(user.companyId, id);
  }
}
