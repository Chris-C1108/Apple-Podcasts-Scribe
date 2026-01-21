import React from 'react';
import { PodcastSearchResult } from '../types';

interface PodcastSearchResultsProps {
  results: PodcastSearchResult[];
  onSelect: (result: PodcastSearchResult) => void;
}

const PodcastSearchResults: React.FC<PodcastSearchResultsProps> = ({ results, onSelect }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {results.map((result) => (
        <div 
          key={result.collectionId}
          onClick={() => onSelect(result)}
          className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer flex gap-4 items-center group"
        >
          <img 
            src={result.artworkUrl600} 
            alt={result.collectionName} 
            className="w-20 h-20 rounded-lg object-cover bg-slate-100 group-hover:scale-105 transition-transform"
          />
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-gray-900 truncate group-hover:text-purple-600 transition-colors">
              {result.collectionName}
            </h4>
            <p className="text-sm text-gray-500 truncate">{result.artistName}</p>
            <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
              {result.primaryGenreName}
            </span>
          </div>
          <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      ))}
    </div>
  );
};

export default PodcastSearchResults;
