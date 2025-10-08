import React, { useEffect, useRef, useState } from 'react';
import BackButton from '../components/BackButton';
import { FilmIcon, ClockIcon } from '../components/icons/Icons';
import { getSession } from '../services/storageService';

declare const Hls: any;

interface LiveTvSource {
    id: string;
    type: 'youtube' | 'hls';
    title: string;
    description?: string;
    poster?: string;
    url: string;
    duration?: number;
    addedBy?: string;
    addedAt?: string;
    status?: 'active' | 'queued' | 'completed';
}

interface LiveTvData {
    currentStreamId: string | null;
    isLive: boolean;
    queue: LiveTvSource[];
    sources: LiveTvSource[];
    defaultSourceId: string | null;
}

interface Movie {
    id: string;
    title: string;
    description: string;
    url: string;
    poster: string;
    duration?: number;
}

const LiveTvPage: React.FC = () => {
    const [liveTvData, setLiveTvData] = useState<LiveTvData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsInstance = useRef<any>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    
    const [showMovieModal, setShowMovieModal] = useState(false);
    const [showHlsModal, setShowHlsModal] = useState(false);
    const [movies, setMovies] = useState<Movie[]>([]);
    const [loadingMovies, setLoadingMovies] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [queueingMovie, setQueueingMovie] = useState<string | null>(null);
    
    const [hlsTitle, setHlsTitle] = useState('');
    const [hlsDescription, setHlsDescription] = useState('');
    const [hlsUrl, setHlsUrl] = useState('');
    const [hlsSubmitting, setHlsSubmitting] = useState(false);

    const currentStream = liveTvData?.currentStreamId 
        ? liveTvData.sources.find(s => s.id === liveTvData.currentStreamId) 
        : null;

    const fetchLiveTvData = async () => {
        try {
            const response = await fetch('/api/livetv');
            if (!response.ok) throw new Error('Failed to fetch Live TV data');
            const data = await response.json();
            setLiveTvData(data);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching Live TV data:', err);
            setError('Failed to load Live TV data');
            setLoading(false);
        }
    };

    const fetchMovies = async () => {
        setLoadingMovies(true);
        try {
            const response = await fetch('/api/movies');
            if (!response.ok) throw new Error('Failed to fetch movies');
            const data = await response.json();
            setMovies(data);
        } catch (err) {
            console.error('Error fetching movies:', err);
        } finally {
            setLoadingMovies(false);
        }
    };

    const queueYouTubeMovie = async (movieId: string) => {
        setQueueingMovie(movieId);
        try {
            const session = getSession();
            if (!session) {
                alert('Please log in to queue content');
                return;
            }
            
            const response = await fetch('/api/livetv/queue-youtube', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ movieId, session })
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to queue movie');
            }
            
            await fetchLiveTvData();
            setShowMovieModal(false);
            setSearchQuery('');
        } catch (err: any) {
            console.error('Error queuing movie:', err);
            alert(err.message || 'Failed to queue movie');
        } finally {
            setQueueingMovie(null);
        }
    };

    const addHlsUrl = async (e: React.FormEvent) => {
        e.preventDefault();
        setHlsSubmitting(true);
        try {
            const session = getSession();
            if (!session) {
                alert('Please log in to queue content');
                setHlsSubmitting(false);
                return;
            }
            
            const response = await fetch('/api/livetv/queue-hls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: hlsTitle,
                    description: hlsDescription,
                    url: hlsUrl,
                    session
                })
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to add HLS stream');
            }
            
            await fetchLiveTvData();
            setShowHlsModal(false);
            setHlsTitle('');
            setHlsDescription('');
            setHlsUrl('');
        } catch (err: any) {
            console.error('Error adding HLS:', err);
            alert(err.message || 'Failed to add HLS stream');
        } finally {
            setHlsSubmitting(false);
        }
    };

    useEffect(() => {
        fetchLiveTvData();
        
        const interval = setInterval(fetchLiveTvData, 3000);
        
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!currentStream) {
            if (hlsInstance.current) {
                hlsInstance.current.destroy();
                hlsInstance.current = null;
            }
            return;
        }

        if (currentStream.type === 'hls') {
            const videoElement = videoRef.current;
            if (!videoElement) return;

            if (Hls.isSupported()) {
                if (hlsInstance.current) {
                    hlsInstance.current.destroy();
                }
                const hls = new Hls();
                hlsInstance.current = hls;
                hls.loadSource(currentStream.url);
                hls.attachMedia(videoElement);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    videoElement.play().catch(e => console.error("Autoplay prevented:", e));
                });
            } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
                videoElement.src = currentStream.url;
                videoElement.addEventListener('loadedmetadata', () => {
                    videoElement.play().catch(e => console.error("Autoplay prevented:", e));
                });
            }
        }

        return () => {
            if (hlsInstance.current) {
                hlsInstance.current.destroy();
                hlsInstance.current = null;
            }
        };
    }, [currentStream]);

    const formatDuration = (seconds?: number) => {
        if (!seconds) return 'N/A';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        return date.toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    const filteredMovies = movies.filter(m => 
        m.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="animate-fade-in">
                <BackButton />
                <div className="flex justify-center items-center h-64">
                    <div className="text-white">Loading Live TV...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="animate-fade-in">
                <BackButton />
                <div className="flex justify-center items-center h-64">
                    <div className="text-red-400">{error}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in pb-20">
            <BackButton />
            
            <div className="text-center mb-8">
                <h1 className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-red-500 via-purple-500 to-blue-500">
                    📺 Live TV
                </h1>
                <p className="text-gray-300 mt-2 flex items-center justify-center gap-2">
                    {liveTvData?.isLive ? (
                        <>
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                            <span className="text-red-400 font-bold">LIVE NOW</span>
                        </>
                    ) : (
                        <span className="text-gray-500">Broadcast Offline</span>
                    )}
                </p>
            </div>

            <div className="max-w-6xl mx-auto mb-6 flex gap-4 justify-center">
                <button
                    onClick={() => {
                        setShowMovieModal(true);
                        fetchMovies();
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg font-bold hover:from-purple-600 hover:to-blue-600 transition-all shadow-lg"
                >
                    ➕ Queue YouTube Movie
                </button>
                <button
                    onClick={() => setShowHlsModal(true)}
                    className="px-6 py-3 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg font-bold hover:from-green-600 hover:to-teal-600 transition-all shadow-lg"
                >
                    ➕ Add HLS URL
                </button>
            </div>

            {liveTvData?.isLive && currentStream ? (
                <div className="space-y-6">
                    <div className="aspect-video w-full max-w-6xl mx-auto bg-black rounded-lg overflow-hidden border-2 border-purple-500/30 shadow-2xl shadow-purple-500/20">
                        {currentStream.type === 'youtube' ? (
                            <iframe
                                ref={iframeRef}
                                src={`https://www.youtube.com/embed/${currentStream.url}?autoplay=1&mute=0&controls=1&modestbranding=1`}
                                title={currentStream.title}
                                className="w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        ) : (
                            <video
                                ref={videoRef}
                                controls
                                playsInline
                                className="w-full h-full"
                                poster={currentStream.poster}
                            />
                        )}
                    </div>

                    <div className="max-w-6xl mx-auto bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 border border-gray-700">
                        <div className="flex items-start gap-4">
                            {currentStream.poster && (
                                <img 
                                    src={currentStream.poster} 
                                    alt={currentStream.title}
                                    className="w-32 h-48 object-cover rounded-lg border-2 border-purple-500/30"
                                />
                            )}
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm font-bold uppercase">
                                        {currentStream.type}
                                    </span>
                                    <span className="text-gray-400 text-sm">
                                        <ClockIcon className="inline w-4 h-4 mr-1" />
                                        {formatDuration(currentStream.duration)}
                                    </span>
                                </div>
                                <h2 className="text-3xl font-bold text-white mb-2">{currentStream.title}</h2>
                                {currentStream.description && (
                                    <p className="text-gray-300 mb-3">{currentStream.description}</p>
                                )}
                                <div className="flex gap-4 text-sm text-gray-400">
                                    {currentStream.addedBy && (
                                        <span>Added by: {currentStream.addedBy}</span>
                                    )}
                                    {currentStream.addedAt && (
                                        <span>Started: {formatDate(currentStream.addedAt)}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {liveTvData.queue.length > 0 && (
                        <div className="max-w-6xl mx-auto bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 border border-gray-700">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <span className="text-2xl">📋</span>
                                Up Next ({liveTvData.queue.length})
                            </h3>
                            <div className="space-y-3">
                                {liveTvData.queue.slice(0, 5).map((source, index) => (
                                    <div 
                                        key={source.id}
                                        className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50 hover:border-purple-500/30 transition-colors"
                                    >
                                        <div className="flex items-center justify-center w-8 h-8 bg-purple-500/20 text-purple-400 rounded-full font-bold">
                                            {index + 1}
                                        </div>
                                        {source.poster && (
                                            <img 
                                                src={source.poster} 
                                                alt={source.title}
                                                className="w-16 h-24 object-cover rounded border border-gray-700"
                                            />
                                        )}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs uppercase">
                                                    {source.type}
                                                </span>
                                                {source.duration && (
                                                    <span className="text-gray-500 text-xs">
                                                        {formatDuration(source.duration)}
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className="text-white font-semibold">{source.title}</h4>
                                            {source.description && (
                                                <p className="text-gray-400 text-sm line-clamp-1">{source.description}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center text-center py-20 bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-dashed border-gray-700 rounded-lg max-w-6xl mx-auto">
                    <FilmIcon className="w-24 h-24 text-gray-600 mb-6" />
                    <h2 className="text-3xl font-bold text-white mb-2">Broadcast Offline</h2>
                    <p className="text-gray-400 mb-4">No live stream is currently active.</p>
                    {liveTvData?.queue && liveTvData.queue.length > 0 && (
                        <p className="text-purple-400">
                            {liveTvData.queue.length} source{liveTvData.queue.length > 1 ? 's' : ''} queued
                        </p>
                    )}
                    {liveTvData?.sources && liveTvData.sources.length > 0 && (
                        <p className="text-gray-500 mt-2 text-sm">
                            {liveTvData.sources.length} total source{liveTvData.sources.length > 1 ? 's' : ''} available
                        </p>
                    )}
                </div>
            )}

            {showMovieModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-gray-700">
                            <h2 className="text-2xl font-bold text-white mb-4">Queue YouTube Movie</h2>
                            <input
                                type="text"
                                placeholder="Search movies..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            {loadingMovies ? (
                                <div className="text-center text-gray-400">Loading movies...</div>
                            ) : filteredMovies.length === 0 ? (
                                <div className="text-center text-gray-400">No movies found</div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    {filteredMovies.map((movie) => (
                                        <div
                                            key={movie.id}
                                            className="bg-gray-700 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all"
                                            onClick={() => queueYouTubeMovie(movie.id)}
                                        >
                                            {movie.poster && (
                                                <img
                                                    src={movie.poster}
                                                    alt={movie.title}
                                                    className="w-full h-48 object-cover"
                                                />
                                            )}
                                            <div className="p-3">
                                                <h3 className="text-white font-semibold text-sm line-clamp-2">{movie.title}</h3>
                                                {queueingMovie === movie.id && (
                                                    <div className="mt-2 text-purple-400 text-xs">Adding to queue...</div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-700">
                            <button
                                onClick={() => {
                                    setShowMovieModal(false);
                                    setSearchQuery('');
                                }}
                                className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showHlsModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-lg max-w-2xl w-full">
                        <div className="p-6 border-b border-gray-700">
                            <h2 className="text-2xl font-bold text-white">Add HLS Stream</h2>
                        </div>
                        <form onSubmit={addHlsUrl} className="p-6 space-y-4">
                            <div>
                                <label className="block text-white font-semibold mb-2">Title *</label>
                                <input
                                    type="text"
                                    required
                                    value={hlsTitle}
                                    onChange={(e) => setHlsTitle(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-green-500 focus:outline-none"
                                    placeholder="Stream Title"
                                />
                            </div>
                            <div>
                                <label className="block text-white font-semibold mb-2">Description</label>
                                <textarea
                                    value={hlsDescription}
                                    onChange={(e) => setHlsDescription(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-green-500 focus:outline-none"
                                    placeholder="Stream Description"
                                    rows={3}
                                />
                            </div>
                            <div>
                                <label className="block text-white font-semibold mb-2">HLS URL *</label>
                                <input
                                    type="url"
                                    required
                                    value={hlsUrl}
                                    onChange={(e) => setHlsUrl(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-green-500 focus:outline-none"
                                    placeholder="https://example.com/stream.m3u8"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="submit"
                                    disabled={hlsSubmitting}
                                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg font-bold hover:from-green-600 hover:to-teal-600 transition-all disabled:opacity-50"
                                >
                                    {hlsSubmitting ? 'Adding...' : 'Add to Queue'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowHlsModal(false);
                                        setHlsTitle('');
                                        setHlsDescription('');
                                        setHlsUrl('');
                                    }}
                                    className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LiveTvPage;
