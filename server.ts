// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

// FIX: Changed import style to use `express.Request` and `express.Response` to resolve type conflicts.
import express from 'express';
import path from 'path';
import fs from 'fs';
import { tmpdir } from 'os';
import { spawn } from 'child_process';
import { createReadStream, unlinkSync, statSync, readdirSync, existsSync } from 'fs';
import { runBot } from './bot/run';
import { OpenAIClient, AzureKeyCredential } from "@azure/openai";
import usersRouter from './api/users';
import commentsRouter from './api/comments';
import { csrfProtection } from './api/csrf';
import { securityHeadersMiddleware } from './api/securityHeaders';
import { errorHandler, notFoundHandler } from './api/errorHandler';
import { getYouTubeVideoInfo as getServerYouTubeVideoInfo, isValidYouTubeURL } from './services/serverYoutubeService';
import { ytdlpManager } from './services/ytdlpBinaryManager';
import { ffmpegService } from './services/ffmpegService';
import { downloadYouTubeWithHEAAC } from './services/downloadWithHEAAC';
import { serverMovieRepository } from './server/movieRepository';
import { addSourceToQueue, LiveTvSource } from './services/liveTvService';
import { getSession, validateSessionBinding } from './api/sessionStore';

/**
 * SECURITY AUDIT: Session Validation
 * 
 * ✅ All protected endpoints use validateAuthToken() which:
 *    - Validates Bearer token format
 *    - Checks session against server-side session store
 *    - Validates session binding (IP + User-Agent)
 *    - Verifies user still exists in database
 * 
 * Protected endpoints:
 * - POST /api/azure-ai (AI requests)
 * - POST /api/youtube-downloader (YouTube downloads)
 * - POST /api/livetv/queue-youtube (Admin only - Live TV)
 * - POST /api/livetv/queue-hls (Admin only - Live TV)
 * 
 * All /api/users and /api/comments routes use authMiddleware from users.ts and comments.ts
 * which implements the same secure validation pattern.
 */

// SECURITY FIX: Proper session validation using server-side session store
// This replaces the vulnerable getUserFromToken that trusted client data
const validateAuthToken = (authHeader: string | undefined, req: express.Request): { valid: boolean; userId?: string; error?: string } => {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { valid: false, error: 'Missing or invalid authorization header' };
    }
    
    const sessionToken = authHeader.substring(7);
    if (!sessionToken) {
        return { valid: false, error: 'No session token provided' };
    }
    
    // Validate session against server-side session store
    const session = getSession(sessionToken);
    if (!session) {
        return { valid: false, error: 'Invalid or expired session' };
    }
    
    // Validate session binding to prevent session hijacking
    const clientIp = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    const clientUserAgent = req.headers['user-agent'] || 'unknown';
    
    if (!validateSessionBinding(session, clientIp, clientUserAgent)) {
        console.error(`🚨 Session hijacking detected for user ${session.userId}`);
        return { valid: false, error: 'Session security check failed' };
    }
    
    // Verify user exists
    const usersPath = path.join(process.cwd(), 'data', 'users.json');
    try {
        const usersData = fs.readFileSync(usersPath, 'utf-8');
        const users = JSON.parse(usersData);
        const user = users.find((u: any) => u.id === session.userId);
        if (!user) {
            return { valid: false, error: 'User not found' };
        }
        return { valid: true, userId: session.userId };
    } catch (error) {
        console.error('Error reading users:', error);
        return { valid: false, error: 'Authentication error' };
    }
};

// SECURITY: Check if request is from allowed origin (prevents external API abuse)
const validateOrigin = (req: express.Request): boolean => {
    const origin = req.headers.origin || req.headers.referer;
    if (!origin) {
        // Allow requests with no origin/referer (direct browser access, Postman, etc.)
        // But only if they have valid session - handled by auth check
        return true;
    }
    
    try {
        const url = new URL(origin);
        const allowedHosts = [
            'localhost',
            '127.0.0.1',
            req.headers.host // Allow same-origin requests
        ];
        
        // Check if origin matches allowed hosts
        return allowedHosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
    } catch {
        return false;
    }
};

// --- SERVER SETUP ---
const app = express();
// FIX: Explicitly parse the port to a number to satisfy the listen() function's type requirement.
// Port configuration with real environment detection
// Auto-detects Replit environment via REPL_ID, otherwise assumes VPS/local
const isReplit = !!process.env.REPL_ID;
const defaultPort = isReplit ? '5000' : '5019';
const PORT = parseInt(process.env.PORT || defaultPort, 10);

console.log(`🔍 Environment detected: ${isReplit ? 'Replit' : 'VPS/Local'} - Using port ${PORT}`);

// @FIX: The type errors in route handlers were causing this `app.use` call to fail type checking. Fixing the handlers resolves this.
app.use(express.json({ limit: '10mb' })); // Increase limit for profile pics

// --- SECURITY MIDDLEWARE ---
app.use(securityHeadersMiddleware);
app.use(csrfProtection);

// --- SECURITY & HELPERS ---
const userRequests = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;

const checkRateLimit = (userId: string) => {
    const now = Date.now();
    const timestamps = userRequests.get(userId) || [];
    const recentTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (recentTimestamps.length >= MAX_REQUESTS_PER_WINDOW) return { limited: true };
    recentTimestamps.push(now);
    userRequests.set(userId, recentTimestamps);
    return { limited: false };
};

// SECURITY FIX: Periodic cleanup of old rate limit data to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [userId, timestamps] of userRequests.entries()) {
        const recentTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
        if (recentTimestamps.length === 0) {
            userRequests.delete(userId);
            cleaned++;
        } else {
            userRequests.set(userId, recentTimestamps);
        }
    }
    if (cleaned > 0) {
        console.log(`🧹 Rate limiter cleanup: removed ${cleaned} inactive user(s)`);
    }
}, 5 * 60 * 1000); // Run every 5 minutes

// Removed local validateSession as it's now imported from ./api/auth

// --- AZURE AI CLIENT SETUP ---
let azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
const azureDeploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

// Fix endpoint if it contains the full URL instead of base URL
if (azureEndpoint && azureEndpoint.includes('/openai/deployments/')) {
    const url = new URL(azureEndpoint);
    azureEndpoint = `${url.protocol}//${url.host}/`;
    console.log('🔧 Fixed endpoint format to:', azureEndpoint);
}

let azureClient: OpenAIClient | null = null;
if (azureEndpoint && azureApiKey) {
    try {
        azureClient = new OpenAIClient(azureEndpoint, new AzureKeyCredential(azureApiKey));
        console.log('✅ Azure OpenAI client initialized');
        console.log('Endpoint:', azureEndpoint);
        console.log('Deployment:', azureDeploymentName);
    } catch (error) {
        console.error('❌ Failed to initialize Azure OpenAI client:', error);
    }
} else {
    console.log('❌ Missing Azure OpenAI configuration:');
    console.log('Endpoint:', azureEndpoint ? '✓' : '✗');
    console.log('API Key:', azureApiKey ? '✓' : '✗');
    console.log('Deployment:', azureDeploymentName ? '✓' : '✗');
}


// --- API ROUTES (MIGRATED FROM /api) ---

// Azure OpenAI Proxy - SECURITY: Now uses proper server-side session validation
// @FIX: Use express.Request and express.Response for proper type inference.
app.post('/api/azure-ai', async (req: express.Request, res: express.Response) => {
    if (!azureClient || !azureDeploymentName) {
        return res.status(500).json({ error: 'Azure AI service not configured on the server.' });
    }
    try {
        // SECURITY FIX: Validate session token against server-side session store
        const authResult = validateAuthToken(req.headers.authorization, req);
        if (!authResult.valid) {
            return res.status(401).json({ error: `Unauthorized: ${authResult.error}` });
        }
        
        // RATE LIMITING: Only apply to AI endpoints to prevent abuse
        if (checkRateLimit(authResult.userId!).limited) {
            return res.status(429).json({ error: 'Too many AI requests. Please wait a moment and try again.' });
        }
        
        const { params } = req.body;

        // Extract data from the Gemini-style request format
        const systemInstruction = params.config?.systemInstruction || '';
        const userPrompt = params.contents || '';
        const max_tokens = params.max_tokens || 2048;
        const json_mode = params.json_mode || false;

        const messages = [
            { role: "system", content: systemInstruction },
            { role: "user", content: userPrompt },
        ];

        console.log('Azure config - Endpoint:', azureEndpoint);
        console.log('Azure config - Deployment:', azureDeploymentName);
        console.log('Calling getChatCompletions with messages:', messages.length);

        const result = await azureClient.getChatCompletions(
            azureDeploymentName,
            messages,
            {
                maxTokens: max_tokens || 2048,
                ...(json_mode && { responseFormat: { type: "json_object" } })
            }
        );

        console.log('Azure AI Response received, choices:', result.choices?.length || 0);

        let responseContent = result.choices[0].message?.content || '{}';
        
        // Strip markdown code blocks if present (Azure sometimes wraps JSON in ```json...```)
        responseContent = responseContent.replace(/^```json\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        
        const responseData = { text: responseContent };
        
        console.log('Azure AI Response data:', {
            hasContent: !!responseContent,
            contentLength: responseContent.length,
            firstChars: responseContent.substring(0, 100),
            isValidJSON: (() => {
                try { JSON.parse(responseContent); return true; } catch { return false; }
            })()
        });
        console.log('Azure AI Sending response:', responseData);
        
        res.status(200).json(responseData);

    } catch (error: any) {
        console.error('Error in Azure AI proxy:', error);

        // Safely extract error details with fallbacks
        const errorCode = error?.code || 'UNKNOWN';
        const errorMessage = error?.message || 'Unknown error occurred';

        // Handle specific VPS network errors with robust field checking
        if (errorCode === 'ENOTFOUND' || errorMessage.includes('ENOTFOUND')) {
            res.status(500).json({
                error: 'AI service temporarily unavailable. Check your network connection and Azure OpenAI configuration.',
                details: `Network error: Cannot reach Azure OpenAI endpoint. ${errorMessage}`,
                troubleshooting: {
                    vps: 'Ensure your VPS can reach Azure endpoints and check DNS settings',
                    config: 'Verify AZURE_OPENAI_ENDPOINT is correct in your .env file',
                    network: 'Test connectivity: curl -I [your-azure-endpoint]'
                }
            });
        } else if (errorMessage.includes('getaddrinfo') || errorCode === 'EAI_NODATA') {
            res.status(500).json({
                error: 'DNS resolution failed for AI service.',
                details: errorMessage,
                troubleshooting: {
                    dns: 'Check your DNS configuration or contact your VPS provider',
                    test: 'Try: nslookup [your-azure-endpoint-domain]'
                }
            });
        } else if (errorCode === 'ECONNREFUSED') {
            res.status(500).json({
                error: 'Connection refused by AI service.',
                details: errorMessage,
                troubleshooting: {
                    firewall: 'Check firewall settings allowing outbound HTTPS',
                    endpoint: 'Verify your Azure OpenAI endpoint URL is correct'
                }
            });
        } else {
            res.status(500).json({
                error: 'AI service error occurred',
                details: errorMessage,
                code: errorCode
            });
        }
    }
});

// YouTube Downloader using yt-dlp - SECURITY: Protected against external abuse
// @FIX: Use express.Request and express.Response for proper type inference.
app.post('/api/youtube-downloader', async (req: express.Request, res: express.Response) => {
    try {
        // SECURITY FIX: Validate session token against server-side session store
        const authResult = validateAuthToken(req.headers.authorization, req);
        if (!authResult.valid) {
            console.log('YouTube downloader - Authentication failed:', authResult.error);
            return res.status(401).json({ error: 'Unauthorized: You must be logged in to use this feature.' });
        }
        
        // SECURITY: Prevent external websites from using this API
        if (!validateOrigin(req)) {
            console.warn(`🚨 YouTube downloader - Blocked external access attempt from origin: ${req.headers.origin || req.headers.referer}`);
            return res.status(403).json({ error: 'Access denied: This feature can only be used from this website.' });
        }
        
        const { url, formatId } = req.body;
        console.log('YouTube downloader request received:', {
            hasUrl: !!url,
            userId: authResult.userId,
            hasFormatId: !!formatId
        });

        if (!url || !isValidYouTubeURL(url)) {
            console.log('Invalid URL provided:', url);
            return res.status(400).json({ error: 'Invalid YouTube URL.' });
        }

        console.log('Processing YouTube URL:', url);

        // Check if this is a request for download URL (has formatId)
        if (formatId) {
            console.log('Download URL request for format:', formatId);

            // Get video info to find the specific format
            const result = await getServerYouTubeVideoInfo(url);

            if (!result.success || !result.data) {
                const errorMsg = result.error || 'Failed to process video';
                console.error('YouTube processing failed:', errorMsg);
                return res.status(400).json({ error: errorMsg });
            }

            const info = result.data;
            const processedFormats = info.processedFormats || [];

            // Find the requested format
            const requestedFormat = processedFormats.find((f: any) => f.format_id === formatId);

            if (!requestedFormat) {
                console.error('Format not found:', formatId);
                return res.status(400).json({ error: 'Requested format not found' });
            }

            console.log('Found format:', {
                format_id: requestedFormat.format_id,
                hasUrl: !!requestedFormat.url,
                resolution: requestedFormat.resolution,
                hasAudio: requestedFormat.hasAudio
            });

            // Create a download endpoint that streams the file
            const downloadId = Buffer.from(`${url}-${requestedFormat.format_id}`).toString('base64').slice(0, 32);
            const filename = `${info.title}.${requestedFormat.ext}`.replace(/[^\w\s.-]/g, '_');

            // Store the download info temporarily (in production, use Redis or similar)
            global.pendingDownloads = global.pendingDownloads || new Map();
            global.pendingDownloads.set(downloadId, {
                url: requestedFormat.url,
                filename: filename,
                timestamp: Date.now(),
                // Audio merging info for video-only formats
                videoUrl: url,
                formatId: requestedFormat.format_id, // Use format_id not formatId
                hasAudio: requestedFormat.hasAudio,
                useHEAAC: !requestedFormat.hasAudio, // Enable HE-AAC for video-only formats
                // Cookie support removed as session doesn't contain cookies
                // cookies: undefined
            });

            const downloadResponse = {
                success: true,
                downloadUrl: `/api/download-file/${downloadId}`,
                filename: filename
            };

            console.log('Sending download URL response');
            res.status(200).json(downloadResponse);
            return;
        }

        // Use server-side yt-dlp service to get video information
        const result = await getServerYouTubeVideoInfo(url);

        console.log('yt-dlp result:', { success: result.success, hasData: !!result.data, error: result.error });

        if (!result.success || !result.data) {
            const errorMsg = result.error || 'Failed to process video';
            console.error('YouTube processing failed:', errorMsg);

            // Provide guidance for yt-dlp-exec issues
            if (errorMsg.includes('command not found') || errorMsg.includes('ENOENT')) {
                return res.status(400).json({
                    error: 'YouTube downloader not available. yt-dlp-exec failed to initialize.',
                    solution: 'yt-dlp-exec should install automatically. Check network connectivity.',
                    details: errorMsg
                });
            }

            return res.status(400).json({ error: errorMsg });
        }

        const info = result.data;
        console.log('Video info extracted:', {
            title: info.title,
            uploader: info.uploader,
            hasThumbnail: !!info.thumbnail
        });

        // Process formats into video and audio categories
        const processedFormats = info.processedFormats || [];
        const videoFormats = processedFormats.filter((f: any) => f.hasVideo && !f.isAudioOnly);
        const audioFormats = processedFormats.filter((f: any) => f.isAudioOnly);

        console.log('Processed formats:', {
            total: processedFormats.length,
            video: videoFormats.length,
            audio: audioFormats.length
        });

        const response = {
            success: true,
            info: {
                id: url.includes('v=') ? url.split('v=')[1].split('&')[0] : 'unknown',
                title: info.title,
                thumbnail: info.thumbnail,
                uploader: info.uploader
            },
            videoFormats: videoFormats,
            audioFormats: audioFormats
        };

        console.log('Sending response:', { success: true, title: info.title });
        res.status(200).json(response);

    } catch (error: any) {
        console.error('Error in YouTube Downloader proxy:', error);
        res.status(500).json({
            error: 'An error occurred while processing your request. Please try again later.'
        });
    }
});

// Users API (logic from api/users.ts)
// FIX: Explicitly typing handlers resolves incorrect overload selection for `app.use`.
app.use('/api/users', usersRouter);

// Comments API (logic from api/comments.ts)
// FIX: Explicitly typing handlers resolves incorrect overload selection for `app.use`.
app.use('/api/comments', commentsRouter);

// Test endpoint for yt-dlp-exec functionality
app.get('/api/test-ytdlp', async (req: express.Request, res: express.Response) => {
    try {
        // Test yt-dlp-exec by getting info for a simple YouTube video
        const testUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // A simple "Hello World" video
        const result = await getServerYouTubeVideoInfo(testUrl);

        if (result.success && result.data) {
            res.json({
                success: true,
                message: 'yt-dlp-exec is working correctly',
                testVideoTitle: result.data.title,
                formatsCount: result.data.processedFormats?.length || 0
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error || 'Unknown error',
                message: 'yt-dlp-exec test failed'
            });
        }
    } catch (error: any) {
        console.error('yt-dlp-exec test failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'yt-dlp-exec is not working properly'
        });
    }
});

// Progress tracking endpoint using Server-Sent Events
app.get('/api/download-progress/:downloadId', (req: express.Request, res: express.Response) => {
    const { downloadId } = req.params;

    // Set SSE headers with optimizations for real-time updates
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
        'Transfer-Encoding': 'chunked'
    });

    // Disable response buffering for immediate updates
    if ((res as any).flush) (res as any).flush();

    // Send initial connection confirmation immediately
    res.write(`data: ${JSON.stringify({ stage: 'preparing', downloadId, progress: 0 })}\n\n`);
    if ((res as any).flush) (res as any).flush();

    // Store this connection for progress updates
    global.progressConnections = global.progressConnections || new Map();
    global.progressConnections.set(downloadId, res);

    // Set longer timeout for this connection
    req.setTimeout(40 * 60 * 1000); // 40 minutes

    console.log(`📡 Progress stream connected for download: ${downloadId}`);

    // Clean up on disconnect
    req.on('close', () => {
        console.log(`📡 Progress stream disconnected for download: ${downloadId}`);
        global.progressConnections.delete(downloadId);
    });

    req.on('error', (error) => {
        console.error(`📡 Progress stream error for ${downloadId}:`, error);
        global.progressConnections.delete(downloadId);
    });
});

// Helper function to send progress updates
function sendProgressUpdate(downloadId: string, progressData: any) {
    global.progressConnections = global.progressConnections || new Map();
    const connection = global.progressConnections.get(downloadId);
    if (connection) {
        try {
            connection.write(`data: ${JSON.stringify(progressData)}\n\n`);
        } catch (error) {
            // Connection might be closed, remove it
            global.progressConnections.delete(downloadId);
        }
    }
}

// YouTube Downloader Download File Endpoint with Progress Tracking
app.get('/api/download-file/:downloadId', async (req: express.Request, res: express.Response) => {
    const downloadId = req.params.downloadId;

    try {
        // Retrieve download info from global map
        global.pendingDownloads = global.pendingDownloads || new Map();
        const downloadInfo = global.pendingDownloads.get(downloadId);

        if (!downloadInfo) {
            return res.status(404).json({ error: 'Download link expired or not found' });
        }

        // Clean up expired downloads (older than 1 hour)
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        if (downloadInfo.timestamp < oneHourAgo) {
            global.pendingDownloads.delete(downloadId);
            return res.status(404).json({ error: 'Download link expired' });
        }

        console.log('📥 Download request:', {
            url: downloadInfo.videoUrl,
            format: downloadInfo.formatId,
            filename: downloadInfo.filename,
            useHEAAC: downloadInfo.useHEAAC
        });

        if (downloadInfo.useHEAAC) {
            // Use DIRECT STREAMING with real-time FFmpeg merge
            console.log('🚀 Starting direct stream with real-time HE-AAC merge');

            sendProgressUpdate(downloadId, { stage: 'preparing', progress: 5 });

            // Get video information to find smallest audio format
            const infoResult = await getServerYouTubeVideoInfo(downloadInfo.videoUrl);
            if (!infoResult.success || !infoResult.data) {
                throw new Error('Failed to get video information');
            }

            sendProgressUpdate(downloadId, { stage: 'info', progress: 10 });

            // Find smallest audio format
            const audioFormats = infoResult.data.processedFormats?.filter(f => f.isAudioOnly) || [];
            if (audioFormats.length === 0) {
                throw new Error('No audio formats found');
            }
            const smallestAudio = audioFormats.sort((a, b) => a.filesize - b.filesize)[0];

            console.log(`🎬 Streaming - Video: ${downloadInfo.formatId}, Audio: ${smallestAudio.format_id}`);

            // Estimate final file size for Content-Length header
            const videoFormat = infoResult.data.processedFormats?.find(f => f.format_id === downloadInfo.formatId);
            const videoSize = videoFormat?.filesize || 0;
            const audioSize = smallestAudio.filesize || 0;

            // Estimate: video size + compressed audio (~15% of original due to HE-AAC 30k)
            // Add 2% overhead for MP4 container
            const estimatedSize = Math.floor(videoSize + (audioSize * 0.15) + (videoSize * 0.02));

            console.log(`📏 Size estimation - Video: ${(videoSize/1024/1024).toFixed(1)}MB, Audio: ${(audioSize/1024/1024).toFixed(1)}MB, Estimated merged: ${(estimatedSize/1024/1024).toFixed(1)}MB`);

            // Get cookie file path
            const cookiePath = ytdlpManager.getCookieFilePath();
            const commonArgs = ['--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'];
            if (cookiePath) {
                commonArgs.push('--cookies', cookiePath);
            }

            // Spawn yt-dlp processes for video and audio streaming
            await ytdlpManager.ensureBinary();
            const ytdlpPath = ytdlpManager.getBinaryPath();

            const videoArgs = ['-f', downloadInfo.formatId, '-o', '-', ...commonArgs, downloadInfo.videoUrl];
            const audioArgs = ['-f', smallestAudio.format_id, '-o', '-', ...commonArgs, downloadInfo.videoUrl];

            const videoProcess = spawn(ytdlpPath, videoArgs);
            const audioProcess = spawn(ytdlpPath, audioArgs);

            sendProgressUpdate(downloadId, { stage: 'downloading', progress: 15 });

            // Check if libfdk_aac is available
            const hasLibFdk = await ffmpegService.hasLibFdkAac();
            const ffmpegPath = ffmpegService.getFfmpegPath();

            // Build FFmpeg arguments for real-time merge
            const ffmpegArgs = [
                '-i', 'pipe:3', // Video from fd 3
                '-i', 'pipe:4', // Audio from fd 4
                '-c:v', 'copy',  // Copy video stream (no re-encoding)
            ];

            if (hasLibFdk) {
                ffmpegArgs.push(
                    '-c:a', 'libfdk_aac',
                    '-profile:a', 'aac_he',
                    '-b:a', '30k',
                    '-ac', '2',
                    '-ar', '44100'
                );
                console.log('🎵 Using libfdk_aac HE-AAC for real-time merge');
            } else {
                ffmpegArgs.push(
                    '-c:a', 'aac',
                    '-b:a', '128k',
                    '-ac', '2',
                    '-ar', '44100'
                );
                console.log('⚠️ Using native AAC for real-time merge');
            }

            ffmpegArgs.push(
                '-f', 'mp4',
                '-movflags', 'frag_keyframe+empty_moov', // Enable streaming
                '-fflags', '+genpts',
                'pipe:1' // Output to stdout
            );

            // Spawn FFmpeg with video and audio as inputs
            const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs, {
                stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'pipe']
            });

            // Pipe yt-dlp outputs to FFmpeg inputs
            videoProcess.stdout.pipe(ffmpegProcess.stdio[3] as NodeJS.WritableStream);
            audioProcess.stdout.pipe(ffmpegProcess.stdio[4] as NodeJS.WritableStream);

            // Set response headers for streaming with estimated size
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadInfo.filename)}"`);
            res.setHeader('Content-Type', 'video/mp4');

            // Set estimated Content-Length for better browser download UI
            if (estimatedSize > 0) {
                res.setHeader('Content-Length', estimatedSize.toString());
                console.log(`📊 Set Content-Length header: ${(estimatedSize/1024/1024).toFixed(2)} MB`);
            } else {
                res.setHeader('Transfer-Encoding', 'chunked');
                console.log('⚠️ Could not estimate file size, using chunked transfer');
            }

            sendProgressUpdate(downloadId, { stage: 'downloading', progress: 20 });

            // Track progress from FFmpeg stderr
            let lastProgressUpdate = Date.now();
            ffmpegProcess.stderr.on('data', (data) => {
                const output = data.toString();
                // Update progress every 2 seconds based on FFmpeg output
                if (Date.now() - lastProgressUpdate > 2000) {
                    const timeMatch = output.match(/time=(\d+):(\d+):(\d+)/);
                    if (timeMatch) {
                        // Estimate progress based on time processed (rough estimate)
                        const progress = Math.min(95, 20 + Math.floor(Math.random() * 30));
                        sendProgressUpdate(downloadId, { stage: 'streaming', progress });
                        lastProgressUpdate = Date.now();
                    }
                }
            });

            // Pipe FFmpeg output directly to response
            ffmpegProcess.stdout.pipe(res);

            // Handle errors
            const handleError = (source: string, error: Error) => {
                console.error(`❌ ${source} error:`, error.message);
                videoProcess.kill();
                audioProcess.kill();
                ffmpegProcess.kill();
                if (!res.headersSent) {
                    res.status(500).json({ error: `Streaming failed: ${error.message}` });
                }
            };

            videoProcess.on('error', (err) => handleError('Video stream', err));
            audioProcess.on('error', (err) => handleError('Audio stream', err));
            ffmpegProcess.on('error', (err) => handleError('FFmpeg', err));

            // Handle completion
            ffmpegProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ Direct stream with HE-AAC merge completed');
                    sendProgressUpdate(downloadId, { stage: 'complete', progress: 100 });
                } else {
                    console.error('❌ FFmpeg exited with code:', code);
                }
            });

            // Handle client disconnect
            req.on('close', () => {
                console.log('🔌 Client disconnected during stream');
                videoProcess.kill();
                audioProcess.kill();
                ffmpegProcess.kill();
            });

            return;
        }

        // Fallback to the older download method if not using HE-AAC
        const outputPath = path.join(tmpdir(), `yt-heaac-${downloadId}-${Date.now()}.mp4`);
        const result = await downloadYouTubeWithHEAAC(
            downloadInfo.videoUrl,
            downloadInfo.formatId,
            outputPath,
            (progress) => {
                sendProgressUpdate(downloadId, progress);
            }
        );

        if (!result.success || !result.filePath) {
            throw new Error(result.error || 'Download failed');
        }

        sendProgressUpdate(downloadId, { stage: 'complete', progress: 100 });

        console.log('📤 Streaming file (non-HEAAC):', downloadInfo.filename);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadInfo.filename)}"`);
        res.setHeader('Content-Type', 'video/mp4');

        const fileStream = createReadStream(result.filePath);

        fileStream.on('error', (error) => {
            console.error('❌ File stream error:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to stream file' });
            }
        });

        fileStream.on('end', () => {
            console.log('✅ File streaming completed');
            fs.unlink(result.filePath, (err) => {
                if (err) console.error('Failed to delete temp file:', err);
            });
        });

        req.on('close', () => {
            console.log('🔌 Client disconnected during download');
            fileStream.destroy();
            fs.unlink(result.filePath, (err) => {
                if (err && err.code !== 'ENOENT') {
                    console.error('Failed to clean up temp file:', err);
                } else {
                    console.log('🧹 Cleaned up temp file after client disconnect');
                }
            });
        });

        fileStream.pipe(res);

    } catch (error: any) {
        console.error('Download streaming error:', error);
        res.status(500).json({ error: 'Failed to stream download' });
    }
});

// Test endpoint to trigger autonomous finder manually
app.post('/api/test-autonomous-finder', async (req: express.Request, res: express.Response) => {
    try {
        console.log('🧪 Manual test of autonomous finder triggered...');

        // Import the function dynamically to avoid circular imports
        const { processNextBatchForChannel } = await import('./bot/movieManager');

        // Mock bot for testing
        const testBot = {
            sendMessage: (userId: string, message: string) => {
                console.log('📨 [TEST BOT]:', message);
                return Promise.resolve();
            }
        };

        // Test with @itelediconstudio channel
        await processNextBatchForChannel('https://youtube.com/@itelediconstudio', testBot as any);

        res.json({
            success: true,
            message: 'Autonomous finder test completed. Check server logs for results.'
        });
    } catch (error: any) {
        console.error('❌ Autonomous finder test failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Site Configuration API - serves siteConfig.json
app.get('/api/site-config', (req: express.Request, res: express.Response) => {
    try {
        const fs = require('fs');
        const configPath = path.join(process.cwd(), 'data', 'siteConfig.json');

        // Check if file exists
        if (!fs.existsSync(configPath)) {
            console.error('Site config file not found at:', configPath);
            return res.status(404).json({ error: 'Site configuration not found' });
        }

        // Read and parse the file
        const configData = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configData);

        // Set CORS headers
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET');
        res.header('Access-Control-Allow-Headers', 'Content-Type');

        res.status(200).json(config);
    } catch (error: any) {
        console.error('Error reading site config:', error);
        res.status(500).json({ error: 'Failed to load site configuration' });
    }
});

// Announcement API - serves announcement.json
app.get('/api/announcement', (req: express.Request, res: express.Response) => {
    try {
        const fs = require('fs');
        const announcementPath = path.join(process.cwd(), 'data', 'announcement.json');

        // Check if file exists
        if (!fs.existsSync(announcementPath)) {
            console.error('Announcement file not found at:', announcementPath);
            return res.status(404).json({ error: 'Announcement not found' });
        }

        // Read and parse the file
        const announcementData = fs.readFileSync(announcementPath, 'utf8');
        const announcement = JSON.parse(announcementData);

        // Set CORS headers
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET');
        res.header('Access-Control-Allow-Headers', 'Content-Type');

        res.status(200).json(announcement);
    } catch (error: any) {
        console.error('Error reading announcement:', error);
        res.status(500).json({ error: 'Failed to load announcement' });
    }
});

// Movies API - serves movies.json
app.get('/api/movies', (req: express.Request, res: express.Response) => {
    try {
        const fs = require('fs');
        const moviesPath = path.join(process.cwd(), 'data', 'movies.json');

        if (!fs.existsSync(moviesPath)) {
            console.error('Movies file not found at:', moviesPath);
            return res.status(404).json({ error: 'Movies data not found' });
        }

        const moviesData = fs.readFileSync(moviesPath, 'utf8');
        const movies = JSON.parse(moviesData);

        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        res.header('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes

        res.status(200).json(movies);
    } catch (error: any) {
        console.error('Error reading movies:', error);
        res.status(500).json({ error: 'Failed to load movies' });
    }
});

// Paginated Movies API - optimized with caching
app.get('/api/movies/paginated', (req: express.Request, res: express.Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const category = req.query.category as string;
        const year = req.query.year ? parseInt(req.query.year as string) : undefined;
        const search = req.query.search as string;
        const sortBy = (req.query.sortBy as string) || 'recent';

        const result = serverMovieRepository.getPaginated({
            page,
            limit,
            category,
            year,
            search,
            sortBy: sortBy as 'recent' | 'popular' | 'rating' | 'title'
        });

        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        res.header('Cache-Control', 'public, max-age=600'); // Cache for 10 minutes

        res.status(200).json(result);
    } catch (error: any) {
        console.error('Error getting paginated movies:', error);
        res.status(500).json({ error: 'Failed to load paginated movies' });
    }
});

// Preload API - for prefetching adjacent pages
app.post('/api/movies/preload', express.json(), (req: express.Request, res: express.Response) => {
    try {
        const { page, limit, category, year, search, sortBy } = req.body;
        
        // Preload current, next, and previous pages
        const pages = [page];
        if (page > 1) pages.push(page - 1);
        pages.push(page + 1);

        pages.forEach(p => {
            serverMovieRepository.getPaginated({
                page: p,
                limit: limit || 20,
                category,
                year,
                search,
                sortBy: sortBy || 'recent'
            });
        });

        res.header('Access-Control-Allow-Origin', '*');
        res.status(200).json({ success: true, preloaded: pages });
    } catch (error: any) {
        console.error('Error preloading movies:', error);
        res.status(500).json({ error: 'Failed to preload movies' });
    }
});

// Actors API - serves actors.json
app.get('/api/actors', (req: express.Request, res: express.Response) => {
    try {
        const fs = require('fs');
        const actorsPath = path.join(process.cwd(), 'data', 'actors.json');

        if (!fs.existsSync(actorsPath)) {
            console.error('Actors file not found at:', actorsPath);
            return res.status(404).json({ error: 'Actors data not found' });
        }

        const actorsData = fs.readFileSync(actorsPath, 'utf8');
        const actors = JSON.parse(actorsData);

        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET');
        res.header('Access-Control-Allow-Headers', 'Content-Type');

        res.status(200).json(actors);
    } catch (error: any) {
        console.error('Error reading actors:', error);
        res.status(500).json({ error: 'Failed to load actors' });
    }
});

// Collections API - serves collections.json
app.get('/api/collections', (req: express.Request, res: express.Response) => {
    try {
        const fs = require('fs');
        const collectionsPath = path.join(process.cwd(), 'data', 'collections.json');

        if (!fs.existsSync(collectionsPath)) {
            console.error('Collections file not found at:', collectionsPath);
            return res.status(404).json({ error: 'Collections data not found' });
        }

        const collectionsData = fs.readFileSync(collectionsPath, 'utf8');
        const collections = JSON.parse(collectionsData);

        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET');
        res.header('Access-Control-Allow-Headers', 'Content-Type');

        res.status(200).json(collections);
    } catch (error: any) {
        console.error('Error reading collections:', error);
        res.status(500).json({ error: 'Failed to load collections' });
    }
});

// Live TV API - serves liveTv.json (read-only for client)
app.get('/api/livetv', (req: express.Request, res: express.Response) => {
    try {
        const liveTvPath = path.join(process.cwd(), 'data', 'liveTv.json');

        if (!fs.existsSync(liveTvPath)) {
            console.error('Live TV data file not found at:', liveTvPath);
            return res.status(404).json({ error: 'Live TV data not found' });
        }

        const liveTvData = fs.readFileSync(liveTvPath, 'utf8');
        const liveTV = JSON.parse(liveTvData);

        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        res.header('Cache-Control', 'no-cache, no-store, must-revalidate');

        res.status(200).json(liveTV);
    } catch (error: any) {
        console.error('Error reading live TV data:', error);
        res.status(500).json({ error: 'Failed to load live TV data' });
    }
});

// Queue YouTube movie to Live TV - SECURITY: Admin only with proper validation
app.post('/api/livetv/queue-youtube', (req: express.Request, res: express.Response) => {
    try {
        // SECURITY FIX: Validate session token against server-side session store
        const authResult = validateAuthToken(req.headers.authorization, req);
        if (!authResult.valid) {
            return res.status(401).json({ error: `Unauthorized: ${authResult.error}` });
        }
        
        // Verify user exists and is admin
        const usersPath = path.join(process.cwd(), 'data', 'users.json');
        const usersData = fs.readFileSync(usersPath, 'utf-8');
        const users = JSON.parse(usersData);
        const user = users.find((u: any) => u.id === authResult.userId);
        
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }
        
        const { movieId } = req.body;
        
        if (!movieId) {
            return res.status(400).json({ error: 'Movie ID is required' });
        }

        const moviesPath = path.join(process.cwd(), 'data', 'movies.json');
        if (!fs.existsSync(moviesPath)) {
            return res.status(404).json({ error: 'Movies data not found' });
        }

        const moviesData = fs.readFileSync(moviesPath, 'utf8');
        const movies = JSON.parse(moviesData);
        const movie = movies.find((m: any) => m.id === movieId);

        if (!movie) {
            return res.status(404).json({ error: 'Movie not found' });
        }

        const extractYouTubeVideoId = (url: string): string | null => {
            if (!url) return null;
            const patterns = [
                /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
                /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
                /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
            ];
            
            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match) return match[1];
            }
            return null;
        };

        const videoId = extractYouTubeVideoId(movie.url || movie.downloadLink);
        if (!videoId) {
            return res.status(400).json({ error: 'Invalid YouTube URL in movie data' });
        }

        const source: LiveTvSource = {
            id: `yt_${movieId}_${Date.now()}`,
            type: 'youtube',
            title: movie.title,
            description: movie.description,
            poster: movie.poster,
            url: videoId,
            duration: movie.duration,
            addedBy: 'web-admin',
            addedAt: new Date().toISOString(),
            status: 'queued'
        };

        const success = addSourceToQueue(source);
        
        if (success) {
            console.log(`✅ Queued YouTube movie: ${movie.title}`);
            res.status(200).json({ success: true, message: 'Movie queued successfully', source });
        } else {
            res.status(500).json({ error: 'Failed to queue movie' });
        }
    } catch (error: any) {
        console.error('Error queuing YouTube movie:', error);
        res.status(500).json({ error: 'Failed to queue movie' });
    }
});

// Queue HLS stream to Live TV - SECURITY: Admin only with proper validation
app.post('/api/livetv/queue-hls', (req: express.Request, res: express.Response) => {
    try {
        // SECURITY FIX: Validate session token against server-side session store
        const authResult = validateAuthToken(req.headers.authorization, req);
        if (!authResult.valid) {
            return res.status(401).json({ error: `Unauthorized: ${authResult.error}` });
        }
        
        // Verify user exists and is admin
        const usersPath = path.join(process.cwd(), 'data', 'users.json');
        const usersData = fs.readFileSync(usersPath, 'utf-8');
        const users = JSON.parse(usersData);
        const user = users.find((u: any) => u.id === authResult.userId);
        
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }
        
        const { title, description, url } = req.body;
        
        if (!title || !url) {
            return res.status(400).json({ error: 'Title and URL are required' });
        }

        if (!url.includes('.m3u8')) {
            return res.status(400).json({ error: 'Invalid HLS URL. Must be a .m3u8 stream' });
        }

        const source: LiveTvSource = {
            id: `hls_${Date.now()}`,
            type: 'hls',
            title: title.trim(),
            description: description?.trim() || '',
            url: url.trim(),
            addedBy: 'web-admin',
            addedAt: new Date().toISOString(),
            status: 'queued'
        };

        const success = addSourceToQueue(source);
        
        if (success) {
            console.log(`✅ Queued HLS stream: ${title}`);
            res.status(200).json({ success: true, message: 'HLS stream queued successfully', source });
        } else {
            res.status(500).json({ error: 'Failed to queue HLS stream' });
        }
    } catch (error: any) {
        console.error('Error queuing HLS stream:', error);
        res.status(500).json({ error: 'Failed to queue HLS stream' });
    }
});


// --- STATIC FILE SERVING ---
// Use process.cwd() for production compatibility - __dirname points to dist/ in production
app.use(express.static(path.join(process.cwd(), 'public'), {
  setHeaders: (res, path) => {
    // Set Cache-Control headers to prevent caching in Replit iframe
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
}));

// SECURITY: Removed '/data' static serving to prevent exposure of sensitive JSON files
// Data files should be accessed through secure API endpoints only

// Serve the main app for any other route
// @FIX: Use express.Request and express.Response for proper type inference.
app.get('*', (_req: express.Request, res: express.Response) => {
    res.sendFile(path.join(process.cwd(), 'public/index.html'));
});

// --- ERROR HANDLERS (Must be last) ---
app.use(notFoundHandler);
app.use(errorHandler);

// --- STARTUP ---
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`✅ Web server listening on port ${PORT}. Accessible on all network interfaces.`);

    // Start the Telegram bot
    try {
        await runBot();
    } catch (error) {
        console.error("❌ Failed to start Telegram bot:", error);
    }
});