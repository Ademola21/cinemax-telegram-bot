import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import path from 'path';
import fs from 'fs';

const ALGORITHM = 'aes-256-gcm';

const getEncryptionKey = (): string | null => {
    return process.env.SESSION_ENCRYPTION_KEY || null;
};

const ENCRYPTION_KEY_SOURCE = getEncryptionKey();

const deriveKey = (): Buffer | null => {
    const keySource = getEncryptionKey();
    if (!keySource) {
        return null;
    }
    return scryptSync(keySource, 'session-salt', 32);
};

export interface EncryptedData {
    encrypted: string;
    iv: string;
    authTag: string;
}

export function encryptData(plaintext: string): EncryptedData | null {
    const key = deriveKey();
    if (!key) return null;
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

export function decryptData(encryptedData: EncryptedData): string | null {
    const key = deriveKey();
    if (!key) return null;
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');
    
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}

/**
 * CRITICAL SECURITY: Validate that SESSION_ENCRYPTION_KEY is correct
 * This prevents the server from starting with an incorrect encryption key
 * which would cause all existing sessions to be inaccessible
 */
function validateEncryptionKey(): void {
    const keySource = getEncryptionKey();
    if (!keySource) {
        console.warn('⚠️ SESSION_ENCRYPTION_KEY is not set. Sessions will not be encrypted.');
        return;
    }
    const SESSIONS_PATH = path.join(process.cwd(), 'data', 'sessions.json');
    
    if (!fs.existsSync(SESSIONS_PATH)) {
        console.log('✅ No existing sessions file - encryption key validation skipped');
        return;
    }
    
    try {
        const content = fs.readFileSync(SESSIONS_PATH, 'utf-8');
        const fileData = JSON.parse(content);
        
        if (!fileData.encrypted || !fileData.iv || !fileData.authTag) {
            console.log('✅ Legacy unencrypted sessions file - encryption key validation skipped');
            return;
        }
        
        console.log('🔐 Validating SESSION_ENCRYPTION_KEY by testing decryption...');
        
        if (decryptData(fileData) === null) {
            console.error('❌ CRITICAL SECURITY ERROR: SESSION_ENCRYPTION_KEY is INCORRECT!');
            console.error('❌ Cannot decrypt existing sessions with provided key');
            console.error('🔑 You must provide the CORRECT SESSION_ENCRYPTION_KEY that was used to encrypt the sessions');
            process.exit(1);
        } else {
            console.log('✅ SESSION_ENCRYPTION_KEY validation successful - key is correct!');
        }
    } catch (error: any) {
        console.error('❌ Error reading sessions file for validation:', error.message);
        console.error('Continuing startup - file may be corrupted');
    }
}

validateEncryptionKey();
