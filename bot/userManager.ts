// FIX: Declare '__dirname' to resolve TypeScript error about missing Node.js type definitions.
declare const __dirname: string;

import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { User } from './types';
import { setUserState, getUserState, clearUserState } from './utils';

const USERS_PATH = path.join(process.cwd(), 'data', 'users.json');

const readUsers = (): User[] => {
    try {
        if (!fs.existsSync(USERS_PATH)) return [];
        const data = fs.readFileSync(USERS_PATH, 'utf-8');
        return JSON.parse(data);
    } catch { return []; }
};

export const startUserLookup = (bot: TelegramBot, chatId: number) => {
    setUserState(chatId, { command: 'user_lookup_email' });
    bot.sendMessage(chatId, "Enter the email address of the user you want to look up:");
};

export const handleUserLookupResponse = (bot: TelegramBot, msg: TelegramBot.Message) => {
    const userId = msg.from!.id;
    const email = msg.text;
    if (!email) return;

    const users = readUsers();
    const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (foundUser) {
        const userDetails = `*User Found*\n\n` +
                            `*ID:* \`${foundUser.id}\`\n` +
                            `*Name:* ${foundUser.name}\n` +
                            `*Email:* ${foundUser.email}\n` +
                            `*Role:* ${foundUser.role || 'user'}`;
        bot.sendMessage(userId, userDetails, { 
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "Set as Admin", callback_data: `set_role_admin_${foundUser.id}` },
                        { text: "Set as Moderator", callback_data: `set_role_moderator_${foundUser.id}` }
                    ],
                    [{ text: "Set as User", callback_data: `set_role_user_${foundUser.id}` }]
                ]
            }
        });
    } else {
        bot.sendMessage(userId, `No user found with the email: ${email}`);
    }

    clearUserState(userId);
};

export const handleSetUserRole = (bot: TelegramBot, query: TelegramBot.CallbackQuery) => {
    const data = query.data;
    if (!data || !data.startsWith('set_role_')) return;

    const parts = data.split('_');
    const role = parts[2]; // admin, moderator, or user
    const targetUserId = parts.slice(3).join('_');

    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === targetUserId);

    if (userIndex === -1) {
        bot.answerCallbackQuery(query.id, { text: "User not found." });
        return;
    }

    users[userIndex].role = role;
    
    const USERS_PATH = path.join(process.cwd(), 'data', 'users.json');
    fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf-8');

    const roleLabel = role === 'admin' ? 'Admin' : role === 'moderator' ? 'Moderator' : 'User';
    bot.answerCallbackQuery(query.id, { text: `✅ User role updated to ${roleLabel}` });
    bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
        chat_id: query.message!.chat.id,
        message_id: query.message!.message_id
    });
    bot.sendMessage(query.message!.chat.id, `✅ User role updated to *${roleLabel}*`, { parse_mode: 'Markdown' });
};
