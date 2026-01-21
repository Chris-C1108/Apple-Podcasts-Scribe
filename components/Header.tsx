
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="py-8 text-center">
      <div className="flex justify-center items-center mb-4">
        <div className="bg-purple-600 p-3 rounded-2xl shadow-lg shadow-purple-200">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </div>
      </div>
      <h1 className="text-4xl font-bold text-gray-900 tracking-tight">PodScribe AI</h1>
      <p className="mt-2 text-gray-500 max-w-md mx-auto">
        Transform your favorite Apple Podcasts into precise text scripts using the power of Google Gemini.
      </p>
    </header>
  );
};

export default Header;
