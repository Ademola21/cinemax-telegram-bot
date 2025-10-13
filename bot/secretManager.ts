// bot/secretManager.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import path from 'path';
import fs from 'fs';
import { atomicWrite, setUserState, getUserState, clearUserState } from './utils';

const ALGORITHM = 'aes-256-gcm';
const SECRETS_PATH = path.join(process.cwd(), 'data', 'secrets.json');

if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN is not set. Secret management will be disabled.');
}

const deriveKey = (): Buffer => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        throw new Error('TELEGRAM_BOT_TOKEN is not available for key derivation.');
    }
    return scryptSync(token, 'secret-salt', 32);
};

interface EncryptedData {
    encrypted: string;
    iv: string;
    authTag: string;
}

function encryptSecrets(plaintext: string): EncryptedData {
    const key = deriveKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    return {
        encrypted,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64')
    };
}

function decryptSecrets(encryptedData: EncryptedData): string {
    const key = deriveKey();
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

const readSecrets = (): Record<string, string> => {
    if (!process.env.TELEGRAM_BOT_TOKEN) return {};
    try {
        if (!fs.existsSync(SECRETS_PATH)) {
            return {};
        }
        const content = fs.readFileSync(SECRETS_PATH, 'utf-8');
        const fileData = JSON.parse(content);
        if (!fileData.encrypted) return {}; // Unencrypted or empty
        const decrypted = decryptSecrets(fileData);
        return JSON.parse(decrypted);
    } catch (error) {
        console.error('Error reading secrets file:', error);
        return {};
    }
};

const writeSecrets = (secrets: Record<string, string>): void => {
    if (!process.env.TELEGRAM_BOT_TOKEN) return;
    const plaintext = JSON.stringify(secrets);
    const encrypted = encryptSecrets(plaintext);
    atomicWrite(SECRETS_PATH, JSON.stringify(encrypted, null, 2));
};

export const getSecret = (key: string): string | undefined => {
    const secrets = readSecrets();
    return secrets[key];
};

export const setSecret = (key: string, value: string): void => {
    const secrets = readSecrets();
    secrets[key] = value;
    writeSecrets(secrets);
};

export const deleteSecret = (key: string): void => {
    const secrets = readSecrets();
    delete secrets[key];
    writeSecrets(secrets);
};

export const listSecrets = (): string[] => {
    const secrets = readSecrets();
    return Object.keys(secrets);
};

export const isFullyConfigured = (): boolean => {
    const sessionKey = getSecret('SESSION_ENCRYPTION_KEY');
    const csrfSecret = getSecret('CSRF_SECRET');
    return !!sessionKey && !!csrfSecret;
};

export const showSecretsMenu = (bot: any, chatId: number, messageId: number) => {
    const secrets = listSecrets();
    const secretList = secrets.length > 0 ? secrets.join('\n') : 'No secrets set.';
    bot.editMessageText(`🔐 Manage Secrets\n\n${secretList}`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
            inline_keyboard: [
                [{ text: "➕ Add/Set Secret", callback_data: "secrets_add" }],
                [{ text: "🗑️ Delete Secret", callback_data: "secrets_delete" }],
                [{ text: "⬅️ Back to Main Menu", callback_data: "main_menu" }]
            ]
        }
    });
};

export const handleSecretsCallback = (bot: any, query: any) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data === 'secrets_add') {
        bot.sendMessage(chatId, 'Please send the secret in the format `KEY=VALUE`');
        setUserState(chatId, { command: 'secret_add' });
    } else if (data === 'secrets_delete') {
        bot.sendMessage(chatId, 'Please send the KEY of the secret to delete.');
        setUserState(chatId, { command: 'secret_delete' });
    }
};

export const handleSecretResponse = (bot: any, msg: any) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userState = getUserState(chatId);

    if (userState?.command === 'secret_add') {
        const parts = text.split('=');
        if (parts.length === 2) {
            const key = parts[0].trim();
            const value = parts[1].trim();
            setSecret(key, value);
            bot.sendMessage(chatId, `✅ Secret "${key}" has been set.`);
        } else {
            bot.sendMessage(chatId, '❌ Invalid format. Please use `KEY=VALUE`.');
        }
        clearUserState(chatId);
    } else if (userState?.command === 'secret_delete') {
        const key = text.trim();
        deleteSecret(key);
        bot.sendMessage(chatId, `✅ Secret "${key}" has been deleted.`);
        clearUserState(chatId);
    }
};
