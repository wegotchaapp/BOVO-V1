import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { DriverTripsService } from './driver-trips.service';

@ApiTags('driver-trips')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'))
@Controller('driver-trips')
export class DriverTripsController {
  constructor(private readonly driverTripsService: DriverTripsService) {}

  @Get()
  @ApiOperation({ summary: "Get current driver's trips" })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getDriverTrips(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.driverTripsService.getDriverTrips(
      req.user.sub,
      page ? parseInt(String(page)) : 1,
      limit ? parseInt(String(limit)) : 20,
    );
  }

  @Get('earnings')
  @ApiOperation({ summary: 'Get earnings summary' })
  async getDriverEarnings(@Request() req: any) {
    return this.driverTripsService.getDriverEarnings(req.user.sub);
  }

  @Get('earnings/report')
  @ApiOperation({ summary: 'Get earnings by period for tax reporting' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async getEarningsReport(
    @Request() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.driverTripsService.getDriverEarningsByPeriod(
      req.user.sub,
      startDate,
      endDate,
    );
  }
}
