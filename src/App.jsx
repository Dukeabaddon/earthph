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
import Map from './components/Map';
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
              alt="EarthPH Globe Logo" 
              className="h-12 w-12 object-contain"
            />
            <div>
              <h1 className="text-xl font-bold text-gray-900">EarthPH</h1>
              <p className="text-xs text-gray-500">Real-time Earthquake Monitoring</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative">
        <Map events={events} loading={loading} />
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-3 px-4 text-center text-sm">
        <p>
          Data provided by{' '}
          <a 
            href="https://earthquake.phivolcs.dost.gov.ph/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary-400 hover:text-primary-300 underline"
          >
            PHIVOLCS
          </a>
          {' '}· Philippine Earthquake Monitoring
        </p>
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
