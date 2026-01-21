
import React from 'react';
// Changed PodcastInfo to PodcastEpisode as it is the intended type for episode display
import { PodcastEpisode } from '../types';

interface PodcastCardProps {
  info: PodcastEpisode;
}

const PodcastCard: React.FC<PodcastCardProps> = ({ info }) => {
  // Use a default placeholder if image is missing
  const artwork = info.artworkUrl600 || info.artworkUrl60 || "https://placehold.co/600x600/EEE/31343C?text=No+Cover";

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <img 
        src={artwork} 
        alt={info.trackName} 
        className="w-32 h-32 md:w-40 md:h-40 rounded-xl object-cover shadow-md"
        onError={(e) => {
          (e.target as HTMLImageElement).src = "https://placehold.co/600x600/EEE/31343C?text=Error";
        }}
      />
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2.5 py-1 rounded-full uppercase">
            Episode
          </span>
          <span className="text-gray-400 text-sm">
            {new Date(info.releaseDate).toLocaleDateString()}
          </span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">{info.trackName}</h2>
        <p className="text-gray-600 font-medium mb-3">{info.artistName}</p>
        <div className="text-gray-500 text-sm line-clamp-3 leading-relaxed" 
             dangerouslySetInnerHTML={{ __html: info.description }}>
        </div>
      </div>
    </div>
  );
};

export default PodcastCard;
