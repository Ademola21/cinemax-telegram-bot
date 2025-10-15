// FIX: Declare '__dirname' to resolve TypeScript error about missing Node.js type definitions.
declare const __dirname: string;

import TelegramBot from 'node-telegram-bot-api';
import { getAnalyticsSummary } from './analyticsService';
import { setUserState, clearUserState } from './utils';
import fs from 'fs';
import path from 'path';
import { Movie, Actor } from './types';
import { atomicWrite } from './utils';
import CinemaxAIService from '../src/ai/services/CinemaxAIService';

const MOVIES_PATH = path.join(process.cwd(), 'data', 'movies.json');
const ACTORS_PATH = path.join(process.cwd(), 'data', 'actors.json');

// --- Cinemax AI Setup ---
const cinemaxAI = CinemaxAIService.getInstance();
console.log('🤖 Telegram Bot AI initialized with Cinemax AI');

const readMovies = (): Movie[] => {
    try {
        const data = fs.readFileSync(MOVIES_PATH, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
};

const readActors = (): Actor[] => {
    try {
        const data = fs.readFileSync(ACTORS_PATH, 'utf-8');
        return JSON.parse(data);
    } catch { return []; }
};
const writeActors = (actors: Actor[]) => atomicWrite(ACTORS_PATH, JSON.stringify(actors, null, 2));

const endChatKeyboard = {
    inline_keyboard: [[{ text: "🔚 End Chat", callback_data: "ai_end_chat" }]]
};

export const startAiChat = (bot: TelegramBot, chatId: number) => {
    setUserState(chatId, { command: 'ai_chat' });
    bot.sendMessage(chatId, "🤖 You are now chatting with Cinemax AI! I'm your intelligent assistant for Yorubacinemax. Ask me about:\n\n🎬 Site activity and analytics\n🎥 Movie recommendations and catalog\n📈 Performance insights\n🎭 Cultural context about Yoruba cinema\n\nFor example:\n- 'How is the site doing today?'\n- 'What movies are similar to Anikulapo?'\n- 'Give me some insights about our users'", {
        reply_markup: endChatKeyboard
    });
};

export const endAiChat = (bot: TelegramBot, chatId: number, messageId: number) => {
    clearUserState(chatId);
    bot.editMessageText("🤖 Cinemax AI chat session ended. I've learned from our conversation and I'm ready to help again anytime!", {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [] } // Remove the button
    });
};

export const handleAiQuery = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const query = msg.text;

    if (!query) return;

    await bot.sendChatAction(chatId, 'typing');

    try {
        let days = 1;
        if (query.toLowerCase().includes('last week')) days = 7;
        if (query.toLowerCase().includes('last month')) days = 30;

        const analytics = getAnalyticsSummary(days);
        const movies = readMovies();
        
        // Build context for Cinemax AI
        const context = {
            analyticsData: analytics,
            movies: movies,
            movieContext: movies.map(m => `Title: ${m.title}, Genre: ${m.genre}, Category: ${m.category}`).join('\n'),
            timeFrame: days,
            platform: 'telegram',
            isAdmin: true
        };

        console.log(`🤖 Telegram Bot AI processing: "${query}"`);

        // Use Cinemax AI for the response
        const responseText = await cinemaxAI.handleTelegramQuery(query, {
            ...context,
            movies: movies as any // Cast to any to resolve type differences
        });
        
        bot.sendMessage(chatId, responseText, { reply_markup: endChatKeyboard });

    } catch (error) {
        console.error("❌ Telegram Bot AI Error:", error);
        bot.sendMessage(chatId, "Sorry, I'm having trouble thinking right now. Please try again later.", { reply_markup: endChatKeyboard });
    }
};

export const suggestNewMovies = async (bot: TelegramBot, chatId: number) => {
    await bot.sendChatAction(chatId, 'typing');
    try {
        const currentMovies = readMovies();
        
        console.log('💡 Telegram Bot generating movie suggestions...');

        const responseText = await cinemaxAI.suggestNewMovies(currentMovies as any);

        bot.sendMessage(chatId, `🧠 *Cinemax AI Suggestions:*\n\n${responseText}`, { parse_mode: 'Markdown' });

    } catch(e) {
        bot.sendMessage(chatId, "Could not fetch suggestions at this time.");
        console.error(e);
    }
};

export const getWeeklyDigest = async (bot: TelegramBot) => {
    const adminId = process.env.ADMIN_TELEGRAM_USER_ID;
    if (!adminId) {
        console.log("Weekly Digest skipped: No Admin ID.");
        return;
    }

    console.log("📊 Generating weekly digest with Cinemax AI...");
    await bot.sendChatAction(parseInt(adminId, 10), 'typing');
    try {
        const analytics = getAnalyticsSummary(7);
        
        const responseText = await cinemaxAI.generateWeeklyReport(analytics);

        const reportHeader = "📊 *Your Weekly Performance Report - Powered by Cinemax AI* 📊\n\n";
        bot.sendMessage(adminId, reportHeader + responseText, { parse_mode: 'Markdown' });

    } catch (e) {
        console.error("❌ Failed to generate weekly digest:", e);
        bot.sendMessage(adminId, "Sorry, I couldn't generate the weekly report this time.");
    }
};

export const generateActorProfile = async (actorName: string): Promise<Partial<Actor> | null> => {
    try {
        console.log(`🎭 Generating actor profile for: ${actorName}`);

        const profile = await cinemaxAI.generateActorProfile(actorName);

        return profile;
    } catch (error) {
        console.error(`❌ Cinemax AI failed to generate profile for ${actorName}:`, error);
        return null;
    }
};

// Additional Cinemax AI enhanced features for Telegram bot

export const getAiInsights = async (bot: TelegramBot, chatId: number, insightType: string) => {
    await bot.sendChatAction(chatId, 'typing');
    try {
        const analytics = getAnalyticsSummary(7);
        const movies = readMovies();
        
        let query = '';
        switch (insightType) {
            case 'users':
                query = 'Give me insights about user behavior and engagement patterns';
                break;
            case 'movies':
                query = 'Analyze movie popularity trends and viewing patterns';
                break;
            case 'performance':
                query = 'Provide overall site performance analysis and recommendations';
                break;
            default:
                query = 'Give me general insights about the platform';
        }

        const context = {
            analyticsData: analytics,
            movies: movies,
            insightType: insightType,
            platform: 'telegram',
            isAdmin: true
        };

        const responseText = await cinemaxAI.handleTelegramQuery(query, context);
        
        bot.sendMessage(chatId, `🧠 *Cinemax AI Insights - ${insightType}:*\n\n${responseText}`, { parse_mode: 'Markdown' });

    } catch (error) {
        console.error("❌ AI Insights Error:", error);
        bot.sendMessage(chatId, "Sorry, I couldn't generate insights right now.");
    }
};

export const getCreativeContent = async (bot: TelegramBot, chatId: number, contentType: string) => {
    await bot.sendChatAction(chatId, 'typing');
    try {
        const movies = readMovies();
        
        const responseText = await cinemaxAI.generateCreativeContent(
            `Yoruba cinema and ${contentType}`,
            contentType
        );
        
        bot.sendMessage(chatId, `🎨 *Cinemax AI Creative Content:*\n\n${responseText}`, { parse_mode: 'Markdown' });

    } catch (error) {
        console.error("❌ Creative Content Error:", error);
        bot.sendMessage(chatId, "Sorry, I couldn't create content right now.");
    }
};

export const getMovieRecommendations = async (bot: TelegramBot, chatId: number, preference?: string) => {
    await bot.sendChatAction(chatId, 'typing');
    try {
        const movies = readMovies();
        
        let query = 'Recommend some great Yoruba movies';
        if (preference) {
            query += ` that would appeal to someone who likes ${preference}`;
        }

        const context = {
            movies: movies,
            preference: preference,
            platform: 'telegram',
            isAdmin: true
        };

        const responseText = await cinemaxAI.handleTelegramQuery(query, context);
        
        bot.sendMessage(chatId, `🎬 *Cinemax AI Recommendations:*\n\n${responseText}`, { parse_mode: 'Markdown' });

    } catch (error) {
        console.error("❌ Movie Recommendations Error:", error);
        bot.sendMessage(chatId, "Sorry, I couldn't generate recommendations right now.");
    }
};