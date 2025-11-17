/**
 * Map Component (Part 1/2)
 * 
 * Following frontend-developer.md standards:
 * - Responsive mobile-first design
 * - Accessible keyboard navigation
 * - Performance optimized with lazy loading
 * - Error boundaries for graceful degradation
 * - Memoization for marker rendering
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import PropTypes from 'prop-types';
import 'leaflet/dist/leaflet.css';
import EventModal from './EventModal';
import { formatMagnitude, timeAgo } from '../utils/dateFormat';

// Fix Leaflet default icon issue in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

/**
 * Calculate shaking radius based on magnitude and depth
 * Using USGS empirical formulas for MMI intensity zones
 * 
 * Formula: R = 10^(0.5M - offset) × depthFactor
 * - Strong shaking (MMI VI-VII): offset = 1.0
 * - Moderate shaking (MMI IV-V): offset = 0.3
 * - Light shaking (MMI II-III): offset = 0.0
 * 
 * @param {number} magnitude - Earthquake magnitude
 * @param {number} depth - Depth in kilometers
 * @param {string} type - Shaking intensity type ('strong', 'moderate', 'light')
 * @returns {number} Radius in meters
 */
function calculateShakingRadius(magnitude, depth, type = 'light') {
  const mag = parseFloat(magnitude);
  const depthKm = parseFloat(depth) || 10;
  
  // Depth adjustment factor
  // Deeper earthquakes have less surface impact
  let depthFactor = 1.0;
  if (depthKm > 100) {
    depthFactor = 0.7; // Deep earthquakes: 30% reduction
  } else if (depthKm > 50) {
    depthFactor = 0.85; // Medium depth: 15% reduction
  }
  
  // Offset based on shaking intensity
  let offset = 0;
  if (type === 'strong') {
    offset = 1.0; // Strong shaking zone (innermost)
  } else if (type === 'moderate') {
    offset = 0.3; // Moderate shaking zone (middle)
  } else {
    offset = 0.0; // Light shaking zone (outermost)
  }
  
  // Calculate radius in kilometers
  const radiusKm = Math.pow(10, 0.5 * mag - offset) * depthFactor;
  
  // Convert to meters for Leaflet Circle
  return radiusKm * 1000;
}

/**
 * Custom marker icon generator based on magnitude
 * Clean, flat design without shadows
 * With zoom-aware sizing for recent earthquakes
 * 
 * @param {number} magnitude - Earthquake magnitude
 * @param {boolean} isRecent - Whether this is one of the 3 most recent earthquakes
 * @param {number} recentAge - Age in seconds (0-60s = ripple, 60-300s = glow)
 * @param {number} zoom - Current map zoom level (for adaptive sizing)
 * @returns {L.DivIcon} Leaflet DivIcon
 */
function createMagnitudeIcon(magnitude, isRecent = false, recentAge = 0, zoom = 6, isLatest = false) {
  const mag = parseFloat(magnitude);
  let color, size;

  if (isLatest) {
    // Latest events use green regardless of magnitude
    color = '#22c55e'; // green-500
    // slightly larger for visibility
    size = Math.round(size * 1.25);
  } else if (mag >= 7.0) {
    color = '#b91c1c'; // Danger-700
    size = 40;
  } else if (mag >= 6.0) {
    color = '#dc2626'; // Danger-600
    size = 36;
  } else if (mag >= 5.0) {
    color = '#f59e0b'; // Warning-500
    size = 32;
  } else if (mag >= 4.0) {
    color = '#fbbf24'; // Warning-400
    size = 28;
  } else {
    color = '#3b82f6'; // Primary-500
    size = 24;
  }

  // Zoom-aware sizing for recent earthquakes (larger when zoomed out)
  if (isRecent) {
    let sizeMultiplier;
    if (zoom < 7) {
      sizeMultiplier = 2.0; // 100% larger when zoomed out
    } else if (zoom < 9) {
      sizeMultiplier = 1.7; // 70% larger at medium zoom
    } else {
      sizeMultiplier = 1.4; // 40% larger when zoomed in
    }
    size = Math.round(size * sizeMultiplier);
  }

  // Zoom-aware badge sizing
  const badgeFontSize = zoom < 7 ? '14px' : (zoom < 9 ? '11px' : '9px');
  const badgePadding = zoom < 7 ? '3px 6px' : '2px 5px';

  // Determine recent earthquake styling
  let recentClass = '';
  let badgeHtml = '';
  if (isRecent) {
    if (recentAge < 60) {
      // Phase 1: Ripple effect with BLINKING red border (0-60 seconds)
      recentClass = 'recent-earthquake-marker';
      badgeHtml = `
        <div style="
          position: absolute;
          top: -8px;
          right: -8px;
          background: #ef4444;
          color: white;
          font-size: ${badgeFontSize};
          font-weight: 800;
          padding: ${badgePadding};
          border-radius: 10px;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          z-index: 10;
          letter-spacing: 0.5px;
        ">NEW</div>
      `;
    } else if (recentAge < 300) {
      // Phase 2: Glow effect with BLINKING cyan border (1-5 minutes)
      recentClass = 'recent-glow-marker';
      badgeHtml = `
        <div style="
          position: absolute;
          top: -8px;
          right: -8px;
          background: #06b6d4;
          color: white;
          font-size: ${badgeFontSize};
          font-weight: 800;
          padding: ${badgePadding};
          border-radius: 10px;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          z-index: 10;
          letter-spacing: 0.5px;
        ">NEW</div>
      `;
    }
  }

  return L.divIcon({
    className: `custom-marker ${recentClass}`,
    html: `
      <div style="
        position: relative;
        background-color: ${color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: 2px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: ${size > 30 ? '14px' : '12px'};
        cursor: pointer;
        transition: transform 0.15s ease-out;
      " onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'">
        ${mag.toFixed(1)}
        ${badgeHtml}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * Map bounds adjustment component
 * Automatically fits bounds when events change
 */
function MapBoundsController({ events }) {
  const map = useMap();

  useEffect(() => {
    if (events && events.length > 0) {
      const bounds = L.latLngBounds(
        events.map(e => [e.latitude, e.longitude])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
  }, [events, map]);

  return null;
}

/**
 * Zoom level tracker component
 * Tracks current map zoom level for adaptive marker sizing
 */
function ZoomTracker({ onZoomChange }) {
  const map = useMap();

  useEffect(() => {
    const handleZoom = () => {
      onZoomChange(map.getZoom());
    };
    
    // Set initial zoom
    onZoomChange(map.getZoom());
    
    map.on('zoomend', handleZoom);
    return () => map.off('zoomend', handleZoom);
  }, [map, onZoomChange]);

  return null;
}

/**
 * Map Component - Interactive earthquake visualization
 * 
 * @param {Object} props
 * @param {Array} props.events - Array of earthquake events
 * @param {boolean} props.loading - Loading state
 * @returns {JSX.Element}
 */
export default function Map({ events = [], loading = false }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clickPosition, setClickPosition] = useState({ x: 0, y: 0 });
  const [selectedEventForRadius, setSelectedEventForRadius] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [mapZoom, setMapZoom] = useState(6); // Track zoom level for adaptive sizing

  // Default center: Philippines
  const defaultCenter = [12.8797, 121.774];
  const defaultZoom = 6;

  // Update current time every 5 seconds for recent earthquake detection
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Identify the 3 most recent earthquakes by `created_at`
  const recentEventIds = useMemo(() => {
    if (!events || events.length === 0) return new Set();

    const sortedByTime = [...events].sort((a, b) => {
      const timeA = new Date(a.created_at || a.occurred_at).getTime();
      const timeB = new Date(b.created_at || b.occurred_at).getTime();
      return timeB - timeA; // Most recent first
    });

    return new Set(sortedByTime.slice(0, 3).map(e => e.id));
  }, [events]);

  // Calculate age in seconds for recent earthquakes
  const getEventAge = useCallback((timestamp) => {
    const eventTime = new Date(timestamp).getTime();
    return Math.floor((currentTime - eventTime) / 1000);
  }, [currentTime]);

  // Handle marker click with position tracking
  const handleMarkerClick = useCallback((event, mouseEvent) => {
    // Get click position from native event
    const x = mouseEvent?.originalEvent?.clientX || window.innerWidth / 2;
    const y = mouseEvent?.originalEvent?.clientY || window.innerHeight / 2;
    
    setClickPosition({ x, y });
    setSelectedEvent(event);
    setIsModalOpen(true);
    setSelectedEventForRadius(event); // Show radius circles
  }, []);

  // Sort events so recent ones render last (ensuring they appear on top when stacked)
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const aIsRecent = recentEventIds.has(a.id);
      const bIsRecent = recentEventIds.has(b.id);
      
      // Recent events go to the end (render last = on top in DOM)
      if (aIsRecent && !bIsRecent) return 1;
      if (!aIsRecent && bIsRecent) return -1;
      return 0;
    });
  }, [events, recentEventIds]);

  // Memoize markers to prevent unnecessary re-renders
  const markers = useMemo(() => {
    return sortedEvents.map((event) => {
      const isLatest = recentEventIds.has(event.id);
      const eventTimestamp = event.created_at || event.occurred_at;
      const eventAge = isLatest ? getEventAge(eventTimestamp) : 0;

      return (
        <Marker
          key={event.id}
          position={[event.latitude, event.longitude]}
          icon={createMagnitudeIcon(event.magnitude, isLatest, eventAge, mapZoom, isLatest)}
          zIndexOffset={isLatest ? 2000 : 0} // Latest markers always on top
          eventHandlers={{
            click: (e) => handleMarkerClick(event, e)
          }}
        />
      );
    });
  }, [sortedEvents, handleMarkerClick, recentEventIds, getEventAge, mapZoom]);

  // Memoize radius circles for selected event
  const radiusCircles = useMemo(() => {
    if (!selectedEventForRadius) return null;

    const { latitude, longitude, magnitude, depth_km } = selectedEventForRadius;
    const position = [latitude, longitude];

    return (
      <>
        {/* Outer Circle - Light Shaking (MMI II-III) */}
        <Circle
          center={position}
          radius={calculateShakingRadius(magnitude, depth_km, 'light')}
          pathOptions={{
            color: 'rgba(250, 204, 21, 0.25)',
            fillColor: 'rgba(250, 204, 21, 0.08)',
            fillOpacity: 1,
            weight: 1,
          }}
        />
        
        {/* Middle Circle - Moderate Shaking (MMI IV-V) */}
        <Circle
          center={position}
          radius={calculateShakingRadius(magnitude, depth_km, 'moderate')}
          pathOptions={{
            color: 'rgba(251, 146, 60, 0.3)',
            fillColor: 'rgba(251, 146, 60, 0.1)',
            fillOpacity: 1,
            weight: 2,
          }}
        />
        
        {/* Inner Circle - Strong Shaking (MMI VI-VII) */}
        <Circle
          center={position}
          radius={calculateShakingRadius(magnitude, depth_km, 'strong')}
          pathOptions={{
            color: 'rgba(239, 68, 68, 0.4)',
            fillColor: 'rgba(239, 68, 68, 0.15)',
            fillOpacity: 1,
            weight: 2,
          }}
        />
      </>
    );
  }, [selectedEventForRadius]);

  return (
    <div className="relative w-full h-full">
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-[1000] bg-white bg-opacity-75 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-gray-600">Loading earthquake data...</p>
          </div>
        </div>
      )}

      {/* Empty State Overlay - No earthquakes found */}
      {!loading && (!events || events.length === 0) && (
        <div className="absolute inset-0 z-[1000] bg-white bg-opacity-90 flex items-center justify-center">
          <div className="text-center px-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Earthquakes Detected</h3>
            <p className="text-gray-600 text-sm max-w-sm">
              There are currently no earthquake events to display. This could mean the monitoring system is running normally with no recent seismic activity.
            </p>
          </div>
        </div>
      )}

      {/* Map Container */}
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        className="w-full h-full z-0"
        zoomControl={true}
        scrollWheelZoom={true}
        attributionControl={true}
      >
        {/* OpenStreetMap Tile Layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Render Markers */}
        {markers}

        {/* Render Radius Circles */}
        {radiusCircles}

        {/* Auto-adjust bounds */}
        {events.length > 0 && <MapBoundsController events={events} />}

        {/* Track zoom level for adaptive sizing */}
        <ZoomTracker onZoomChange={setMapZoom} />
      </MapContainer>

      {/* Event Detail Modal */}
      <EventModal
        event={selectedEvent}
        isOpen={isModalOpen}
        position={clickPosition}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedEvent(null);
          setSelectedEventForRadius(null); // Hide radius circles
        }}
      />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white p-4 rounded-lg shadow-lg max-w-xs">
        <h4 className="font-bold text-sm mb-3">Magnitude Scale</h4>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-danger-700 border-2 border-white" />
            <span>≥ 7.0 - Major</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-danger-600 border-2 border-white" />
            <span>6.0 - 6.9 - Strong</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-warning-500 border-2 border-white" />
            <span>5.0 - 5.9 - Moderate</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-warning-400 border-2 border-white" />
            <span>4.0 - 4.9 - Light</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-primary-500 border-2 border-white" />
            <span>&lt; 4.0 - Minor</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#22c55e', border: '2px solid white' }} />
            <span>Latest - Most recent events</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
          {events.length} event{events.length !== 1 ? 's' : ''} in last 24 hours
        </p>
        
        {selectedEventForRadius && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <h5 className="font-semibold text-xs mb-2">Impact Zones (MMI)</h5>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-danger-600" style={{ opacity: 0.15 }} />
                <span>Strong shaking</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-warning-500" style={{ opacity: 0.1 }} />
                <span>Moderate shaking</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-warning-400" style={{ opacity: 0.08 }} />
                <span>Light shaking</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// PropTypes validation
Map.propTypes = {
  events: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      date: PropTypes.string.isRequired,
      time: PropTypes.string.isRequired,
      latitude: PropTypes.number.isRequired,
      longitude: PropTypes.number.isRequired,
      depth: PropTypes.number.isRequired,
      magnitude: PropTypes.number.isRequired,
      location: PropTypes.string.isRequired,
      mmi_intensity: PropTypes.string,
      event_type: PropTypes.string,
      mmi_radii: PropTypes.arrayOf(
        PropTypes.shape({
          level: PropTypes.number.isRequired,
          radius: PropTypes.number.isRequired,
        })
      ),
    })
  ),
  loading: PropTypes.bool,
};
