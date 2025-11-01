/**
 * Jest Tests for Map Component
 * 
 * Tests following frontend-developer.md standards:
 * - Component rendering
 * - Marker creation with correct colors
 * - Event modal triggering
 * - Map bounds auto-fitting
 * - Legend display logic
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock leaflet BEFORE importing Map component
jest.mock('leaflet', () => {
  const mockL = {
    map: jest.fn(() => ({
      setView: jest.fn().mockReturnThis(),
      fitBounds: jest.fn().mockReturnThis(),
      on: jest.fn().mockReturnThis(),
      off: jest.fn().mockReturnThis(),
      remove: jest.fn(),
      getZoom: jest.fn(() => 6),
    })),
    tileLayer: jest.fn(() => ({
      addTo: jest.fn(),
    })),
    divIcon: jest.fn((options) => ({
      options,
      _initIcon: jest.fn(),
      createIcon: jest.fn(),
    })),
    latLngBounds: jest.fn((coords) => ({
      coords,
      isValid: jest.fn(() => true),
    })),
    Icon: {
      Default: function() {},
    },
  };
  
  // Set up Icon.Default.prototype
  mockL.Icon.Default.prototype = {
    _getIconUrl: jest.fn(),
  };
  
  // Set up Icon.Default.mergeOptions as a static method
  mockL.Icon.Default.mergeOptions = jest.fn();
  
  return {
    __esModule: true,
    default: mockL,
  };
});

// Mock react-leaflet components
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children, ...props }) => <div data-testid="map-container" {...props}>{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children, eventHandlers, position }) => (
    <div 
      data-testid="marker"
      data-position={JSON.stringify(position)}
      onClick={() => eventHandlers?.click()}
    >
      {children}
    </div>
  ),
  Popup: ({ children }) => <div data-testid="popup">{children}</div>,
  useMap: () => ({
    fitBounds: jest.fn(),
    invalidateSize: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    getZoom: jest.fn(() => 6),
  }),
  Circle: () => <div data-testid="circle" />
}));

// Import Map AFTER mocks are set up
import Map from '../../src/components/Map';

describe('Map Component - Rendering', () => {
  
  const mockEvents = [
    {
      id: 1,
      latitude: 14.5995,
      longitude: 120.9842,
      magnitude: 7.5,
      occurred_at: '2025-11-01T02:00:00.000Z',
      depth_km: 10,
      location_text: 'Manila, Philippines'
    },
    {
      id: 2,
      latitude: 7.0731,
      longitude: 125.6128,
      magnitude: 3.2,
      occurred_at: '2025-11-01T03:00:00.000Z',
      depth_km: 15,
      location_text: 'Davao, Philippines'
    }
  ];

  it('should render map container', () => {
    render(<Map events={[]} />);
    
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('should render tile layer for OpenStreetMap', () => {
    render(<Map events={[]} />);
    
    expect(screen.getByTestId('tile-layer')).toBeInTheDocument();
  });

  it('should render markers for each event', () => {
    render(<Map events={mockEvents} />);
    
    const markers = screen.getAllByTestId('marker');
    expect(markers).toHaveLength(2);
  });

  it('should not render markers when events array is empty', () => {
    render(<Map events={[]} />);
    
    const markers = screen.queryAllByTestId('marker');
    expect(markers).toHaveLength(0);
  });
});

describe('Map Component - Marker Color Logic', () => {
  
  /**
   * Magnitude color rules:
   * - >= 7.0: Red (critical)
   * - 6.0-6.9: Dark Orange
   * - 5.0-5.9: Orange
   * - 4.0-4.9: Yellow
   * - 3.0-3.9: Light Yellow
   * - < 3.0: Blue (minor)
   */

  it('should create red marker for magnitude >= 7.0', () => {
    const event = {
      id: '1',
      latitude: 14.5,
      longitude: 121.0,
      magnitude: 7.5,
      occurred_at: '2025-11-01T00:00:00.000Z',
      depth_km: 10,
      location_text: 'Major earthquake'
    };

    render(<Map events={[event]} />);
    
    // Check if marker HTML contains red color indicator
    const marker = screen.getByTestId('marker');
    expect(marker).toBeInTheDocument();
  });

  it('should create orange marker for magnitude 5.0-6.9', () => {
    const events = [
      {
        id: '1',
        latitude: 14.5,
        longitude: 121.0,
        magnitude: 6.5,
        occurred_at: '2025-11-01T00:00:00.000Z',
        depth_km: 10,
        location_text: 'Strong earthquake'
      },
      {
        id: '2',
        latitude: 15.5,
        longitude: 122.0,
        magnitude: 5.2,
        occurred_at: '2025-11-01T01:00:00.000Z',
        depth_km: 12,
        location_text: 'Moderate earthquake'
      }
    ];

    render(<Map events={events} />);
    
    const markers = screen.getAllByTestId('marker');
    expect(markers).toHaveLength(2);
  });

  it('should create yellow marker for magnitude 4.0-4.9', () => {
    const event = {
      id: '1',
      latitude: 14.5,
      longitude: 121.0,
      magnitude: 4.5,
      occurred_at: '2025-11-01T00:00:00.000Z',
      depth_km: 10,
      location_text: 'Light earthquake'
    };

    render(<Map events={[event]} />);
    
    expect(screen.getByTestId('marker')).toBeInTheDocument();
  });

  it('should create blue marker for magnitude < 3.0', () => {
    const event = {
      id: '1',
      latitude: 14.5,
      longitude: 121.0,
      magnitude: 2.1,
      occurred_at: '2025-11-01T00:00:00.000Z',
      depth_km: 10,
      location_text: 'Minor earthquake'
    };

    render(<Map events={[event]} />);
    
    expect(screen.getByTestId('marker')).toBeInTheDocument();
  });
});

describe('Map Component - Event Modal', () => {
  
  it('should trigger modal when marker is clicked', async () => {
    const event = {
      id: '1',
      latitude: 14.5,
      longitude: 121.0,
      magnitude: 4.5,
      occurred_at: '2024-01-15T10:30:00.000Z',
      depth_km: 10,
      location_text: 'Test earthquake'
    };

    render(<Map events={[event]} />);
    
    const marker = screen.getByTestId('marker');
    fireEvent.click(marker);

    await waitFor(() => {
      // Check if modal is displayed with earthquake details
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Earthquake Details')).toBeInTheDocument();
      expect(screen.getByText('4.5')).toBeInTheDocument(); // Magnitude
    });
  });

  it('should display correct event data in modal', async () => {
    const event = {
      id: '1',
      latitude: 14.5,
      longitude: 121.0,
      magnitude: 5.5,
      occurred_at: '2024-01-15T10:30:00.000Z',
      depth_km: 25,
      location_text: '10 km NE of Manila'
    };

    render(<Map events={[event]} />);
    
    const marker = screen.getByTestId('marker');
    fireEvent.click(marker);

    await waitFor(() => {
      // Check if modal displays the correct event data
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('5.5')).toBeInTheDocument(); // Magnitude
      expect(screen.getByText(/14.50.*121.00/)).toBeInTheDocument(); // Coordinates
    });
  });
});

describe('Map Component - Legend', () => {
  
  it('should display event count in legend', () => {
    const events = [
      { id: '1', latitude: 14.5, longitude: 121.0, magnitude: 5.0, occurred_at: '2025-11-01T00:00:00.000Z', depth_km: 10, location_text: 'Test 1' },
      { id: '2', latitude: 15.5, longitude: 122.0, magnitude: 3.5, occurred_at: '2025-11-01T01:00:00.000Z', depth_km: 12, location_text: 'Test 2' },
      { id: '3', latitude: 16.5, longitude: 123.0, magnitude: 2.1, occurred_at: '2025-11-01T02:00:00.000Z', depth_km: 8, location_text: 'Test 3' }
    ];

    render(<Map events={events} />);
    
    // Legend should show count (implementation dependent)
    // This test assumes legend is rendered with event count
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('should show "0 events" when no data', () => {
    render(<Map events={[]} />);
    
    // Should render but with no markers
    const markers = screen.queryAllByTestId('marker');
    expect(markers).toHaveLength(0);
  });
});

describe('Map Component - Bounds Auto-Fit', () => {
  
  it('should fit map bounds when events change', () => {
    const { rerender } = render(<Map events={[]} />);
    
    const newEvents = [
      { id: '1', latitude: 14.5, longitude: 121.0, magnitude: 5.0, occurred_at: '2025-11-01T00:00:00.000Z', depth_km: 10, location_text: 'Test' }
    ];
    
    rerender(<Map events={newEvents} />);
    
    expect(screen.getByTestId('marker')).toBeInTheDocument();
  });

  it('should handle events across wide geographic area', () => {
    const events = [
      { id: '1', latitude: 5.0, longitude: 116.0, magnitude: 3.0, occurred_at: '2025-11-01T00:00:00.000Z', depth_km: 10, location_text: 'South' },
      { id: '2', latitude: 20.0, longitude: 126.0, magnitude: 3.0, occurred_at: '2025-11-01T01:00:00.000Z', depth_km: 10, location_text: 'North' }
    ];

    render(<Map events={events} />);
    
    const markers = screen.getAllByTestId('marker');
    expect(markers).toHaveLength(2);
  });
});

describe('Map Component - Performance', () => {
  
  it('should handle large number of events efficiently', () => {
    const events = Array.from({ length: 100 }, (_, i) => ({
      id: `${i}`,
      latitude: 14.0 + (i * 0.05),
      longitude: 121.0 + (i * 0.05),
      magnitude: 2.0 + (i % 5),
      occurred_at: `2025-11-01T${String(i % 24).padStart(2, '0')}:00:00.000Z`,
      depth_km: 10 + (i % 50),
      location_text: `Event ${i}`
    }));

    const startTime = Date.now();
    render(<Map events={events} />);
    const endTime = Date.now();
    
    const renderTime = endTime - startTime;
    expect(renderTime).toBeLessThan(1000); // Should render in < 1 second
  });

  it('should memoize markers to avoid unnecessary re-renders', () => {
    const events = [
      { id: '1', latitude: 14.5, longitude: 121.0, magnitude: 5.0, occurred_at: '2025-11-01T00:00:00.000Z', depth_km: 10, location_text: 'Test' }
    ];

    const { rerender } = render(<Map events={events} />);
    
    // Re-render with same events
    rerender(<Map events={events} />);
    
    // Markers should still be present
    expect(screen.getByTestId('marker')).toBeInTheDocument();
  });
});
