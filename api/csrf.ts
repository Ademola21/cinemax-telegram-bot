import express from 'express';
import { randomBytes, createHmac } from 'crypto';

const getCsrfSecret = (): string | null => {
    return process.env.CSRF_SECRET || null;
};

export interface CsrfToken {
    token: string;
    createdAt: number;
}

export function generateCsrfToken(sessionToken: string): CsrfToken | null {
    const secret = getCsrfSecret();
    if (!secret) return null;
    const timestamp = Date.now().toString();
    const random = randomBytes(16).toString('base64url');
    
    const hmac = createHmac('sha256', secret)
        .update(`${sessionToken}:${timestamp}:${random}`)
        .digest('base64url');
    
    return {
        token: `${timestamp}.${random}.${hmac}`,
        createdAt: Date.now()
    };
}

export function validateCsrfToken(csrfToken: string, sessionToken: string): boolean {
    const secret = getCsrfSecret();
    if (!secret || !csrfToken || !sessionToken) {
        return false;
    }
    
    const parts = csrfToken.split('.');
    if (parts.length !== 3) {
        return false;
    }
    
    const [timestamp, random, receivedHmac] = parts;
    
    const tokenAge = Date.now() - parseInt(timestamp);
    const maxAge = 24 * 60 * 60 * 1000;
    if (tokenAge > maxAge || tokenAge < 0) {
        return false;
    }
    
    const expectedHmac = createHmac('sha256', secret)
        .update(`${sessionToken}:${timestamp}:${random}`)
        .digest('base64url');
    
    return constantTimeCompare(receivedHmac, expectedHmac);
}

function constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
}

const CSRF_EXEMPT_PATHS = [
    '/api/users/signup',
    '/api/users/login'
];

export function csrfProtection(req: express.Request, res: express.Response, next: express.NextFunction) {
    const secret = getCsrfSecret();
    if (!secret) {
        // If CSRF secret is not set, bypass protection but log a warning.
        // This allows the app to function for viewing content without security features.
        console.warn('⚠️ CSRF_SECRET is not set. CSRF protection is disabled.');
        return next();
    }
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        return next();
    }
    
    if (CSRF_EXEMPT_PATHS.some(path => req.path === path)) {
        return next();
    }
    
    const sessionToken = extractSessionToken(req);
    if (!sessionToken) {
        return res.status(401).json({ error: 'Unauthorized: No session token.' });
    }
    
    const csrfToken = req.headers['x-csrf-token'] as string;
    
    if (!csrfToken) {
        return res.status(403).json({ 
            error: 'CSRF token missing. Please include X-CSRF-Token header.' 
        });
    }
    
    if (!validateCsrfToken(csrfToken, sessionToken)) {
        console.warn('CSRF validation failed for session');
        return res.status(403).json({ 
            error: 'CSRF token invalid or expired.' 
        });
    }
    
    next();
}

function extractSessionToken(req: express.Request): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.substring(7);
}
