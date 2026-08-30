import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SupportService } from './support.service';
import { SupportAuthGuard } from './support-auth.guard';

@ApiTags('support')
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('auth/login')
  @ApiOperation({
    summary: 'Authenticate a support agent and create a session',
  })
  async login(
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    return this.supportService.login(email, password);
  }

  @Get('tickets')
  @UseGuards(SupportAuthGuard)
  @ApiOperation({
    summary: 'List support tickets with optional filters and pagination',
  })
  async listTickets(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('assignee_id') assignee_id?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.supportService.listTickets({
      status,
      priority,
      assignee_id,
      page,
      limit,
    });
  }

  @Get('tickets/:id')
  @UseGuards(SupportAuthGuard)
  @ApiOperation({ summary: 'Get a support ticket with its messages' })
  async getTicket(@Param('id') id: string) {
    return this.supportService.getTicket(id);
  }

  @Post('tickets')
  @ApiOperation({
    summary: 'Create a support ticket (no auth required for customers)',
  })
  async createTicket(
    @Body('subject') subject: string,
    @Body('requester_name') requester_name: string,
    @Body('requester_role') requester_role: string,
    @Body('requester_email') requester_email?: string,
    @Body('requester_phone') requester_phone?: string,
    @Body('trip_id') trip_id?: string,
    @Body('trip_origin') trip_origin?: string,
    @Body('trip_destination') trip_destination?: string,
    @Body('trip_departure_at') trip_departure_at?: string,
    @Body('trip_driver_name') trip_driver_name?: string,
    @Body('trip_price_cents') trip_price_cents?: number,
  ) {
    return this.supportService.createTicket({
      subject,
      requester_name,
      requester_role,
      requester_email,
      requester_phone,
      trip_id,
      trip_origin,
      trip_destination,
      trip_departure_at,
      trip_driver_name,
      trip_price_cents,
    });
  }

  @Post('tickets/:id/messages')
  @ApiOperation({ summary: 'Add a message to a ticket (no auth needed)' })
  async addMessage(
    @Param('id') id: string,
    @Body('body') body: string,
    @Body('author_type') author_type: string,
    @Body('author_name') author_name: string,
    @Body('author_agent_id') author_agent_id?: string,
    @Body('internal') internal?: boolean,
  ) {
    return this.supportService.addMessage(id, {
      body,
      author_type,
      author_name,
      author_agent_id,
      internal,
    });
  }

  @Patch('tickets/:id/status')
  @UseGuards(SupportAuthGuard)
  @ApiOperation({ summary: 'Update ticket status (auth required)' })
  async updateTicketStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Req() req: any,
  ) {
    return this.supportService.updateTicketStatus(id, status, req.agent.id);
  }

  @Patch('tickets/:id/assign')
  @UseGuards(SupportAuthGuard)
  @ApiOperation({ summary: 'Assign a ticket to an agent (auth required)' })
  async assignTicket(
    @Param('id') id: string,
    @Body('agent_id') agentId: string,
  ) {
    return this.supportService.assignTicket(id, agentId);
  }

  @Get('agents')
  @UseGuards(SupportAuthGuard)
  @ApiOperation({ summary: 'List all support agents (auth required)' })
  async listAgents() {
    return this.supportService.listAgents();
  }

  @Post('agents')
  @UseGuards(SupportAuthGuard)
  @ApiOperation({
    summary: 'Create a support agent (auth required, admin only)',
  })
  async createAgent(
    @Body('name') name: string,
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('role') role: string,
    @Req() req: any,
  ) {
    if (req.agent.role !== 'admin') {
      throw new UnauthorizedException('Only admins can create agents');
    }
    return this.supportService.createAgent({ name, email, password, role });
  }

  @Get('dashboard')
  @UseGuards(SupportAuthGuard)
  @ApiOperation({ summary: 'Get dashboard statistics (auth required)' })
  async getDashboardStats() {
    return this.supportService.getDashboardStats();
  }
}
