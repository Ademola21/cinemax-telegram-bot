
import express from 'express';
const router = express.Router();
import path from 'path';
import bcrypt from 'bcrypt';
import { atomicWrite, validateGmail } from './utils';
import fs from 'fs';
import { 
    createSession, 
    getSession, 
    deleteSession,
    deleteAllUserSessions,
    cleanupExpiredSessions,
    touchSession,
    validateSessionBinding
} from './sessionStore';
import { generateCsrfToken } from './csrf';

// --- DATABASE HELPERS ---
// Use process.cwd() for VPS compatibility instead of relative paths
const USERS_PATH = path.join(process.cwd(), 'data', 'users.json');
const WATCHLISTS_PATH = path.join(process.cwd(), 'data', 'watchlists.json');
const HISTORY_PATH = path.join(process.cwd(), 'data', 'viewingHistory.json');

const readJsonFile = (filePath: string, defaultValue: any) => {
    try {
        console.log(`📁 Reading file: ${filePath}`);
        if (!fs.existsSync(filePath)) {
            console.log(`📁 File not found: ${filePath}, using default value`);
            return defaultValue;
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        console.log(`📁 File content length: ${content.length}`);
        return JSON.parse(content);
    } catch (error) {
        console.error(`📁 Error reading file ${filePath}:`, error);
        return defaultValue; 
    }
};

const getUsers = () => readJsonFile(USERS_PATH, []);
const getWatchlists = () => readJsonFile(WATCHLISTS_PATH, {});
const getHistories = () => readJsonFile(HISTORY_PATH, {});

const saveUsers = (users: any) => atomicWrite(USERS_PATH, JSON.stringify(users, null, 2));
const saveWatchlists = (watchlists: any) => atomicWrite(WATCHLISTS_PATH, JSON.stringify(watchlists, null, 2));
const saveHistories = (histories: any) => atomicWrite(HISTORY_PATH, JSON.stringify(histories, null, 2));

// --- SECURITY & HELPERS ---
const SALT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
}

const sanitize = (str: string) => str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
function toPublicUser(user: any) { const { passwordHash, ...publicData } = user; return publicData; }

/**
 * Extract client IP address from request
 * Handles proxies and load balancers
 */
const getClientIp = (req: express.Request): string => {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || 'unknown';
};

/**
 * Extract user agent from request
 */
const getUserAgent = (req: express.Request): string => {
    return req.headers['user-agent'] || 'unknown';
};

/**
 * Secure authentication middleware using server-side session storage
 * SECURITY FIX: This replaces the vulnerable token-based auth that only validated user IDs
 * Now validates the entire session token against server-side session storage
 */
const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Clean up expired sessions periodically (amortized maintenance)
    cleanupExpiredSessions();
    
    // Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header.' });
    }
    
    const sessionToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!sessionToken) {
        return res.status(401).json({ error: 'Unauthorized: No session token provided.' });
    }
    
    // Validate session against server-side session store
    const session = getSession(sessionToken);
    
    if (!session) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired session.' });
    }
    
    // Validate session binding to detect session hijacking
    const clientIp = getClientIp(req);
    const clientUserAgent = getUserAgent(req);
    
    if (!validateSessionBinding(session, clientIp, clientUserAgent)) {
        // Session hijacking detected - revoke the session
        deleteSession(sessionToken);
        console.error(`🚨 Session hijacking detected for user ${session.userId}`);
        return res.status(401).json({ error: 'Unauthorized: Session security check failed.' });
    }
    
    // Verify the user still exists
    const user = getUsers().find((u: any) => u.id === session.userId);
    if (!user) {
        // User was deleted, clean up the session
        deleteSession(sessionToken);
        return res.status(401).json({ error: 'Unauthorized: User not found.' });
    }
    
    // Update session activity timestamp (rolling session with extended expiry)
    touchSession(sessionToken, true);
    
    // Attach user information to request for downstream handlers
    (req as any).userId = session.userId;
    (req as any).sessionToken = sessionToken;
    
    next();
};

// --- ROUTES ---

// Signup
// FIX: Changed type annotations to use express.Request and express.Response to resolve type conflicts.
// @FIX: Use express.Request and express.Response for proper type inference on request handlers.
router.post('/signup', async (req: express.Request, res: express.Response) => {
    const { name, email, password, username } = req.body;
    if (!name || !email || !password || !username) return res.status(400).json({ error: 'Missing required fields.' });

    if (!validateGmail(email)) {
        return res.status(400).json({ error: 'Please use a valid Gmail address without "." or "+" aliases.' });
    }

    const users = getUsers();
    if (users.some((u: any) => u.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ error: 'An account with this email already exists.' });
    if (users.some((u: any) => u.username.toLowerCase() === username.toLowerCase())) return res.status(409).json({ error: 'This username is already taken.' });
    
    const passwordHash = await hashPassword(password);
    const newUser = {
        id: `user_${Date.now()}`,
        name: sanitize(name), email, username: sanitize(username),
        passwordHash, role: 'user'
    };
    saveUsers([...users, newUser]);
    
    // Create secure server-side session with device binding
    const clientIp = getClientIp(req);
    const clientUserAgent = getUserAgent(req);
    const token = createSession(newUser.id, clientIp, clientUserAgent);
    const csrfToken = generateCsrfToken(token);
    
    res.status(201).json({ user: toPublicUser(newUser), token, csrfToken: csrfToken.token });
});

// Login with automatic password migration from SHA-256 to bcrypt
// FIX: Changed type annotations to use express.Request and express.Response to resolve type conflicts.
// @FIX: Use express.Request and express.Response for proper type inference on request handlers.
router.post('/login', async (req: express.Request, res: express.Response) => {
    try {
        const { email, password } = req.body;
        console.log(`🔐 Login attempt for email: ${email}`);
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }
        
        const users = getUsers();
        console.log(`🔐 Found ${users.length} users in database`);
        
        const userIndex = users.findIndex((u: any) => u.email.toLowerCase() === email.toLowerCase());
        if (userIndex === -1) {
            console.log(`🔐 User not found for email: ${email}`);
            return res.status(401).json({ error: 'Invalid email or password. Please try again.' });
        }
        
        const user = users[userIndex];
        console.log(`🔐 User found: ${user.username}, verifying password...`);
        
        let isPasswordValid = false;
        let needsMigration = false;
        
        const isSHA256Hash = /^[a-f0-9]{64}$/i.test(user.passwordHash);
        
        if (isSHA256Hash) {
            console.log(`🔐 Detected legacy SHA-256 password hash for user: ${email}`);
            const crypto = require('crypto');
            const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
            isPasswordValid = sha256Hash === user.passwordHash;
            needsMigration = isPasswordValid;
            console.log(`🔐 SHA-256 verification: ${isPasswordValid ? 'SUCCESS' : 'FAILED'}`);
        } else {
            isPasswordValid = await verifyPassword(password, user.passwordHash);
            console.log(`🔐 bcrypt verification: ${isPasswordValid ? 'SUCCESS' : 'FAILED'}`);
        }
        
        if (!isPasswordValid) {
            console.log(`🔐 Password mismatch for user: ${email}`);
            return res.status(401).json({ error: 'Invalid email or password. Please try again.' });
        }

        if (needsMigration) {
            console.log(`🔐 MIGRATING password from SHA-256 to bcrypt for user: ${email}`);
            users[userIndex].passwordHash = await hashPassword(password);
            saveUsers(users);
            console.log(`✅ Password migration complete for user: ${email}`);
        }

        console.log(`🔐 Login successful for user: ${email}`);
        
        // Create secure server-side session with device binding
        const clientIp = getClientIp(req);
        const clientUserAgent = getUserAgent(req);
        const token = createSession(user.id, clientIp, clientUserAgent);
        const csrfToken = generateCsrfToken(token);
        
        res.status(200).json({ user: toPublicUser(users[userIndex]), token, csrfToken: csrfToken.token });
    } catch (error) {
        console.error('🔐 Login error:', error);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

// Logout - Revoke current session
router.post('/logout', authMiddleware, (req: express.Request, res: express.Response) => {
    const sessionToken = (req as any).sessionToken;
    deleteSession(sessionToken);
    console.log(`🔒 User logged out: ${(req as any).userId}`);
    res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

// Logout from all devices - Revoke all user sessions
router.post('/logout-all', authMiddleware, (req: express.Request, res: express.Response) => {
    const userId = (req as any).userId;
    deleteAllUserSessions(userId);
    console.log(`🔒 User logged out from all devices: ${userId}`);
    res.status(200).json({ success: true, message: 'Logged out from all devices.' });
});

// Get User Data (Watchlist & History)
// @FIX: Use express.Request and express.Response for proper type inference on request handlers.
router.get('/data', authMiddleware, (req: express.Request, res: express.Response) => {
    const watchlist = getWatchlists()[(req as any).userId] || [];
    const history = getHistories()[(req as any).userId] || [];
    res.status(200).json({ watchlist, history });
});

// Update Profile
// FIX: Changed type annotations to use express.Request and express.Response to resolve type conflicts.
// @FIX: Use express.Request and express.Response for proper type inference on request handlers.
router.put('/profile', authMiddleware, (req: express.Request, res: express.Response) => {
    const updates = req.body;
    const users = getUsers();
    const userIndex = users.findIndex((u: any) => u.id === (req as any).userId);
    if (userIndex === -1) return res.status(404).json({ error: 'User not found.' });

    if (updates.name) users[userIndex].name = sanitize(updates.name);
    if (updates.username) {
        if (users.some((u: any) => u.id !== (req as any).userId && u.username.toLowerCase() === updates.username.toLowerCase())) {
            return res.status(409).json({ error: 'Username is already taken.' });
        }
        users[userIndex].username = sanitize(updates.username);
    }
    if (updates.profilePic) users[userIndex].profilePic = updates.profilePic;

    saveUsers(users);
    const updatedUser = users[userIndex];
    
    // Create new secure server-side session with device binding
    const clientIp = getClientIp(req);
    const clientUserAgent = getUserAgent(req);
    const token = createSession(updatedUser.id, clientIp, clientUserAgent);
    const csrfToken = generateCsrfToken(token);
    
    res.status(200).json({ user: toPublicUser(updatedUser), token, csrfToken: csrfToken.token });
});

// Toggle Watchlist Item
// FIX: Changed type annotations to use express.Request and express.Response to resolve type conflicts.
// @FIX: Use express.Request and express.Response for proper type inference on request handlers.
router.post('/watchlist', authMiddleware, (req: express.Request, res: express.Response) => {
    const { movieId } = req.body;
    const watchlists = getWatchlists();
    let userWatchlist = watchlists[(req as any).userId] || [];
    if (userWatchlist.includes(movieId)) {
        userWatchlist = userWatchlist.filter((id: string) => id !== movieId);
    } else {
        userWatchlist.push(movieId);
    }
    watchlists[(req as any).userId] = userWatchlist;
    saveWatchlists(watchlists);
    res.status(200).json({ watchlist: userWatchlist });
});

// Add to Viewing History
// FIX: Changed type annotations to use express.Request and express.Response to resolve type conflicts.
// @FIX: Use express.Request and express.Response for proper type inference on request handlers.
router.post('/history', authMiddleware, (req: express.Request, res: express.Response) => {
    const { movieId } = req.body;
    const histories = getHistories();
    let userHistory = histories[(req as any).userId] || [];
    userHistory = userHistory.filter((item: any) => item.movieId !== movieId);
    userHistory.unshift({ movieId, viewedAt: new Date().toISOString() });
    if (userHistory.length > 50) userHistory = userHistory.slice(0, 50);
    histories[(req as any).userId] = userHistory;
    saveHistories(histories);
    res.status(200).json({ success: true });
});

// Reset Password
router.post('/reset-password', authMiddleware, async (req: express.Request, res: express.Response) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new passwords are required.' });
    }
    
    const users = getUsers();
    const userIndex = users.findIndex((u: any) => u.id === (req as any).userId);
    if (userIndex === -1) return res.status(404).json({ error: 'User not found.' });
    
    // Verify current password
    const isCurrentPasswordValid = await verifyPassword(currentPassword, users[userIndex].passwordHash);
    if (!isCurrentPasswordValid) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    
    // Update to new password
    users[userIndex].passwordHash = await hashPassword(newPassword);
    saveUsers(users);
    res.status(200).json({ success: true });
});

export default router;