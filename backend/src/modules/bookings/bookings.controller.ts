import { Controller, Get, Post, Body, Param, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, CancelBookingDto, SubmitRatingDto } from './dto/booking.dto';

@ApiTags('bookings')
@UseGuards(AuthGuard('jwt'))
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Create a new booking and payment intent' })
  async createBooking(@Request() req: any, @Body() dto: CreateBookingDto) {
    return this.bookingsService.createBooking(req.user.id, dto);
  }

  @Post('confirm-payment')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Confirm payment after Stripe SDK completes' })
  async confirmPayment(@Body('booking_id') bookingId: string) {
    return this.bookingsService.confirmPayment(bookingId);
  }

  @Post(':id/accept')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Driver accepts booking' })
  async driverAccept(@Request() req: any, @Param('id') id: string) {
    return this.bookingsService.driverAccept(id, req.user.id);
  }

  @Post(':id/decline')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Driver declines booking with auto-refund' })
  async driverDecline(@Request() req: any, @Param('id') id: string) {
    return this.bookingsService.driverDecline(id, req.user.id);
  }

  @Post(':id/capture')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Capture payment when driver marks departing' })
  async capturePayment(@Request() req: any, @Param('id') id: string) {
    return this.bookingsService.capturePayment(id, req.user.id);
  }

  @Post(':id/cancel')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Cancel a booking with refund calculation' })
  async cancelBooking(@Request() req: any, @Param('id') id: string, @Body() dto: CancelBookingDto) {
    return this.bookingsService.cancelBooking(req.user.id, id, dto);
  }

  @Post(':id/complete')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Mark booking as completed, schedule payout' })
  async completeBooking(@Request() req: any, @Param('id') id: string) {
    return this.bookingsService.completeBooking(id, req.user.id);
  }

  @Post(':id/rating')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Submit rating for a completed trip' })
  async submitRating(@Request() req: any, @Param('id') id: string, @Body() dto: SubmitRatingDto) {
    return this.bookingsService.submitRating(req.user.id, id, dto);
  }

  @Get(':id/rating-status')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Check if booking can be rated and rating status' })
  async getRatingStatus(@Request() req: any, @Param('id') id: string) {
    return this.bookingsService.getBookingRatingStatus(id, req.user.id);
  }

  @Get('my')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'List rider bookings' })
  async getMyBookings(@Request() req: any) {
    return this.bookingsService.getMyBookings(req.user.id);
  }

  @Get('driver/my')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: "List driver's incoming bookings" })
  async getDriverBookings(@Request() req: any) {
    return this.bookingsService.getDriverBookings(req.user.id);
  }

  @Get('driver/upcoming')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: "Get driver's upcoming confirmed bookings with trip info" })
  async getDriverUpcoming(@Request() req: any) {
    return this.bookingsService.getDriverUpcomingBookings(req.user.id);
  }

  @Post(':id/video-check')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Upload 360° vehicle check-in video before starting ride' })
  async uploadVideoCheck(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { base64_video: string; mime_type: string },
  ) {
    return this.bookingsService.uploadVideoCheck(id, req.user.id, body.base64_video, body.mime_type);
  }

  @Get(':id')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get booking details' })
  async getBooking(@Param('id') id: string) {
    return this.bookingsService.getBooking(id);
  }
}
