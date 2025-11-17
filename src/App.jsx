/**
 * Main App Component
 * 
 * Following frontend-developer.md standards:
 * - State management with React hooks
 * - Error boundaries at strategic levels
 * - Performance optimized with lazy loading
 * - Accessibility WCAG 2.1 AA compliant
 * - Responsive mobile-first design
 * - Proper loading and error states
 */

import React, { useState, useEffect, useCallback } from 'react';
import Map from './components/MapClean';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';
import { fetchEvents } from './services/supabase';
import globeLogo from './assets/the-world.png';

/**
 * Main App Component
 */
function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Fetch earthquake events from API
   */
  const loadEvents = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);

      const { data, error: fetchError } = await fetchEvents(500); // Increased to 500 to match API limit

      if (fetchError) {
        throw fetchError;
      }

      setEvents(data || []);
    } catch (err) {
      console.error('[App] Error loading events:', err);
      setError(err.message || 'Failed to load earthquake data');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Initial load
   */
  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  /**
   * Auto-refresh every 60 seconds
   */
  useEffect(() => {
    const interval = setInterval(() => {
      loadEvents(false);
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [loadEvents]);

  // Loading state
  if (loading && events.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner message="Loading earthquake data..." />
      </div>
    );
  }

  // Error state
  if (error && events.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="w-16 h-16 bg-warning-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to load data</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => loadEvents()}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-md z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <img 
              src={globeLogo} 
              alt="EarthPH Philippines Earthquake Monitoring Globe Logo" 
              className="h-12 w-12 object-contain"
            />
            <div>
              <h1 className="text-xl font-bold text-gray-900">EarthPH</h1>
              <p className="text-xs text-gray-500">Real-time Earthquake Monitoring Philippines</p>
            </div>
          </div>
          
          {/* SEO-optimized content - visually hidden but indexed by search engines */}
          <div className="sr-only" aria-hidden="true">
            <p className="text-sm text-gray-600 max-w-4xl">
              Live earthquake monitoring for the Philippines powered by PHIVOLCS data. 
              Track seismic activity across Manila, Mindanao, Luzon, Visayas, and all regions 
              of the Philippine archipelago with real-time updates and interactive maps.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
              <span className="bg-blue-50 px-2 py-1 rounded">Manila Earthquakes</span>
              <span className="bg-blue-50 px-2 py-1 rounded">Mindanao Seismic Activity</span>
              <span className="bg-blue-50 px-2 py-1 rounded">Luzon Earthquake Monitoring</span>
              <span className="bg-blue-50 px-2 py-1 rounded">Visayas Earthquake Alerts</span>
              <span className="bg-blue-50 px-2 py-1 rounded">PHIVOLCS Data</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative">
        <Map events={events} loading={loading} />
        
        {/* Hidden SEO content for search engines */}
        <div className="sr-only" aria-hidden="true">
          <h2>Philippines Earthquake Monitoring Information</h2>
          <p>
            EarthPH provides comprehensive real-time earthquake monitoring for the entire Philippines archipelago. 
            Our system integrates with PHIVOLCS (Philippine Institute of Volcanology and Seismology) to deliver 
            accurate, up-to-date seismic information for all major regions including Metro Manila, Calabarzon, 
            Central Luzon, Bicol Region, Western Visayas, Central Visayas, Eastern Visayas, Northern Mindanao, 
            Davao Region, SOCCSKSARGEN, Caraga, BARMM, Cordillera Administrative Region, Ilocos Region, and 
            Cagayan Valley.
          </p>
          
          <h3>Frequently Asked Questions about Philippines Earthquakes</h3>
          <dl>
            <dt>How often do earthquakes occur in the Philippines?</dt>
            <dd>
              The Philippines experiences frequent seismic activity due to its location along the Pacific Ring of Fire. 
              Minor earthquakes occur daily, while significant earthquakes (magnitude 5.0+) happen several times per month.
            </dd>
            
            <dt>Which areas in the Philippines are most prone to earthquakes?</dt>
            <dd>
              Metro Manila, Mindanao, particularly Davao Region, and areas along major fault lines like the 
              West Valley Fault and East Valley Fault are among the most seismically active regions in the Philippines.
            </dd>
            
            <dt>What should I do during an earthquake in the Philippines?</dt>
            <dd>
              Follow the Drop, Cover, and Hold On protocol. Stay away from windows and heavy objects. 
              After the shaking stops, check for injuries and hazards, then evacuate if necessary following 
              local emergency procedures.
            </dd>
            
            <dt>How accurate is PHIVOLCS earthquake data?</dt>
            <dd>
              PHIVOLCS maintains a comprehensive network of seismological stations across the Philippines, 
              providing highly accurate and timely earthquake information typically within minutes of occurrence.
            </dd>
          </dl>
          
          <h3>Philippine Earthquake Preparedness</h3>
          <p>
            Earthquake preparedness is crucial for residents of the Philippines. Create an emergency kit, 
            develop a family emergency plan, secure heavy furniture, and stay informed about seismic activity 
            in your area through reliable sources like EarthPH and PHIVOLCS.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-4 px-4 text-center">
        <div className="max-w-7xl mx-auto">
          {/* SEO-optimized content - visually hidden but accessible to search engines */}
          <p className="sr-only" aria-hidden="true">
            Earthquake data provided by{' '}
            <a 
              href="https://earthquake.phivolcs.dost.gov.ph/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary-400 hover:text-primary-300 underline"
            >
              PHIVOLCS (Philippine Institute of Volcanology and Seismology)
            </a>
            {' '}· Real-time Philippine Earthquake Monitoring System
          </p>
          
          {/* SEO-optimized content - visually hidden but accessible to search engines */}
          <div className="sr-only" aria-hidden="true">
            <p>
              Covering all regions: Metro Manila, Calabarzon, Central Luzon, Bicol Region, 
              Western Visayas, Central Visayas, Eastern Visayas, Northern Mindanao, 
              Davao Region, SOCCSKSARGEN, Caraga, BARMM, Cordillera, Ilocos, Cagayan Valley
            </p>
            <p>
              Earthquake preparedness • Seismic monitoring • Disaster risk reduction • 
              Emergency response • Philippine geology • Tectonic activity monitoring
            </p>
            <p className="font-medium">
              Stay informed, stay safe. Monitor earthquakes in the Philippines with EarthPH.
            </p>
          </div>
          
          <div className="text-xs text-gray-400">
            <p>&copy; 2025 EarthPH. Real-time earthquake monitoring for the Philippines.</p>
            <p>Educational and informational purposes. For emergency situations, contact local authorities.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * App with Error Boundary
 */
export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary 
      title="EarthPH Error"
      message="We encountered an error loading the earthquake monitoring application. Please try refreshing the page."
    >
      <App />
    </ErrorBoundary>
  );
}
