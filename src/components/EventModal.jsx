import React, { useEffect, useCallback, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { formatDateTime, timeAgo, formatMagnitude, formatDepth } from '../utils/dateFormat';


export default function EventModal({ event, isOpen, onClose, position }) {
  const modalRef = useRef(null);
  const [adjustedPosition, setAdjustedPosition] = useState({ top: 0, left: 0 });

  // Handle ESC key press
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && isOpen) {
      onClose();
    }
  }, [isOpen, onClose]);

  // Calculate popup position
  useEffect(() => {
    if (isOpen && modalRef.current && position) {
      const modal = modalRef.current;
      const rect = modal.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let top = position.y + 10; 
      let left = position.x + 10;

      // Adjust if modal goes off-screen right
      if (left + rect.width > viewportWidth - 20) {
        left = position.x - rect.width - 10;
      }

      // Adjust if modal goes off-screen bottom
      if (top + rect.height > viewportHeight - 20) {
        top = position.y - rect.height - 10;
      }

      // Ensure minimum margins
      top = Math.max(20, top);
      left = Math.max(20, left);

      setAdjustedPosition({ top, left });
    }
  }, [isOpen, position]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !event) return null;

  // Date validation 
  let dateTime = { date: 'N/A', time: '', combined: 'Date unavailable' };
  if (event.datetime) {
    try {
      const testDate = new Date(event.datetime);
      if (!isNaN(testDate.getTime())) {
        dateTime = formatDateTime(event.datetime);
      }
    } catch (error) {
      console.error('[EventModal] Date formatting error:', error);
    }
  }

  const mag = formatMagnitude(event.magnitude || 0);

  return (
    <>
      <div 
        className="fixed inset-0 z-[1100]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        className="fixed z-[1200] w-80 shadow-2xl rounded-lg overflow-hidden"
        style={{
          top: `${adjustedPosition.top}px`,
          left: `${adjustedPosition.left}px`,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-black px-3 py-2 flex items-center justify-between">
          <h2 id="modal-title" className="text-white text-xs font-semibold uppercase">
            Earthquake Details
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-300 hover:text-white text-lg leading-none w-5 h-5 flex items-center justify-center"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="bg-white">
          <table className="w-full text-xs leading-tight">
            <tbody>
              {/* Magnitude Row */}
              <tr className="border-b border-gray-200">
                <td className="px-3 py-1.5 font-medium text-gray-700 w-2/5">Magnitude</td>
                <td className={`px-3 py-1.5 font-bold text-base ${mag.colorClass}`}>{mag.value}</td>
              </tr>

              {/* Date & Time Combined Row */}
              <tr className="border-b border-gray-200">
                <td className="px-3 py-1.5 font-medium text-gray-700">Date & Time</td>
                <td className="px-3 py-1.5 text-gray-900">{dateTime.combined}</td>
              </tr>

              {/* Location Row */}
              <tr className="border-b border-gray-200">
                <td className="px-3 py-1.5 font-medium text-gray-700 align-top">Location</td>
                <td className="px-3 py-1.5 text-gray-900">{event.location || 'Location unknown'}</td>
              </tr>

              {/* Coordinates Combined Row */}
              <tr className="border-b border-gray-200">
                <td className="px-3 py-1.5 font-medium text-gray-700">Coordinates</td>
                <td className="px-3 py-1.5 text-gray-900 font-mono text-xs">
                  {(event.latitude ?? 0).toFixed(2)}°N, {(event.longitude ?? 0).toFixed(2)}°E
                </td>
              </tr>

              {/* Depth Row */}
              <tr>
                <td className="px-3 py-1.5 font-medium text-gray-700">Depth</td>
                <td className="px-3 py-1.5 text-gray-900">{formatDepth(event.depth ?? 0)}</td>
              </tr>
            </tbody>
          </table>

          {/* Footer - Source Attribution */}
          <div className="px-3 py-1 bg-gray-50 border-t border-gray-200">
            <p className="text-xs text-gray-600">
              Source: <span className="font-medium">PHIVOLCS</span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// PropTypes validation
EventModal.propTypes = {
  event: PropTypes.shape({
    id: PropTypes.number,
    datetime: PropTypes.string,
    magnitude: PropTypes.number,
    latitude: PropTypes.number,
    longitude: PropTypes.number,
    depth: PropTypes.number,
    location: PropTypes.string,
    mmi_intensity: PropTypes.string,
    event_type: PropTypes.string,
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
  }),
};
