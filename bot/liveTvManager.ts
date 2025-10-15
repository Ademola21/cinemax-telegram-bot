import TelegramBot from 'node-telegram-bot-api';
import * as fs from 'fs';
import * as path from 'path';
import { setUserState, getUserState, clearUserState } from './utils';
import { 
    readLiveTvData, 
    writeLiveTvData, 
    addSourceToQueue, 
    goLive, 
    stopBroadcast, 
    skipToNext, 
    setDefaultSource,
    removeSource,
    clearQueue,
    LiveTvSource,
    LiveTvData
} from '../services/liveTvService';

const MOVIES_PATH = path.join(process.cwd(), 'data', 'movies.json');

interface Movie {
    id: string;
    title: string;
    description?: string;
    poster?: string;
    url: string;
    duration?: number;
}

const readMovies = (): Movie[] => {
    try {
        if (!fs.existsSync(MOVIES_PATH)) return [];
        const data = fs.readFileSync(MOVIES_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading movies:', error);
        return [];
    }
};

const extractYouTubeVideoId = (url: string): string | null => {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
};

// --- MAIN LIVE TV MENU ---
export const showLiveTvMenu = (bot: TelegramBot, chatId: number, messageId?: number) => {
    const data = readLiveTvData();
    const currentStream = data.currentStreamId 
        ? data.sources.find(s => s.id === data.currentStreamId) 
        : null;
    
    const statusText = data.isLive 
        ? `🔴 *LIVE*\n*Now Playing:* ${currentStream?.title || 'Unknown'}\n*Type:* ${currentStream?.type?.toUpperCase() || 'N/A'}\n*Queue:* ${data.queue.length} source(s)`
        : `⚫ *OFFLINE*\n*Queue:* ${data.queue.length} source(s)\n*Sources:* ${data.sources.length} total`;

    const keyboard = [
        [
            { text: data.isLive ? "⏹️ Stop Broadcast" : "▶️ Go Live", callback_data: data.isLive ? "livetv_stop" : "livetv_golive" }
        ],
        [
            { text: "➕ Queue YouTube Movie", callback_data: "livetv_queue_youtube" },
            { text: "➕ Queue HLS URL", callback_data: "livetv_queue_hls" }
        ],
        [
            { text: "⏭️ Skip to Next", callback_data: "livetv_skip" },
            { text: "📋 View Queue", callback_data: "livetv_view_queue" }
        ],
        [
            { text: "🌟 Set Default Source", callback_data: "livetv_set_default" },
            { text: "🗑️ Manage Sources", callback_data: "livetv_manage_sources" }
        ],
        [
            { text: "🗑️ Clear Queue", callback_data: "livetv_clear_queue" },
            { text: "⬅️ Back to Main Menu", callback_data: "main_menu" }
        ]
    ];

    const messageText = `📺 *Live TV Control Panel*\n\n${statusText}`;

    if (messageId) {
        bot.editMessageText(messageText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });
    } else {
        bot.sendMessage(chatId, messageText, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });
    }
};

// --- GO LIVE ---
export const handleGoLive = (bot: TelegramBot, chatId: number, messageId: number) => {
    const stream = goLive();
    
    if (stream) {
        bot.editMessageText(
            `🔴 *LIVE!*\n\n*Now Playing:* ${stream.title}\n*Type:* ${stream.type.toUpperCase()}\n*URL:* ${stream.url.substring(0, 50)}...`,
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "⏹️ Stop Broadcast", callback_data: "livetv_stop" }],
                        [{ text: "⏭️ Skip to Next", callback_data: "livetv_skip" }],
                        [{ text: "⬅️ Back to Menu", callback_data: "manage_livetv" }]
                    ]
                }
            }
        );
    } else {
        bot.editMessageText(
            "❌ No sources available!\n\nPlease add sources to the queue first.",
            {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [[{ text: "⬅️ Back to Menu", callback_data: "manage_livetv" }]]
                }
            }
        );
    }
};

// --- STOP BROADCAST ---
export const handleStopBroadcast = (bot: TelegramBot, chatId: number, messageId: number) => {
    const success = stopBroadcast();
    
    if (success) {
        bot.editMessageText(
            "⏹️ *Broadcast Stopped*\n\nLive TV is now offline.",
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: "⬅️ Back to Menu", callback_data: "manage_livetv" }]]
                }
            }
        );
    }
};

// --- SKIP TO NEXT ---
export const handleSkipToNext = (bot: TelegramBot, chatId: number, messageId: number) => {
    const nextStream = skipToNext();
    
    if (nextStream) {
        bot.editMessageText(
            `⏭️ *Skipped to Next!*\n\n*Now Playing:* ${nextStream.title}\n*Type:* ${nextStream.type.toUpperCase()}`,
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: "⬅️ Back to Menu", callback_data: "manage_livetv" }]]
                }
            }
        );
    } else {
        bot.editMessageText(
            "❌ Queue is empty!\n\nNo more sources to play.",
            {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [[{ text: "⬅️ Back to Menu", callback_data: "manage_livetv" }]]
                }
            }
        );
    }
};

// --- QUEUE YOUTUBE MOVIE ---
export const startQueueYouTube = (bot: TelegramBot, chatId: number) => {
    const movies = readMovies();
    
    if (movies.length === 0) {
        bot.sendMessage(chatId, "No movies available in the catalog.", {
            reply_markup: {
                inline_keyboard: [[{ text: "⬅️ Back", callback_data: "manage_livetv" }]]
            }
        });
        return;
    }

    const keyboard = movies.slice(0, 20).map(m => ([
        { text: m.title, callback_data: `livetv_add_youtube_${m.id}` }
    ]));
    keyboard.push([{ text: "⬅️ Back", callback_data: "manage_livetv" }]);

    bot.sendMessage(chatId, "📺 Select a movie to queue for Live TV:", {
        reply_markup: { inline_keyboard: keyboard }
    });
};

export const handleAddYouTubeMovie = (bot: TelegramBot, query: TelegramBot.CallbackQuery) => {
    const movieId = query.data?.replace('livetv_add_youtube_', '');
    const movies = readMovies();
    const movie = movies.find(m => m.id === movieId);
    
    if (!movie) {
        bot.answerCallbackQuery(query.id, { text: "Movie not found!" });
        return;
    }

    const videoId = extractYouTubeVideoId(movie.url);
    if (!videoId) {
        bot.answerCallbackQuery(query.id, { text: "Invalid YouTube URL!" });
        return;
    }

    const source: LiveTvSource = {
        id: `yt_${movieId}_${Date.now()}`,
        type: 'youtube',
        title: movie.title,
        description: movie.description,
        poster: movie.poster,
        url: videoId,
        duration: movie.duration,
        addedBy: 'admin',
        addedAt: new Date().toISOString(),
        status: 'queued'
    };

    const success = addSourceToQueue(source);
    
    if (success) {
        bot.answerCallbackQuery(query.id, { text: `✅ ${movie.title} added to queue!` });
        bot.editMessageText(
            `✅ *Added to Queue*\n\n*Title:* ${movie.title}\n*Type:* YouTube\n*Video ID:* ${videoId}`,
            {
                chat_id: query.message!.chat.id,
                message_id: query.message!.message_id,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: "⬅️ Back to Menu", callback_data: "manage_livetv" }]]
                }
            }
        );
    } else {
        bot.answerCallbackQuery(query.id, { text: "Failed to add to queue!" });
    }
};

// --- QUEUE HLS URL ---
export const startQueueHLS = (bot: TelegramBot, chatId: number) => {
    setUserState(chatId, { command: 'livetv_add_hls' });
    bot.sendMessage(chatId, 
        "📺 *Queue HLS Stream*\n\n" +
        "Send me the details in this format:\n\n" +
        "`Title | Description | HLS URL`\n\n" +
        "Example:\n" +
        "`Demo Stream | Test HLS Stream | https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`",
        { parse_mode: 'Markdown' }
    );
};

export const handleAddHLSResponse = (bot: TelegramBot, msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (!text) return;

    const parts = text.split('|').map(p => p.trim());
    
    if (parts.length < 3) {
        bot.sendMessage(chatId, "❌ Invalid format! Please use: `Title | Description | HLS URL`", { parse_mode: 'Markdown' });
        return;
    }

    const [title, description, url] = parts;

    if (!url.includes('.m3u8') && !url.includes('.mpd')) {
        bot.sendMessage(chatId, "❌ Invalid URL! Must be an HLS (.m3u8) or DASH (.mpd) stream.");
        return;
    }

    const source: LiveTvSource = {
        id: `hls_${Date.now()}`,
        type: 'hls',
        title,
        description,
        url,
        addedBy: 'admin',
        addedAt: new Date().toISOString(),
        status: 'queued'
    };

    const success = addSourceToQueue(source);
    
    if (success) {
        bot.sendMessage(chatId, 
            `✅ *HLS Stream Added to Queue*\n\n*Title:* ${title}\n*Description:* ${description}\n*URL:* ${url.substring(0, 50)}...`,
            { 
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: "⬅️ Back to Menu", callback_data: "manage_livetv" }]]
                }
            }
        );
    } else {
        bot.sendMessage(chatId, "❌ Failed to add stream to queue!");
    }
    
    clearUserState(chatId);
};

// --- VIEW QUEUE ---
export const showQueue = (bot: TelegramBot, chatId: number, messageId: number) => {
    const data = readLiveTvData();
    
    if (data.queue.length === 0) {
        bot.editMessageText(
            "📋 *Queue is Empty*\n\nNo sources queued for streaming.",
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: "⬅️ Back to Menu", callback_data: "manage_livetv" }]]
                }
            }
        );
        return;
    }

    const queueText = data.queue.map((s, i) => 
        `${i + 1}. *${s.title}* (${s.type.toUpperCase()})\n   Added: ${new Date(s.addedAt || '').toLocaleString()}`
    ).join('\n\n');

    bot.editMessageText(
        `📋 *Queue (${data.queue.length} source${data.queue.length > 1 ? 's' : ''})*\n\n${queueText}`,
        {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: "⬅️ Back to Menu", callback_data: "manage_livetv" }]]
            }
        }
    );
};

// --- SET DEFAULT SOURCE ---
export const startSetDefaultSource = (bot: TelegramBot, chatId: number, messageId: number) => {
    const data = readLiveTvData();
    
    if (data.sources.length === 0) {
        bot.editMessageText(
            "❌ No sources available!\n\nAdd sources first.",
            {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [[{ text: "⬅️ Back to Menu", callback_data: "manage_livetv" }]]
                }
            }
        );
        return;
    }

    const keyboard = data.sources.map(s => ([
        { 
            text: `${s.title} ${s.id === data.defaultSourceId ? '⭐' : ''}`, 
            callback_data: `livetv_setdefault_${s.id}` 
        }
    ]));
    keyboard.push([{ text: "⬅️ Back", callback_data: "manage_livetv" }]);

    bot.editMessageText(
        "🌟 *Set Default Source*\n\nSelect a source to set as default:",
        {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        }
    );
};

export const handleSetDefaultSource = (bot: TelegramBot, query: TelegramBot.CallbackQuery) => {
    const sourceId = query.data?.replace('livetv_setdefault_', '');
    
    if (!sourceId) return;

    const success = setDefaultSource(sourceId);
    
    if (success) {
        const data = readLiveTvData();
        const source = data.sources.find(s => s.id === sourceId);
        
        bot.answerCallbackQuery(query.id, { text: `✅ Default source set!` });
        bot.editMessageText(
            `🌟 *Default Source Set*\n\n*Title:* ${source?.title}\n*Type:* ${source?.type.toUpperCase()}`,
            {
                chat_id: query.message!.chat.id,
                message_id: query.message!.message_id,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: "⬅️ Back to Menu", callback_data: "manage_livetv" }]]
                }
            }
        );
    } else {
        bot.answerCallbackQuery(query.id, { text: "Failed to set default source!" });
    }
};

// --- MANAGE SOURCES ---
export const showManageSources = (bot: TelegramBot, chatId: number, messageId: number) => {
    const data = readLiveTvData();
    
    if (data.sources.length === 0) {
        bot.editMessageText(
            "❌ No sources available!",
            {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [[{ text: "⬅️ Back to Menu", callback_data: "manage_livetv" }]]
                }
            }
        );
        return;
    }

    const keyboard = data.sources.map(s => ([
        { 
            text: `🗑️ ${s.title} (${s.type})`, 
            callback_data: `livetv_remove_${s.id}` 
        }
    ]));
    keyboard.push([{ text: "⬅️ Back", callback_data: "manage_livetv" }]);

    bot.editMessageText(
        "🗑️ *Manage Sources*\n\nSelect a source to remove:",
        {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        }
    );
};

export const handleRemoveSource = (bot: TelegramBot, query: TelegramBot.CallbackQuery) => {
    const sourceId = query.data?.replace('livetv_remove_', '');
    
    if (!sourceId) return;

    const data = readLiveTvData();
    const source = data.sources.find(s => s.id === sourceId);
    
    const success = removeSource(sourceId);
    
    if (success) {
        bot.answerCallbackQuery(query.id, { text: `✅ Source removed!` });
        bot.editMessageText(
            `🗑️ *Source Removed*\n\n*Title:* ${source?.title}`,
            {
                chat_id: query.message!.chat.id,
                message_id: query.message!.message_id,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: "⬅️ Back to Menu", callback_data: "manage_livetv" }]]
                }
            }
        );
    } else {
        bot.answerCallbackQuery(query.id, { text: "Failed to remove source!" });
    }
};

// --- CLEAR QUEUE ---
export const handleClearQueue = (bot: TelegramBot, chatId: number, messageId: number) => {
    const success = clearQueue();
    
    if (success) {
        bot.editMessageText(
            "🗑️ *Queue Cleared*\n\nAll queued sources have been removed.",
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: "⬅️ Back to Menu", callback_data: "manage_livetv" }]]
                }
            }
        );
    }
};
