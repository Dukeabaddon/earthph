/**
 * Loading Spinner Component
 * 
 * Following frontend-developer.md standards:
 * - Semantic HTML structure
 * - Accessible ARIA attributes
 * - Responsive design
 * - Tailwind CSS utility classes
 * - Earthquake-themed seismograph animation
 */

import React from 'react';

/**
 * LoadingSpinner - Displays animated seismograph-style loading indicator
 * 
 * @param {Object} props
 * @param {string} props.message - Optional loading message
 * @param {string} props.size - Size variant: 'sm' | 'md' | 'lg' (default: 'md')
 * @returns {JSX.Element}
 */
export default function LoadingSpinner({ message = 'Loading...', size = 'md' }) {
  const sizeClasses = {
    sm: 'h-16',
    md: 'h-24',
    lg: 'h-32'
  };

  return (
    <div 
      className="flex flex-col items-center justify-center p-8"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      {/* Seismograph Animation */}
      <div className={`${sizeClasses[size]} w-64 relative`} aria-hidden="true">
        <svg
          className="w-full h-full"
          viewBox="0 0 200 60"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Baseline */}
          <line
            x1="0"
            y1="30"
            x2="200"
            y2="30"
            stroke="#E5E7EB"
            strokeWidth="0.5"
            strokeDasharray="2,2"
          />
          
          {/* Animated Seismograph Wave */}
          <path
            d="M0,30 L10,30 L15,20 L20,40 L25,15 L30,45 L35,25 L40,35 L45,28 L50,32 L55,30 L200,30"
            fill="none"
            stroke="#2563EB"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <animate
              attributeName="d"
              dur="2s"
              repeatCount="indefinite"
              values="
                M0,30 L10,30 L15,20 L20,40 L25,15 L30,45 L35,25 L40,35 L45,28 L50,32 L55,30 L200,30;
                M0,30 L10,30 L15,25 L20,35 L25,18 L30,42 L35,22 L40,38 L45,26 L50,34 L55,30 L200,30;
                M0,30 L10,30 L15,22 L20,38 L25,16 L30,44 L35,24 L40,36 L45,27 L50,33 L55,30 L200,30;
                M0,30 L10,30 L15,20 L20,40 L25,15 L30,45 L35,25 L40,35 L45,28 L50,32 L55,30 L200,30
              "
            />
            
            {/* Pulse effect */}
            <animate
              attributeName="opacity"
              dur="2s"
              repeatCount="indefinite"
              values="1;0.7;1"
            />
          </path>
          
          {/* Secondary wave for depth */}
          <path
            d="M0,30 L10,30 L15,20 L20,40 L25,15 L30,45 L35,25 L40,35 L45,28 L50,32 L55,30 L200,30"
            fill="none"
            stroke="#60A5FA"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.5"
          >
            <animate
              attributeName="d"
              dur="2s"
              repeatCount="indefinite"
              begin="0.2s"
              values="
                M0,30 L10,30 L15,22 L20,38 L25,16 L30,44 L35,24 L40,36 L45,27 L50,33 L55,30 L200,30;
                M0,30 L10,30 L15,20 L20,40 L25,15 L30,45 L35,25 L40,35 L45,28 L50,32 L55,30 L200,30;
                M0,30 L10,30 L15,25 L20,35 L25,18 L30,42 L35,22 L40,38 L45,26 L50,34 L55,30 L200,30;
                M0,30 L10,30 L15,22 L20,38 L25,16 L30,44 L35,24 L40,36 L45,27 L50,33 L55,30 L200,30
              "
            />
          </path>
        </svg>
        
        {/* Scanning line effect */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="h-full w-1 bg-gradient-to-b from-transparent via-primary-500 to-transparent opacity-50 animate-scan" />
        </div>
      </div>

      {/* Loading Message */}
      {message && (
        <p className="mt-6 text-gray-600 text-sm font-medium">
          {message}
        </p>
      )}
      
      <span className="sr-only">{message}</span>
      
      {/* Add custom animation styles */}
      <style jsx>{`
        @keyframes scan {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(256px);
          }
        }
        
        .animate-scan {
          animation: scan 2s linear infinite;
        }
      `}</style>
    </div>
  );
}
