import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EmergencyContactsService } from '../auth/emergency-contacts.service';
import { AddEmergencyContactDto } from './dto/emergency-contact.dto';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('emergency-contacts')
@Controller('emergency-contacts')
export class EmergencyContactsController {
  constructor(private readonly service: EmergencyContactsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Add an emergency contact' })
  async addContact(@Request() req: any, @Body() dto: AddEmergencyContactDto) {
    return this.service.addContact(req.user.id, dto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'List my emergency contacts' })
  async getContacts(@Request() req: any) {
    return this.service.getContacts(req.user.id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Remove an emergency contact' })
  async removeContact(@Request() req: any, @Param('id') id: string) {
    await this.service.removeContact(req.user.id, id);
    return { message: 'Contact removed' };
  }

  @Get('count')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get count of active (opted-in) contacts' })
  async getActiveCount(@Request() req: any) {
    const count = await this.service.getActiveCount(req.user.id);
    return { count };
  }
}
