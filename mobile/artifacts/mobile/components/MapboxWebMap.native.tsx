import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import WebView from "react-native-webview";

interface Coord {
  latitude: number;
  longitude: number;
}

interface RouteInfo {
  durationSeconds: number;
  distanceMeters: number;
}

interface MapboxWebMapProps {
  fromCoord: Coord;
  toCoord: Coord;
  driverCoord: Coord;
  riderCoord: Coord | null;
  fromLabel: string;
  toLabel: string;
  progress: number;
  primaryColor?: string;
  accentColor?: string;
  onRouteInfo?: (info: RouteInfo) => void;
  style?: object;
}

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";

function buildMapHTML(
  token: string,
  from: Coord,
  to: Coord,
  fromLabel: string,
  toLabel: string,
  primary: string,
  accent: string,
): string {
  const fromLng = from.longitude;
  const fromLat = from.latitude;
  const toLng = to.longitude;
  const toLat = to.latitude;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css" rel="stylesheet"/>
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    html,body{width:100%;height:100%;overflow:hidden;background:#f0ebe3;}
    #map{position:absolute;top:0;bottom:0;width:100%;height:100%;}

    .callout{
      background:#fff;border-radius:8px;padding:7px 12px 7px 10px;
      display:flex;align-items:center;gap:8px;
      box-shadow:0 2px 10px rgba(0,0,0,0.22);cursor:pointer;
      min-width:160px;max-width:220px;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    }
    .callout-dot{width:14px;height:14px;border-radius:50%;flex-shrink:0;}
    .callout-text{font-size:13px;font-weight:600;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;}
    .callout-arrow{font-size:11px;color:#666;flex-shrink:0;}

    .driver-wrap{display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.3));}
    .driver-car{
      width:40px;height:40px;border-radius:50%;
      background:${primary};border:3px solid #fff;
      display:flex;align-items:center;justify-content:center;font-size:20px;
      animation:carPulse 2s ease-in-out infinite;
    }
    @keyframes carPulse{
      0%,100%{box-shadow:0 0 0 0 rgba(27,61,47,0.35);}
      50%{box-shadow:0 0 0 10px rgba(27,61,47,0);}
    }

    .rider-dot{
      width:16px;height:16px;border-radius:50%;
      background:#4285F4;border:3px solid #fff;
      box-shadow:0 0 0 4px rgba(66,133,244,0.25);
      animation:riderPulse 2s ease-in-out infinite;
    }
    @keyframes riderPulse{
      0%,100%{box-shadow:0 0 0 4px rgba(66,133,244,0.25);}
      50%{box-shadow:0 0 0 10px rgba(66,133,244,0);}
    }

    .mapboxgl-ctrl-bottom-right{bottom:16px;right:16px;}
    .mapboxgl-ctrl-group{border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.2);}
    .mapboxgl-ctrl-group button{width:36px;height:36px;font-size:18px;}
  </style>
</head>
<body>
<div id="map"></div>
<script>
mapboxgl.accessToken = '${token}';

const FROM_LNG = ${fromLng};
const FROM_LAT = ${fromLat};
const TO_LNG   = ${toLng};
const TO_LAT   = ${toLat};
const FROM_LABEL = ${JSON.stringify(fromLabel)};
const TO_LABEL   = ${JSON.stringify(toLabel)};

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [(FROM_LNG + TO_LNG) / 2, (FROM_LAT + TO_LAT) / 2],
  zoom: 7,
  attributionControl: false,
});

map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

let driverMarker = null;
let riderMarker  = null;
let routeCoords  = null;
let mapReady     = false;

function makeCallout(label, dotColor) {
  const el = document.createElement('div');
  el.className = 'callout';
  el.innerHTML =
    '<div class="callout-dot" style="background:' + dotColor + '"></div>' +
    '<span class="callout-text">' + label + '</span>' +
    '<span class="callout-arrow">›</span>';
  return el;
}

function coordAtProgress(coords, t) {
  if (!coords || coords.length < 2) return coords[0];
  const total = coords.length - 1;
  const idx = Math.min(Math.floor(t * total), total - 1);
  const frac = t * total - idx;
  const a = coords[idx];
  const b = coords[idx + 1];
  return [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac];
}

// Fetches real driving route from Mapbox Directions API.
// Returns { coords, duration (seconds), distance (meters) }.
async function fetchRoute() {
  try {
    const url =
      'https://api.mapbox.com/directions/v5/mapbox/driving/' +
      FROM_LNG + ',' + FROM_LAT + ';' +
      TO_LNG   + ',' + TO_LAT +
      '?access_token=' + mapboxgl.accessToken +
      '&geometries=geojson&overview=full&steps=false';
    const res = await fetch(url);
    const json = await res.json();
    if (json.routes && json.routes.length > 0) {
      const route = json.routes[0];
      return {
        coords:   route.geometry.coordinates,
        duration: route.duration,   // seconds — real drive time from Mapbox
        distance: route.distance,   // meters — real road distance
      };
    }
  } catch(e) {}
  // Straight-line fallback when API is unavailable
  return { coords: [[FROM_LNG, FROM_LAT], [TO_LNG, TO_LAT]], duration: null, distance: null };
}

map.on('load', async function() {
  const routeData = await fetchRoute();
  routeCoords = routeData.coords;

  // ── Send real route info back to React Native immediately ─────
  // This replaces the hardcoded 195-minute estimate with Mapbox data.
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'ROUTE_INFO',
      duration: routeData.duration,
      distance: routeData.distance,
    }));
  }

  map.addSource('route-done', {
    type: 'geojson',
    data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [routeCoords[0], routeCoords[0]] }, properties: {} }
  });
  map.addSource('route-rest', {
    type: 'geojson',
    data: { type: 'Feature', geometry: { type: 'LineString', coordinates: routeCoords }, properties: {} }
  });

  map.addLayer({
    id: 'route-rest-casing',
    type: 'line', source: 'route-rest',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#1a1a2e', 'line-width': 10, 'line-opacity': 0.15 }
  });
  map.addLayer({
    id: 'route-rest-line',
    type: 'line', source: 'route-rest',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#1a1a2e', 'line-width': 6, 'line-opacity': 0.85 }
  });
  map.addLayer({
    id: 'route-done-line',
    type: 'line', source: 'route-done',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '${primary}', 'line-width': 6, 'line-opacity': 0.95 }
  });

  new mapboxgl.Marker({ element: makeCallout('From ' + FROM_LABEL, '${primary}'), anchor: 'left' })
    .setLngLat([FROM_LNG, FROM_LAT]).addTo(map);
  new mapboxgl.Marker({ element: makeCallout('To ' + TO_LABEL, '${accent}'), anchor: 'right' })
    .setLngLat([TO_LNG, TO_LAT]).addTo(map);

  const bounds = routeCoords.reduce(
    (b, c) => b.extend(c),
    new mapboxgl.LngLatBounds(routeCoords[0], routeCoords[0])
  );
  map.fitBounds(bounds, { padding: { top: 80, bottom: 80, left: 60, right: 60 }, maxZoom: 13, duration: 1400 });

  mapReady = true;
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
  }
});

document.addEventListener('message', handleUpdate);
window.addEventListener('message', handleUpdate);

function handleUpdate(e) {
  var data;
  try { data = JSON.parse(e.data); } catch(_) { return; }
  if (!mapReady || !routeCoords) return;
  if (data.type !== 'UPDATE') return;

  var progress = data.progress || 0;

  var driverPos = (routeCoords && routeCoords.length > 1)
    ? coordAtProgress(routeCoords, progress)
    : [data.driver.lng, data.driver.lat];

  if (!driverMarker) {
    var carEl = document.createElement('div');
    carEl.className = 'driver-wrap';
    var car = document.createElement('div');
    car.className = 'driver-car';
    car.textContent = '🚗';
    carEl.appendChild(car);
    driverMarker = new mapboxgl.Marker({ element: carEl, anchor: 'center' })
      .setLngLat(driverPos).addTo(map);
  } else {
    driverMarker.setLngLat(driverPos);
  }

  if (data.rider) {
    var riderPos = [data.rider.lng, data.rider.lat];
    if (!riderMarker) {
      var riderEl = document.createElement('div');
      riderEl.className = 'rider-dot';
      riderMarker = new mapboxgl.Marker({ element: riderEl, anchor: 'center' })
        .setLngLat(riderPos).addTo(map);
    } else {
      riderMarker.setLngLat(riderPos);
    }
  }

  var splitIdx = Math.floor(progress * (routeCoords.length - 1));
  splitIdx = Math.max(1, Math.min(splitIdx, routeCoords.length - 1));
  var doneCoords = routeCoords.slice(0, splitIdx + 1);
  doneCoords.push(driverPos);
  var restCoords = [driverPos].concat(routeCoords.slice(splitIdx + 1));

  map.getSource('route-done').setData({
    type: 'Feature', geometry: { type: 'LineString', coordinates: doneCoords }, properties: {}
  });
  map.getSource('route-rest').setData({
    type: 'Feature', geometry: { type: 'LineString', coordinates: restCoords }, properties: {}
  });

  if (progress > 0.05 && progress < 0.95) {
    map.easeTo({ center: driverPos, zoom: 10, duration: 1200 });
  }
}
</script>
</body>
</html>`;
}

export default function MapboxWebMap({
  fromCoord,
  toCoord,
  driverCoord,
  riderCoord,
  fromLabel,
  toLabel,
  progress,
  primaryColor = "#1B3D2F",
  accentColor = "#C4954A",
  onRouteInfo,
  style,
}: MapboxWebMapProps) {
  const webViewRef = useRef<WebView>(null);
  const mapReady = useRef(false);

  const html = buildMapHTML(
    TOKEN,
    fromCoord,
    toCoord,
    fromLabel,
    toLabel,
    primaryColor,
    accentColor,
  );

  useEffect(() => {
    if (!webViewRef.current || !mapReady.current) return;
    const payload = JSON.stringify({
      type: "UPDATE",
      driver: { lat: driverCoord.latitude, lng: driverCoord.longitude },
      rider: riderCoord
        ? { lat: riderCoord.latitude, lng: riderCoord.longitude }
        : null,
      progress,
    });
    webViewRef.current.injectJavaScript(
      `(function(){var e=new MessageEvent('message',{data:${JSON.stringify(payload)}});document.dispatchEvent(e);})();true;`,
    );
  }, [driverCoord, riderCoord, progress]);

  function onMessage(event: any) {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      // Real route duration + distance from Mapbox Directions API
      if (data.type === "ROUTE_INFO") {
        if (data.duration != null && data.distance != null) {
          onRouteInfo?.({
            durationSeconds: Math.round(data.duration),
            distanceMeters: Math.round(data.distance),
          });
        }
        return;
      }

      if (data.type === "MAP_READY") {
        mapReady.current = true;
        if (webViewRef.current) {
          const payload = JSON.stringify({
            type: "UPDATE",
            driver: { lat: driverCoord.latitude, lng: driverCoord.longitude },
            rider: riderCoord
              ? { lat: riderCoord.latitude, lng: riderCoord.longitude }
              : null,
            progress,
          });
          webViewRef.current.injectJavaScript(
            `(function(){var e=new MessageEvent('message',{data:${JSON.stringify(payload)}});document.dispatchEvent(e);})();true;`,
          );
        }
      }
    } catch (_) {}
  }

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={["*"]}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1, backgroundColor: "#f0ebe3" },
});
