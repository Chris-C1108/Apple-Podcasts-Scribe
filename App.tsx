
import React, { useState } from 'react';
import Header from './components/Header';
import PodcastCard from './components/PodcastCard';
import EpisodeList from './components/EpisodeList';
import LogConsole from './components/LogConsole';
import PodcastSearchResults from './components/PodcastSearchResults';
import { fetchPodcastData, downloadAudioAsBase64, searchPodcasts } from './services/podcastService';
import { transcribeAudio } from './services/geminiService';
import { PodcastMetadata, PodcastEpisode, TranscriptionResult, PodcastSearchResult } from './types';

// The App component handles the main application logic, state management for search, 
// episode selection, and transcription processes.
const App: React.FC = () => {
  const [url, setUrl] = useState('');
  const [collection, setCollection] = useState<PodcastMetadata | null>(null);
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<PodcastEpisode | null>(null);
  const [searchResults, setSearchResults] = useState<PodcastSearchResult[]>([]);
  const [transcription, setTranscription] = useState<TranscriptionResult>({
    text: '',
    status: 'idle'
  });
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [viewState, setViewState] = useState<'initial' | 'results' | 'collection' | 'episode'>('initial');

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setTranscription({ text: '', status: 'fetching' });
    setCollection(null);
    setEpisodes([]);
    setSelectedEpisode(null);
    setSearchResults([]);
    setLogs([]);
    setViewState('initial');

    const isUrl = url.includes('apple.com') || url.startsWith('http');

    if (isUrl) {
      setLoadingStep('Locating RSS feed...');
      try {
        addLog(`Starting search for URL: ${url}`);
        const data = await fetchPodcastData(url, addLog);
        if (!data) throw new Error("Could not find podcast. Please check the URL.");
        
        setCollection(data.collection || null);
        setEpisodes(data.episodes);
        setViewState('collection');
        
        if (data.isSpecificEpisode && data.episodes.length === 1) {
          setSelectedEpisode(data.episodes[0]);
          setViewState('episode');
          addLog(`Auto-selected specific episode: ${data.episodes[0].trackName}`);
        }
        
        setTranscription({ text: '', status: 'idle' });
        addLog("Search completed successfully.");
      } catch (err: any) {
        const errorMsg = err.message || "Unknown error";
        setTranscription({ text: '', status: 'error', error: errorMsg });
        addLog(`Search Error: ${errorMsg}`);
      } finally {
        setLoadingStep('');
      }
    } else {
      setLoadingStep('Searching iTunes directory...');
      try {
        addLog(`Searching iTunes for term: "${url}"`);
        const results = await searchPodcasts(url, addLog);
        setSearchResults(results);
        setViewState('results');
        setTranscription({ text: '', status: 'idle' });
        
        if (results.length === 0) {
          addLog("No results found.");
        } else {
          addLog(`Found ${results.length} podcasts.`);
        }
      } catch (err: any) {
        const errorMsg = err.message || "Unknown error";
        setTranscription({ text: '', status: 'error', error: errorMsg });
        addLog(`Search Error: ${errorMsg}`);
      } finally {
        setLoadingStep('');
      }
    }
  };

  const handlePodcastSelect = async (result: PodcastSearchResult) => {
    setLoadingStep(`Loading "${result.collectionName}"...`);
    addLog(`Selected podcast: ${result.collectionName}`);
    addLog(`Feed URL: ${result.feedUrl}`);

    const lookupUrl = `https://podcasts.apple.com/podcast/id${result.collectionId}`;
    addLog(`Constructed lookup URL: ${lookupUrl}`);
    
    try {
      const data = await fetchPodcastData(lookupUrl, addLog);
      if (!data) throw new Error("Could not load podcast details.");

      setCollection(data.collection || null);
      setEpisodes(data.episodes);
      setViewState('collection');
      setTranscription({ text: '', status: 'idle' });
      addLog("Podcast loaded successfully.");
    } catch (err: any) {
       const errorMsg = err.message || "Unknown error";
       setTranscription({ text: '', status: 'error', error: errorMsg });
       addLog(`Load Error: ${errorMsg}`);
    } finally {
       setLoadingStep('');
    }
  };

  const handleTranscribe = async () => {
    if (!selectedEpisode?.episodeUrl) {
      setTranscription({ ...transcription, status: 'error', error: "No audio URL found for this episode." });
      addLog("Error: No audio URL found.");
      return;
    }

    setTranscription({ ...transcription, status: 'processing' });
    setLoadingStep('Downloading audio stream...');
    addLog(`Starting transcription for: ${selectedEpisode.trackName}`);

    try {
      const base64 = await downloadAudioAsBase64(selectedEpisode.episodeUrl, addLog);
      
      setLoadingStep('AI is generating transcript...');
      addLog("Audio downloaded. Starting AI transcription...");
      
      const text = await transcribeAudio(base64, 'audio/mpeg', addLog);
      
      setTranscription({ text, status: 'completed' });
      addLog("Transcription completed successfully.");
    } catch (err: any) {
      const errorMsg = err.message || "Failed to process audio.";
      setTranscription({ 
        text: '', 
        status: 'error', 
        error: errorMsg 
      });
      addLog(`Transcription Error: ${errorMsg}`);
    } finally {
      setLoadingStep('');
    }
  };

  const isFetching = transcription.status === 'fetching';
  const isProcessing = transcription.status === 'processing';
  const isCompleted = transcription.status === 'completed';
  const isError = transcription.status === 'error';

  return (
    <div className="min-h-screen pb-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-4xl mx-auto">
        <Header />

        {/* Search Section */}
        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 mb-8">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 group">
              <input
                type="text"
                placeholder="Enter podcast name or Apple Podcasts URL..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border-transparent focus:bg-white focus:border-purple-300 focus:ring-4 focus:ring-purple-100 rounded-2xl transition-all duration-300 outline-none text-gray-700"
                disabled={isFetching || isProcessing}
              />
            </div>
            <button
              type="submit"
              disabled={isFetching || isProcessing || !url.trim()}
              className="px-8 py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white font-bold rounded-2xl transition-all duration-300 shadow-lg shadow-purple-200 hover:shadow-purple-300 disabled:shadow-none flex items-center justify-center gap-2"
            >
              {isFetching ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Searching...
                </>
              ) : (
                'Search'
              )}
            </button>
          </form>

          {loadingStep && (
            <div className="mt-4 flex items-center gap-3 text-slate-500 animate-pulse">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span className="text-sm font-medium">{loadingStep}</span>
            </div>
          )}

          {isError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-medium">{transcription.error}</p>
            </div>
          )}
        </div>

        {/* Content Section */}
        <LogConsole logs={logs} />
        <div className="space-y-8">
          
          {viewState === 'results' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="text-xl font-bold text-gray-900 mb-4 px-1">Search Results</h3>
              <PodcastSearchResults 
                results={searchResults} 
                onSelect={handlePodcastSelect} 
              />
            </div>
          )}

          {viewState !== 'results' && selectedEpisode && (
            <div className="space-y-6">
              <PodcastCard info={selectedEpisode} />
              
              {!isCompleted && (
                <div className="flex justify-center">
                  <button
                    onClick={handleTranscribe}
                    disabled={isProcessing}
                    className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-slate-900 font-pj rounded-2xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
                  >
                    <div className="absolute transition-all duration-200 gradient-bg-purple-blue opacity-70 -inset-px rounded-2xl group-hover:opacity-100 group-hover:-inset-1 group-hover:duration-200"></div>
                    <span className="relative flex items-center gap-2">
                      {isProcessing ? (
                        <>
                          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Transcribing...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Generate Transcript
                        </>
                      )}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {viewState !== 'results' && isCompleted && (
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Transcript</h3>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(transcription.text);
                    alert("Copied to clipboard!");
                  }}
                  className="text-purple-600 hover:text-purple-700 font-semibold text-sm flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Copy Text
                </button>
              </div>
              <div className="prose prose-purple max-w-none">
                <div className="whitespace-pre-wrap text-gray-700 leading-relaxed font-serif text-lg">
                  {transcription.text}
                </div>
              </div>
            </div>
          )}

          {viewState !== 'results' && episodes.length > 1 && !selectedEpisode && (
            <EpisodeList 
              episodes={episodes} 
              onSelect={setSelectedEpisode} 
              selectedId={selectedEpisode?.trackId} 
            />
          )}

          {viewState !== 'results' && collection && !selectedEpisode && episodes.length === 0 && (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
              <p className="text-slate-400">No episodes found in the feed.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
