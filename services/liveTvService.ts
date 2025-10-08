import * as fs from 'fs';
import * as path from 'path';

const LIVETV_PATH = path.join(process.cwd(), 'data', 'liveTv.json');

export interface LiveTvSource {
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

export interface LiveTvData {
    currentStreamId: string | null;
    isLive: boolean;
    queue: LiveTvSource[];
    sources: LiveTvSource[];
    defaultSourceId: string | null;
}

const atomicWrite = (filePath: string, content: string) => {
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, content, 'utf-8');
    fs.renameSync(tempPath, filePath);
};

export const readLiveTvData = (): LiveTvData => {
    try {
        if (!fs.existsSync(LIVETV_PATH)) {
            const defaultData: LiveTvData = {
                currentStreamId: null,
                isLive: false,
                queue: [],
                sources: [],
                defaultSourceId: null
            };
            atomicWrite(LIVETV_PATH, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        const data = fs.readFileSync(LIVETV_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading liveTv.json:', error);
        return {
            currentStreamId: null,
            isLive: false,
            queue: [],
            sources: [],
            defaultSourceId: null
        };
    }
};

export const writeLiveTvData = (data: LiveTvData) => {
    atomicWrite(LIVETV_PATH, JSON.stringify(data, null, 2));
};

export const getCurrentStream = (): LiveTvSource | null => {
    const data = readLiveTvData();
    if (!data.currentStreamId) return null;
    
    return data.sources.find(s => s.id === data.currentStreamId) || null;
};

export const addSourceToQueue = (source: LiveTvSource): boolean => {
    try {
        const data = readLiveTvData();
        
        const sourceWithMetadata = {
            ...source,
            id: source.id || `stream_${Date.now()}`,
            addedAt: new Date().toISOString(),
            status: 'queued' as const
        };
        
        data.sources.push(sourceWithMetadata);
        data.queue.push(sourceWithMetadata);
        
        writeLiveTvData(data);
        return true;
    } catch (error) {
        console.error('Error adding source to queue:', error);
        return false;
    }
};

export const goLive = (sourceId?: string): LiveTvSource | null => {
    try {
        const data = readLiveTvData();
        
        let streamToPlay: LiveTvSource | null = null;
        
        if (sourceId) {
            streamToPlay = data.sources.find(s => s.id === sourceId) || null;
        } else if (data.queue.length > 0) {
            streamToPlay = data.queue[0];
        } else if (data.defaultSourceId) {
            streamToPlay = data.sources.find(s => s.id === data.defaultSourceId) || null;
        }
        
        if (!streamToPlay) return null;
        
        data.currentStreamId = streamToPlay.id;
        data.isLive = true;
        
        const sourceIndex = data.sources.findIndex(s => s.id === streamToPlay!.id);
        if (sourceIndex !== -1) {
            data.sources[sourceIndex].status = 'active';
        }
        
        data.queue = data.queue.filter(s => s.id !== streamToPlay!.id);
        
        writeLiveTvData(data);
        return streamToPlay;
    } catch (error) {
        console.error('Error going live:', error);
        return null;
    }
};

export const stopBroadcast = (): boolean => {
    try {
        const data = readLiveTvData();
        
        if (data.currentStreamId) {
            const sourceIndex = data.sources.findIndex(s => s.id === data.currentStreamId);
            if (sourceIndex !== -1) {
                data.sources[sourceIndex].status = 'completed';
            }
        }
        
        data.currentStreamId = null;
        data.isLive = false;
        
        writeLiveTvData(data);
        return true;
    } catch (error) {
        console.error('Error stopping broadcast:', error);
        return false;
    }
};

export const skipToNext = (): LiveTvSource | null => {
    stopBroadcast();
    return goLive();
};

export const setDefaultSource = (sourceId: string): boolean => {
    try {
        const data = readLiveTvData();
        const sourceExists = data.sources.some(s => s.id === sourceId);
        
        if (!sourceExists) return false;
        
        data.defaultSourceId = sourceId;
        writeLiveTvData(data);
        return true;
    } catch (error) {
        console.error('Error setting default source:', error);
        return false;
    }
};

export const removeSource = (sourceId: string): boolean => {
    try {
        const data = readLiveTvData();
        
        if (data.currentStreamId === sourceId) {
            stopBroadcast();
        }
        
        data.sources = data.sources.filter(s => s.id !== sourceId);
        data.queue = data.queue.filter(s => s.id !== sourceId);
        
        if (data.defaultSourceId === sourceId) {
            data.defaultSourceId = null;
        }
        
        writeLiveTvData(data);
        return true;
    } catch (error) {
        console.error('Error removing source:', error);
        return false;
    }
};

export const clearQueue = (): boolean => {
    try {
        const data = readLiveTvData();
        data.queue = [];
        writeLiveTvData(data);
        return true;
    } catch (error) {
        console.error('Error clearing queue:', error);
        return false;
    }
};
