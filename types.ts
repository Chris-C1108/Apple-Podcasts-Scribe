
export interface PodcastMetadata {
  id: string;
  title: string;
  artistName: string;
  artworkUrl: string;
  description?: string;
}

export interface PodcastEpisode {
  trackId: number;
  trackName: string;
  artistName: string;
  description: string;
  releaseDate: string;
  episodeUrl: string;
  artworkUrl60: string;
  artworkUrl600?: string;
  trackTimeMillis?: number;
}

export interface TranscriptionResult {
  text: string;
  status: 'idle' | 'fetching' | 'processing' | 'completed' | 'error';
  error?: string;
}

export interface PodcastLookupResult {
  collection?: PodcastMetadata;
  episodes: PodcastEpisode[];
  isSpecificEpisode: boolean;
}
