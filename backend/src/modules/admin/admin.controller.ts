import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  // Users
  @Get('users')
  listUsers(@Query() q: any) {
    return this.admin.listUsers(q);
  }

  @Get('users/:id')
  userDetail(@Param('id') id: string) {
    return this.admin.userDetail(id);
  }

  @Patch('users/:id/suspend')
  suspend(@Param('id') id: string, @Body('reason') reason: string) {
    return this.admin.suspendUser(id, reason);
  }

  @Patch('users/:id/unsuspend')
  unsuspend(@Param('id') id: string) {
    return this.admin.unsuspendUser(id);
  }

  @Patch('users/:id/ban')
  ban(@Param('id') id: string, @Body('reason') reason: string) {
    return this.admin.banUser(id, reason);
  }

  // Trips
  @Get('trips')
  listTrips(@Query() q: any) {
    return this.admin.listTrips(q);
  }

  @Post('trips/:id/cancel')
  cancelTrip(@Param('id') id: string, @Body('reason') reason: string) {
    return this.admin.cancelTrip(id, reason);
  }

  // Bookings / Payments
  @Get('bookings')
  listBookings(@Query() q: any) {
    return this.admin.listBookings(q);
  }

  @Get('payments')
  listPayments(@Query() q: any) {
    return this.admin.listPayments(q);
  }

  // Safety
  @Get('safety/sos')
  sos() {
    return this.admin.sosAlerts();
  }

  @Get('safety/incidents')
  incidents(@Query() q: any) {
    return this.admin.listIncidents(q);
  }

  // Config
  @Get('config')
  getConfig() {
    return this.admin.getConfig();
  }

  @Patch('config')
  updateConfig(@Body() body: Record<string, unknown>) {
    return this.admin.updateConfig(body);
  }

  // Subscriptions
  @Get('subscriptions')
  subscriptions(@Query() q: any) {
    return this.admin.listSubscriptions(q);
  }

  @Post('subscriptions/:userId/trial')
  overrideTrial(@Param('userId') userId: string, @Body('days') days: number) {
    return this.admin.overrideTrial(userId, days);
  }

  // Notifications
  @Post('notifications/broadcast')
  broadcast(
    @Body('title') title: string,
    @Body('body') body: string,
    @Body('role') role?: string,
  ) {
    return this.admin.broadcastNotification(title, body, role);
  }

  // Driver docs
  @Get('driver-docs')
  driverDocs() {
    return this.admin.driverDocs();
  }

  @Patch('driver-docs/vehicles/:id/verify')
  verifyVehicle(@Param('id') id: string, @Body('approved') approved: boolean) {
    return this.admin.verifyVehicle(id, approved);
  }

  // Mobile vehicle review — the fleet Sailors actually ride in.
  @Get('vehicle-review')
  vehicleReviewQueue(@Query('status') status?: string) {
    return this.admin.vehicleReviewQueue(status || 'pending_review');
  }

  @Patch('vehicle-review/:id')
  reviewMobileVehicle(
    @Param('id') id: string,
    @Body('approved') approved: boolean,
    @Body('note') note?: string,
  ) {
    return this.admin.reviewMobileVehicle(id, approved, note);
  }

  // Audit
  @Get('audit')
  audit(@Query() q: any) {
    return this.admin.listAudit(q);
  }

  @Get('compliance-logs')
  complianceLogs(@Query() q: { rule?: string; user_id?: string }) {
    return this.admin.listComplianceLogs(q);
  }

  @Get('driver-trips/summary')
  driverTripsSummary() {
    return this.admin.driverTripsSummary();
  }

  @Get('driver-earnings/:id')
  driverEarnings(@Param('id') id: string) {
    return this.admin.driverEarnings(id);
  }

  // Support tickets
  @Get('support-tickets')
  tickets(@Query() q: any) {
    return this.admin.listTickets(q);
  }

  @Get('support-tickets/:id')
  ticket(@Param('id') id: string) {
    return this.admin.getTicket(id);
  }

  @Patch('support-tickets/:id/status')
  ticketStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.admin.updateTicketStatus(id, status);
  }

  @Get('support-tickets/:id/messages')
  ticketMessages(@Param('id') id: string) {
    return this.admin.ticketMessagesFor(id);
  }

  @Post('support-tickets/:id/messages')
  addTicketMessage(@Param('id') id: string, @Body() dto: any) {
    return this.admin.addTicketMessage(id, dto);
  }

  // Support agents
  @Get('support-agents')
  agents() {
    return this.admin.listAgents();
  }

  @Post('support-agents')
  createAgent(@Body() dto: any) {
    return this.admin.createAgent(dto);
  }

  @Patch('support-agents/:id/toggle')
  toggleAgent(@Param('id') id: string, @Body('active') active: boolean) {
    return this.admin.toggleAgent(id, active);
  }
}
