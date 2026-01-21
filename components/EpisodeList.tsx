
import React from 'react';
import { PodcastEpisode } from '../types';

interface EpisodeListProps {
  episodes: PodcastEpisode[];
  onSelect: (episode: PodcastEpisode) => void;
  selectedId?: number;
}

const EpisodeList: React.FC<EpisodeListProps> = ({ episodes, onSelect, selectedId }) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Select an Episode</h3>
      </div>
      <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto custom-scrollbar">
        {episodes.map((episode) => (
          <button
            key={episode.trackId}
            onClick={() => onSelect(episode)}
            className={`w-full flex items-start gap-4 p-4 text-left transition-colors hover:bg-purple-50/30 ${
              selectedId === episode.trackId ? 'bg-purple-50 ring-1 ring-inset ring-purple-100' : ''
            }`}
          >
            <img 
              src={episode.artworkUrl60} 
              alt="" 
              className="w-12 h-12 rounded-lg flex-shrink-0 object-cover shadow-sm"
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-gray-900 truncate">{episode.trackName}</h4>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400">
                  {new Date(episode.releaseDate).toLocaleDateString()}
                </span>
                {episode.trackTimeMillis && (
                  <span className="text-xs text-gray-400">
                    • {Math.round(episode.trackTimeMillis / 60000)} min
                  </span>
                )}
              </div>
            </div>
            {selectedId === episode.trackId && (
              <div className="text-purple-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EpisodeList;
