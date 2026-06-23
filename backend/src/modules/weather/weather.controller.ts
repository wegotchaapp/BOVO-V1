import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WeatherService } from './weather.service';

@ApiTags('weather')
@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current weather for Austin, TX' })
  getCurrent(@Query('lat') lat?: string, @Query('lon') lon?: string) {
    return this.weatherService.getCurrentWeather(
      lat ? parseFloat(lat) : undefined,
      lon ? parseFloat(lon) : undefined,
    );
  }
}
