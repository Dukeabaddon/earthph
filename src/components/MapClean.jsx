import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import PropTypes from 'prop-types';
import 'leaflet/dist/leaflet.css';
import EventModal from './EventModalClean';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function calculateShakingRadius(magnitude, depth, type = 'light') {
  const mag = parseFloat(magnitude) || 0;
  const depthKm = parseFloat(depth) || 10;
  let depthFactor = depthKm > 100 ? 0.7 : (depthKm > 50 ? 0.85 : 1.0);
  const offset = type === 'strong' ? 1.0 : (type === 'moderate' ? 0.3 : 0.0);
  const radiusKm = Math.pow(10, 0.5 * mag - offset) * depthFactor;
  return radiusKm * 1000;
}

function createMagnitudeIcon(magnitude, isRecent = false, recentAge = 0, zoom = 6, isLatest = false) {
  const mag = parseFloat(magnitude) || 0;
  let color = '#3b82f6';
  let size = 24;
  if (mag >= 7) { color = '#b91c1c'; size = 40; }
  else if (mag >= 6) { color = '#dc2626'; size = 36; }
  else if (mag >= 5) { color = '#f59e0b'; size = 32; }
  else if (mag >= 4) { color = '#fbbf24'; size = 28; }

  if (isLatest) { color = '#22c55e'; size = Math.round(size * 1.25); }
  if (isRecent) { const m = zoom < 7 ? 2.0 : (zoom < 9 ? 1.7 : 1.4); size = Math.round(size * m); }

  const html = `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;border:2px solid #fff">${mag.toFixed(1)}</div>`;
  return L.divIcon({ className: 'custom-marker', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

function MapBoundsController({ events }) {
  const map = useMap();
  useEffect(() => {
    if (events && events.length > 0) {
      const bounds = L.latLngBounds(events.map(e => [e.latitude, e.longitude]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
  }, [events, map]);
  return null;
}

function ZoomTracker({ onZoomChange }) {
  const map = useMap();
  useEffect(() => {
    const handler = () => onZoomChange(map.getZoom());
    onZoomChange(map.getZoom());
    map.on('zoomend', handler);
    return () => map.off('zoomend', handler);
  }, [map, onZoomChange]);
  return null;
}

export default function MapClean({ events = [], loading = false }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clickPosition, setClickPosition] = useState({ x: 0, y: 0 });
  const [selectedEventForRadius, setSelectedEventForRadius] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [mapZoom, setMapZoom] = useState(6);

  useEffect(() => { const i = setInterval(() => setCurrentTime(Date.now()), 5000); return () => clearInterval(i); }, []);

  const recentEventIds = useMemo(() => {
    if (!events || events.length === 0) return new Set();
    const sorted = [...events].sort((a, b) => (new Date(b.created_at || b.occurred_at).getTime() - new Date(a.created_at || a.occurred_at).getTime()));
    return new Set(sorted.slice(0, 3).map(e => e.id));
  }, [events]);

  const getEventAge = useCallback((ts) => Math.floor((currentTime - new Date(ts).getTime()) / 1000), [currentTime]);

  const handleMarkerClick = useCallback((event, mouseEvent) => {
    const x = mouseEvent?.originalEvent?.clientX || window.innerWidth / 2;
    const y = mouseEvent?.originalEvent?.clientY || window.innerHeight / 2;
    setClickPosition({ x, y });
    setSelectedEvent(event);
    setIsModalOpen(true);
    setSelectedEventForRadius(event);
  }, []);

  const markers = useMemo(() => (events || []).map(ev => {
    const isLatest = recentEventIds.has(ev.id);
    const age = isLatest ? getEventAge(ev.created_at || ev.occurred_at) : 0;
    return (<Marker key={ev.id} position={[ev.latitude, ev.longitude]} icon={createMagnitudeIcon(ev.magnitude, isLatest, age, mapZoom, isLatest)} eventHandlers={{ click: (e) => handleMarkerClick(ev, e) }} />);
  }), [events, recentEventIds, getEventAge, handleMarkerClick, mapZoom]);

  const radiusCircles = useMemo(() => {
    if (!selectedEventForRadius) return null;
    const { latitude, longitude, magnitude, depth_km } = selectedEventForRadius;
    const pos = [latitude, longitude];
    return (
      <>
        <Circle center={pos} radius={calculateShakingRadius(magnitude, depth_km, 'light')} pathOptions={{ color: 'rgba(250,204,21,0.25)', fillColor: 'rgba(250,204,21,0.08)', fillOpacity: 1 }} />
        <Circle center={pos} radius={calculateShakingRadius(magnitude, depth_km, 'moderate')} pathOptions={{ color: 'rgba(251,146,60,0.3)', fillColor: 'rgba(251,146,60,0.1)', fillOpacity: 1 }} />
        <Circle center={pos} radius={calculateShakingRadius(magnitude, depth_km, 'strong')} pathOptions={{ color: 'rgba(239,68,68,0.4)', fillColor: 'rgba(239,68,68,0.15)', fillOpacity: 1 }} />
      </>
    );
  }, [selectedEventForRadius]);

  const defaultCenter = [12.8797, 121.774];
  const defaultZoom = 6;

  return (
    <div className="relative w-full h-full">
      {loading && <div className="absolute inset-0 z-50 flex items-center justify-center">Loading...</div>}
      <MapContainer center={defaultCenter} zoom={defaultZoom} className="w-full h-full">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
        {markers}
        {radiusCircles}
        {(events || []).length > 0 && <MapBoundsController events={events} />}
        <ZoomTracker onZoomChange={setMapZoom} />
      </MapContainer>

      <EventModal event={selectedEvent} isOpen={isModalOpen} position={clickPosition} onClose={() => { setIsModalOpen(false); setSelectedEvent(null); setSelectedEventForRadius(null); }} />
    </div>
  );
}

MapClean.propTypes = {
  events: PropTypes.array,
  loading: PropTypes.bool,
};
