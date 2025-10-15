import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import path from 'path';
import fs from 'fs';

const ALGORITHM = 'aes-256-gcm';

if (!process.env.SESSION_ENCRYPTION_KEY) {
    console.error('❌ CRITICAL: SESSION_ENCRYPTION_KEY environment variable is not set!');
    console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"');
    process.exit(1);
}

const ENCRYPTION_KEY_SOURCE = process.env.SESSION_ENCRYPTION_KEY;

const deriveKey = (): Buffer => {
    return scryptSync(ENCRYPTION_KEY_SOURCE, 'session-salt', 32);
};

export interface EncryptedData {
    encrypted: string;
    iv: string;
    authTag: string;
}

export function encryptData(plaintext: string): EncryptedData {
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

export function decryptData(encryptedData: EncryptedData): string {
    const key = deriveKey();
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
        
        try {
            decryptData(fileData);
            console.log('✅ SESSION_ENCRYPTION_KEY validation successful - key is correct!');
        } catch (decryptError: any) {
            console.error('❌ CRITICAL SECURITY ERROR: SESSION_ENCRYPTION_KEY is INCORRECT!');
            console.error('❌ Cannot decrypt existing sessions with provided key');
            console.error('❌ This would cause all users to be logged out and lose their sessions');
            console.error('');
            console.error('🔑 You must provide the CORRECT SESSION_ENCRYPTION_KEY that was used to encrypt the sessions');
            console.error('');
            console.error('Decryption error details:', decryptError.message);
            console.error('');
            console.error('If you have lost the encryption key:');
            console.error('1. Delete the data/sessions.json file (WARNING: This will log out all users)');
            console.error('2. Generate a new key: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"');
            console.error('3. Set the new key as SESSION_ENCRYPTION_KEY');
            console.error('');
            process.exit(1);
        }
    } catch (error: any) {
        console.error('❌ Error reading sessions file for validation:', error.message);
        console.error('Continuing startup - file may be corrupted');
    }
}

validateEncryptionKey();
