import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Register service worker for performance optimization
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('[SW] Service Worker registered successfully:', registration.scope);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[SW] New service worker available, page will refresh');
              window.location.reload();
            }
          });
        });
      })
      .catch(error => {
        console.error('[SW] Service Worker registration failed:', error);
      });
  });
}

// Performance monitoring for Core Web Vitals
if (import.meta.env.PROD) {
  // Largest Contentful Paint (LCP)
  new PerformanceObserver((entryList) => {
    for (const entry of entryList.getEntries()) {
      if (entry.entryType === 'largest-contentful-paint') {
        console.log('[Perf] LCP:', entry.startTime);
        if (window.gtag) {
          gtag('event', 'LCP', {
            event_category: 'Web Vitals',
            value: Math.round(entry.startTime),
            non_interaction: true
          });
        }
      }
    }
  }).observe({ entryTypes: ['largest-contentful-paint'] });

  // First Input Delay (FID)
  new PerformanceObserver((entryList) => {
    for (const entry of entryList.getEntries()) {
      if (entry.entryType === 'first-input') {
        const fid = entry.processingStart - entry.startTime;
        console.log('[Perf] FID:', fid);
        if (window.gtag) {
          gtag('event', 'FID', {
            event_category: 'Web Vitals',
            value: Math.round(fid),
            non_interaction: true
          });
        }
      }
    }
  }).observe({ entryTypes: ['first-input'] });

  // Cumulative Layout Shift (CLS)
  let clsValue = 0;
  new PerformanceObserver((entryList) => {
    for (const entry of entryList.getEntries()) {
      if (!entry.hadRecentInput) {
        clsValue += entry.value;
      }
    }
    console.log('[Perf] CLS:', clsValue);
    if (window.gtag) {
      gtag('event', 'CLS', {
        event_category: 'Web Vitals',
        value: Math.round(clsValue * 1000),
        non_interaction: true
      });
    }
  }).observe({ entryTypes: ['layout-shift'] });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
