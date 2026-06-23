import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TripsService } from './trips.service';
import { CreateTripDto, UpdateTripDto, SearchTripsDto, SaveSearchDto, CreateReplyDto } from './dto/trip.dto';

@ApiTags('trips')
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Create a new trip' })
  async createTrip(@Request() req: any, @Body() dto: CreateTripDto) {
    return this.tripsService.createTrip(req.user.id, dto);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search for trips' })
  @ApiQuery({ name: 'origin_metro', required: true })
  @ApiQuery({ name: 'dest_metro', required: true })
  @ApiQuery({ name: 'travel_date', required: true })
  async searchTrips(@Request() req: any, @Query() params: SearchTripsDto) {
    const riderId = req.user?.id;
    return this.tripsService.searchTrips(params, riderId);
  }

  @Post('searches/save')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Save a search for quick re-search' })
  async saveSearch(@Request() req: any, @Body() dto: SaveSearchDto) {
    return this.tripsService.saveSearch(req.user.id, dto);
  }

  @Get('searches')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get saved searches' })
  async getSavedSearches(@Request() req: any) {
    return this.tripsService.getSavedSearches(req.user.id);
  }

  @Delete('searches/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Delete a saved search' })
  async deleteSavedSearch(@Request() req: any, @Param('id') id: string) {
    await this.tripsService.deleteSavedSearch(req.user.id, id);
    return { message: 'Saved search deleted' };
  }

  @Get('my-trips')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: "List driver's posted trips" })
  async getMyTrips(@Request() req: any) {
    return this.tripsService.getMyTrips(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get trip details' })
  async getTrip(@Param('id') id: string) {
    return this.tripsService.getTrip(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update a trip' })
  async updateTrip(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateTripDto) {
    return this.tripsService.updateTrip(req.user.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Cancel a trip' })
  async cancelTrip(@Request() req: any, @Param('id') id: string) {
    await this.tripsService.cancelTrip(req.user.id, id);
    return { message: 'Trip cancelled' };
  }

  @Get(':id/replies')
  @ApiOperation({ summary: 'Get replies for a trip' })
  async getReplies(@Param('id') id: string) {
    return this.tripsService.getReplies(id);
  }

  @Post(':id/reply')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Reply to a trip post' })
  async createReply(@Request() req: any, @Param('id') id: string, @Body() dto: CreateReplyDto) {
    return this.tripsService.createReply(req.user.id, id, dto);
  }

  @Post(':id/book')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Quick-book a trip (1 seat, no extras)' })
  async quickBook(@Request() req: any, @Param('id') id: string) {
    return this.tripsService.quickBook(req.user.id, id);
  }

  @Post(':id/depart')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Mark trip as departing' })
  async markDeparting(@Request() req: any, @Param('id') id: string) {
    await this.tripsService.markDeparting(req.user.id, id);
    return { message: 'Trip marked as departing' };
  }

  @Post(':id/complete')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Mark trip as completed' })
  async markCompleted(@Request() req: any, @Param('id') id: string) {
    await this.tripsService.markCompleted(req.user.id, id);
    return { message: 'Trip marked as completed' };
  }
}
