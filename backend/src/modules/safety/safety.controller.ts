import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SafetyService } from './safety.service';
import { SosTriggerType } from '../../common/enums';
import { Response } from 'express';

const TRACKING_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <title>Bovogo Adventure Tracker</title>
  <link href="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css" rel="stylesheet">
  <script src="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0d0f;color:#e8edf2;overflow:hidden}
    #map{position:absolute;top:0;left:0;right:0;bottom:0}
    .header{position:absolute;top:0;left:0;right:0;background:linear-gradient(180deg,rgba(10,13,15,0.95) 0%,rgba(10,13,15,0.7) 80%,transparent 100%);padding:48px 16px 20px;z-index:1}
    .route{display:flex;align-items:center;gap:8px;margin-bottom:12px}
    .route-from,.route-to{font-size:18px;font-weight:700;color:#e8edf2}
    .route-arrow{color:#00e5a0}
    .eta{font-size:14px;color:#6b7d8f;margin-bottom:12px}
    .eta strong{color:#00e5a0}
    .vehicle-info{display:flex;align-items:center;gap:12px}
    .vehicle-avatar{width:40px;height:40px;border-radius:20px;background:rgba(0,229,160,0.1);display:flex;align-items:center;justify-content:center;font-size:18px}
    .vehicle-detail{flex:1}
    .driver-name{font-size:14px;font-weight:600;color:#e8edf2}
    .vehicle-desc{font-size:12px;color:#6b7d8f}
    .safety-badge{position:absolute;bottom:32px;left:16px;right:16px;background:rgba(17,21,24,0.9);backdrop-filter:blur(10px);border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:10px;z-index:1;border:1px solid rgba(0,229,160,0.2)}
    .shield{color:#00e5a0;font-size:18px}
    .safety-text{font-size:12px;color:#6b7d8f;flex:1;line-height:16px}
    .status-dot{width:8px;height:8px;border-radius:50%;background:#00e5a0;animation:pulse 2s infinite}
    .status-dot.offline{background:#ff5050;animation:none}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
    .loading{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2;display:flex;flex-direction:column;align-items:center;gap:12px}
    .loading-text{color:#6b7d8f;font-size:14px}
    .spinner{width:32px;height:32px;border:3px solid #1f262d;border-top-color:#00e5a0;border-radius:50%;animation:spin 1s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    .error{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;z-index:2;padding:20px}
    .error-icon{font-size:48px;margin-bottom:12px}
    .error-title{font-size:18px;font-weight:600;margin-bottom:8px}
    .error-sub{color:#6b7d8f;font-size:14px}
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="loading" class="loading">
    <div class="spinner"></div>
    <div class="loading-text">Loading trip...</div>
  </div>
  <div id="error" class="error" style="display:none">
    <div class="error-icon">&#9888;</div>
    <div class="error-title" id="errorTitle">Trip Not Found</div>
    <div class="error-sub" id="errorSub">This tracking link may have expired.</div>
  </div>
  <div class="header" id="header" style="display:none">
    <div class="route">
      <span class="route-from" id="origin"></span>
      <span class="route-arrow">&#10140;</span>
      <span class="route-to" id="dest"></span>
    </div>
    <div class="eta" id="eta"></div>
    <div class="vehicle-info">
      <div class="vehicle-avatar">&#128663;</div>
      <div class="vehicle-detail">
        <div class="driver-name" id="driverName"></div>
        <div class="vehicle-desc" id="vehicleDesc"></div>
      </div>
    </div>
  </div>
  <div class="safety-badge" id="badge" style="display:none">
    <span class="status-dot" id="statusDot"></span>
    <span class="shield">&#128737;</span>
    <span class="safety-text">This trip is being tracked by Bovogo for safety</span>
  </div>

  <script>
    const TOKEN = '{{TOKEN}}';
    const API_URL = '{{API_URL}}';
    const MAPBOX_TOKEN = '{{MAPBOX_TOKEN}}';
    let map, marker, routeLayer;

    async function load() {
      try {
        const res = await fetch(API_URL + '/safety/track/' + TOKEN);
        if (!res.ok) {
          showLoading(false);
          showError();
          return;
        }
        const data = await res.json();

        if (!mapboxgl.supported()) {
          showError();
          return;
        }

        mapboxgl.accessToken = MAPBOX_TOKEN;
        const centerLat = data.current_lat || data.origin_lat || 0;
        const centerLng = data.current_lng || data.origin_lng || 0;

        map = new mapboxgl.Map({
          container: 'map',
          style: 'mapbox://styles/mapbox/dark-v11',
          center: [centerLng, centerLat],
          zoom: 12,
          attributionControl: false,
        });

        map.addControl(new mapboxgl.AttributionControl({ compact: true }));

        if (data.route_polyline) {
          map.on('load', () => {
            try {
              const decoded = decodePolyline(data.route_polyline);
              map.addSource('route', {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  geometry: { type: 'LineString', coordinates: decoded },
                },
              });
              map.addLayer({
                id: 'route-line',
                type: 'line',
                source: 'route',
                paint: {
                  'line-color': '#00e5a0',
                  'line-width': 4,
                  'line-opacity': 0.8,
                },
              });
            } catch(e) { console.log('Route decode failed', e); }
          });
        }

        if (data.current_lat && data.current_lng) {
          const el = document.createElement('div');
          el.style.cssText = 'width:20px;height:20px;background:#00e5a0;border-radius:50%;border:3px solid #0a0d0f;box-shadow:0 0 12px rgba(0,229,160,0.5)';
          marker = new mapboxgl.Marker(el)
            .setLngLat([data.current_lng, data.current_lat])
            .addTo(map);
        }

        document.getElementById('origin').textContent = data.origin_metro;
        document.getElementById('dest').textContent = data.dest_metro;

        if (data.eta_minutes) {
          document.getElementById('eta').innerHTML = 'ETA: <strong>' + data.eta_minutes + ' min</strong>';
        } else {
          document.getElementById('eta').textContent = 'ETA: unavailable';
        }

        document.getElementById('driverName').textContent = data.driver_name;
        const parts = [data.vehicle_year, data.vehicle_make, data.vehicle_model].filter(Boolean).join(' ');
        document.getElementById('vehicleDesc').textContent = [parts, data.vehicle_color, data.license_plate].filter(Boolean).join(' \\u00b7 ');

        document.getElementById('header').style.display = 'block';
        document.getElementById('badge').style.display = 'flex';
        showLoading(false);
      } catch(e) {
        showLoading(false);
        showError();
      }
    }

    async function refresh() {
      try {
        const res = await fetch(API_URL + '/safety/track/' + TOKEN);
        if (!res.ok) return;
        const data = await res.json();

        if (data.current_lat && data.current_lng && marker) {
          marker.setLngLat([data.current_lng, data.current_lat]);
          map.easeTo({ center: [data.current_lng, data.current_lat], duration: 1000 });
        }

        if (data.eta_minutes) {
          document.getElementById('eta').innerHTML = 'ETA: <strong>' + data.eta_minutes + ' min</strong>';
        }

        const dot = document.getElementById('statusDot');
        if (data.last_updated) {
          const mins = (Date.now() - new Date(data.last_updated).getTime()) / 60000;
          dot.className = mins > 5 ? 'status-dot offline' : 'status-dot';
        }
      } catch(e) {}
    }

    function showLoading(show) {
      document.getElementById('loading').style.display = show ? 'flex' : 'none';
    }

    function showError() {
      document.getElementById('error').style.display = 'block';
    }

    function decodePolyline(encoded) {
      const coords = [];
      let index = 0, lat = 0, lng = 0;
      while (index < encoded.length) {
        let b, shift = 0, result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
        lat += dlat;
        shift = 0; result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
        lng += dlng;
        coords.push([lng / 1e5, lat / 1e5]);
      }
      return coords;
    }

    load();
    setInterval(refresh, 30000);
  </script>
</body>
</html>`;

@ApiTags('safety')
@Controller('safety')
export class SafetyController {
  constructor(private readonly safetyService: SafetyService) {}

  @Post('ping')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @Throttle({ default: { limit: 4, ttl: 60000 } })
  @ApiOperation({ summary: 'Receive GPS location ping during trip' })
  async receivePing(
    @Request() req: any,
    @Body()
    body: {
      booking_id: string;
      latitude: number;
      longitude: number;
      accuracy?: number;
      speed?: number;
      battery_level?: number;
    },
  ) {
    const result = await this.safetyService.receivePing(
      req.user.id,
      body.booking_id,
      body.latitude,
      body.longitude,
      body.accuracy,
      body.speed,
      body.battery_level,
    );
    return { received: true, deviation_triggered: result.deviation_triggered };
  }

  @Post('sos')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Activate SOS emergency alert' })
  async activateSOS(
    @Request() req: any,
    @Body()
    body: {
      trigger_type: SosTriggerType;
      booking_id?: string;
      latitude: number;
      longitude: number;
      /** GPS uncertainty in metres, passed straight to Noonlight when present. */
      accuracy?: number;
    },
  ) {
    return this.safetyService.activateSOS(
      req.user.id,
      body.trigger_type,
      body.booking_id,
      body.latitude,
      body.longitude,
      body.accuracy,
    );
  }

  @Post('sos/cancel')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Cancel SOS with safe word confirmation' })
  async cancelSOS(
    @Request() req: any,
    @Body() body: { sos_id: string; safe_word: string },
  ) {
    return this.safetyService.cancelSOS(
      req.user.id,
      body.sos_id,
      body.safe_word,
    );
  }

  @Post('sos/unsafe-feeling')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Report feeling unsafe (no 911, T&S only)' })
  async submitUnsafeFeeling(
    @Request() req: any,
    @Body()
    body: {
      booking_id: string;
      latitude: number;
      longitude: number;
      description?: string;
    },
  ) {
    return this.safetyService.submitUnsafeFeeling(
      req.user.id,
      body.booking_id,
      body.latitude,
      body.longitude,
      body.description,
    );
  }

  @Post('deviation/:id/respond')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Respond to a route deviation alert' })
  async respondToDeviation(
    @Param('id') id: string,
    @Body('response') response: string,
  ) {
    await this.safetyService.respondToDeviation(id, response);
    return { message: 'Response recorded' };
  }

  @Post('track/:bookingId/share')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Generate shareable trip tracking link' })
  async generateShareToken(@Param('bookingId') bookingId: string) {
    return this.safetyService.getTrackToken(bookingId);
  }

  @Get('track/:token')
  @ApiOperation({ summary: 'Public trip tracking endpoint (no auth)' })
  async getPublicTrack(@Param('token') token: string) {
    return this.safetyService.getPublicTrack(token);
  }

  @Get('track/:token/page')
  @ApiOperation({ summary: 'Public tracking HTML page' })
  async getTrackingPage(@Param('token') token: string, @Res() res: Response) {
    const apiUrl = process.env.APP_URL || 'https://bovogo.com';
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN || '';

    const html = TRACKING_PAGE_HTML.replace('{{TOKEN}}', token)
      .replace('{{API_URL}}', apiUrl)
      .replace('{{MAPBOX_TOKEN}}', mapboxToken);

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'no-cache');
    res.send(html);
  }

  @Get('trip/:bookingId/history')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get location ping history for a booking' })
  async getTrackingHistory(@Param('bookingId') bookingId: string) {
    return this.safetyService.getTrackingHistory(bookingId);
  }

  @Get('trip/:bookingId/deviations')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get deviation events for a booking' })
  async getDeviationHistory(@Param('bookingId') bookingId: string) {
    return this.safetyService.getDeviationHistory(bookingId);
  }

  @Get('my/sos-history')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get my SOS event history' })
  async getMySOSHistory(@Request() req: any) {
    return this.safetyService.getMySOSHistory(req.user.id);
  }
}
