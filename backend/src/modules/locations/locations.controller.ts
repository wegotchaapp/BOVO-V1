import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { LocationsService } from './locations.service';

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('neighborhoods')
  @ApiOperation({ summary: 'Get neighborhoods for a city' })
  @ApiQuery({ name: 'city', required: true, example: 'Austin' })
  @ApiQuery({ name: 'search', required: false, example: 'barton' })
  async getNeighborhoods(
    @Query('city') city: string,
    @Query('search') search?: string,
  ) {
    return this.locationsService.getNeighborhoods(city, search);
  }

  @Get('cities')
  @ApiOperation({ summary: 'Get available cities' })
  async getCities() {
    return this.locationsService.getCities();
  }
}
