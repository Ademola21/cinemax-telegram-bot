import path from 'path';
import fs from 'fs';
import { randomBytes } from 'crypto';
import { atomicWrite } from './utils';
import { encryptData, decryptData } from './encryption';

const SESSIONS_PATH = path.join(process.cwd(), 'data', 'sessions.json');
const SESSION_DURATION = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

interface Session {
    userId: string;
    createdAt: number;
    expiresAt: number;
    lastActivity: number;
    ipAddress?: string;
    userAgent?: string;
}

interface SessionStore {
    [sessionId: string]: Session;
}

/**
 * Read sessions from the sessions.json file with decryption
 */
const readSessions = (): SessionStore => {
    try {
        if (!fs.existsSync(SESSIONS_PATH)) {
            console.log('📁 Sessions file not found, creating new one');
            return {};
        }
        const content = fs.readFileSync(SESSIONS_PATH, 'utf-8');
        const fileData = JSON.parse(content);
        
        if (!fileData.encrypted || !fileData.iv || !fileData.authTag) {
            console.log('📁 Legacy unencrypted session file detected, returning empty store');
            return {};
        }
        
        const decrypted = decryptData(fileData);
        return JSON.parse(decrypted);
    } catch (error) {
        console.error('📁 Error reading sessions file:', error);
        return {};
    }
};

/**
 * Write sessions to the sessions.json file atomically with encryption
 */
const writeSessions = (sessions: SessionStore): void => {
    const plaintext = JSON.stringify(sessions);
    const encrypted = encryptData(plaintext);
    atomicWrite(SESSIONS_PATH, JSON.stringify(encrypted, null, 2));
};

/**
 * Generate a cryptographically secure random session token
 * Uses 32 bytes (256 bits) of entropy, base64url encoded
 */
export const generateSessionToken = (): string => {
    return randomBytes(32).toString('base64url');
};

/**
 * Create a new session for a user with device binding
 * Automatically cleans up any expired sessions for the user before creating new one
 * @param userId - The user ID
 * @param ipAddress - Optional IP address for session binding
 * @param userAgent - Optional user agent for session binding
 */
export const createSession = (userId: string, ipAddress?: string, userAgent?: string): string => {
    const sessions = readSessions();
    
    // Clean up expired sessions for this user
    cleanupExpiredSessionsForUser(sessions, userId);
    
    const sessionToken = generateSessionToken();
    const now = Date.now();
    
    sessions[sessionToken] = {
        userId,
        createdAt: now,
        expiresAt: now + SESSION_DURATION,
        lastActivity: now,
        ipAddress,
        userAgent
    };
    
    writeSessions(sessions);
    console.log(`✅ Created new session for user ${userId} from IP: ${ipAddress || 'unknown'}`);
    
    return sessionToken;
};

/**
 * Get a session by token with secure validation
 * Returns null if session doesn't exist or is expired
 * Uses constant-time comparison to prevent timing attacks
 */
export const getSession = (sessionToken: string): Session | null => {
    if (!sessionToken || typeof sessionToken !== 'string') {
        return null;
    }
    
    const sessions = readSessions();
    
    // Use constant-time comparison to find matching session
    // This prevents timing attacks that could reveal valid session tokens
    let foundSession: Session | null = null;
    let foundToken: string | null = null;
    
    for (const [storedToken, session] of Object.entries(sessions)) {
        if (constantTimeCompare(sessionToken, storedToken)) {
            foundSession = session;
            foundToken = storedToken;
            break;
        }
    }
    
    if (!foundSession || !foundToken) {
        return null;
    }
    
    // Check if session is expired
    if (foundSession.expiresAt <= Date.now()) {
        console.log(`⏰ Session expired for user ${foundSession.userId}`);
        deleteSession(foundToken);
        return null;
    }
    
    return foundSession;
};

/**
 * Update the last activity timestamp for a session
 * Optionally extends expiration (rolling session)
 */
export const touchSession = (sessionToken: string, extendExpiry: boolean = false): boolean => {
    const sessions = readSessions();
    const session = sessions[sessionToken];
    
    if (!session) {
        return false;
    }
    
    const now = Date.now();
    session.lastActivity = now;
    
    if (extendExpiry) {
        session.expiresAt = now + SESSION_DURATION;
    }
    
    writeSessions(sessions);
    return true;
};

/**
 * Delete a specific session
 */
export const deleteSession = (sessionToken: string): void => {
    const sessions = readSessions();
    
    if (sessions[sessionToken]) {
        delete sessions[sessionToken];
        writeSessions(sessions);
        console.log(`🗑️ Deleted session: ${sessionToken.substring(0, 10)}...`);
    }
};

/**
 * Delete all sessions for a specific user
 * Useful for logout all devices or account security
 */
export const deleteAllUserSessions = (userId: string): void => {
    const sessions = readSessions();
    const initialCount = Object.keys(sessions).length;
    
    Object.keys(sessions).forEach(token => {
        if (sessions[token].userId === userId) {
            delete sessions[token];
        }
    });
    
    writeSessions(sessions);
    const deletedCount = initialCount - Object.keys(sessions).length;
    console.log(`🗑️ Deleted ${deletedCount} session(s) for user ${userId}`);
};

/**
 * Clean up expired sessions for a specific user
 */
const cleanupExpiredSessionsForUser = (sessions: SessionStore, userId: string): void => {
    const now = Date.now();
    let cleaned = 0;
    
    Object.keys(sessions).forEach(token => {
        if (sessions[token].userId === userId && sessions[token].expiresAt <= now) {
            delete sessions[token];
            cleaned++;
        }
    });
    
    if (cleaned > 0) {
        console.log(`🧹 Cleaned up ${cleaned} expired session(s) for user ${userId}`);
    }
};

/**
 * Clean up all expired sessions
 * Should be called periodically or on each mutation for amortized maintenance
 */
export const cleanupExpiredSessions = (): void => {
    const sessions = readSessions();
    const now = Date.now();
    let cleaned = 0;
    
    Object.keys(sessions).forEach(token => {
        if (sessions[token].expiresAt <= now) {
            delete sessions[token];
            cleaned++;
        }
    });
    
    if (cleaned > 0) {
        writeSessions(sessions);
        console.log(`🧹 Cleaned up ${cleaned} expired session(s)`);
    }
};

/**
 * Constant-time string comparison to prevent timing attacks
 * Compares two strings character by character
 */
export const constantTimeCompare = (a: string, b: string): boolean => {
    if (a.length !== b.length) {
        return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
};

/**
 * Validate session binding to detect session hijacking
 * Compares current IP and user-agent with session metadata
 * @param session - The session to validate
 * @param currentIp - Current request IP address
 * @param currentUserAgent - Current request user agent
 * @returns true if binding is valid or not enforced, false if mismatch detected
 */
export const validateSessionBinding = (
    session: Session,
    currentIp?: string,
    currentUserAgent?: string
): boolean => {
    // If session has IP binding, validate it
    if (session.ipAddress && currentIp) {
        if (session.ipAddress !== currentIp) {
            console.warn(`⚠️ Session IP mismatch: expected ${session.ipAddress}, got ${currentIp}`);
            return false;
        }
    }
    
    // If session has user-agent binding, validate it
    if (session.userAgent && currentUserAgent) {
        if (session.userAgent !== currentUserAgent) {
            console.warn(`⚠️ Session user-agent mismatch`);
            return false;
        }
    }
    
    return true;
};
