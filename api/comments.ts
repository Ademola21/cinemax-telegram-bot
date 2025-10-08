import express from 'express';
const router = express.Router();
import fs from 'fs';
import path from 'path';
import { atomicWrite } from './utils';
import { getSession, validateSessionBinding } from './sessionStore';

// --- DB HELPERS & CONFIG ---
// Use process.cwd() for VPS compatibility instead of relative paths
const COMMENTS_PATH = path.join(process.cwd(), 'data', 'comments.json');
const USERS_PATH = path.join(process.cwd(), 'data', 'users.json');

const readJsonFile = (filePath: string, defaultValue: any) => {
    try {
        if (!fs.existsSync(filePath)) return defaultValue;
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch { return defaultValue; }
};
const writeCommentsDb = (data: any) => atomicWrite(COMMENTS_PATH, JSON.stringify(data, null, 2));

const readCommentsDb = () => readJsonFile(COMMENTS_PATH, { comments: {}, upvotes: {} });
const getUsers = () => readJsonFile(USERS_PATH, []);
const sanitize = (str: string) => str.replace(/</g, "&lt;").replace(/>/g, "&gt;");

// SECURITY FIX: Proper session validation using server-side session store
// This replaces the vulnerable validateSession that trusted client data
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
    const user = getUsers().find((u: any) => u.id === session.userId);
    if (!user) {
        return { valid: false, error: 'User not found' };
    }
    
    return { valid: true, userId: session.userId };
};

// --- ROUTES ---

// GET /api/comments?movieId=...
// FIX: Changed type annotations to use express.Request and express.Response to resolve type conflicts.
// @FIX: Use express.Request and express.Response for proper type inference on request handlers.
router.get('/', (req: express.Request, res: express.Response) => {
    const { movieId } = req.query;
    if (!movieId) return res.status(400).json({ error: 'Movie ID is required' });

    const db = readCommentsDb();
    const movieComments = db.comments[movieId as string] || [];

    const commentMap = new Map();
    movieComments.forEach((c: any) => { c.replies = []; commentMap.set(c.id, c); });

    const rootComments: any[] = [];
    movieComments.forEach((c: any) => {
        if (c.parentId && commentMap.has(c.parentId)) {
            commentMap.get(c.parentId).replies.push(c);
        } else {
            rootComments.push(c);
        }
    });

    const upvotesForMovie = Object.fromEntries(
        Object.entries(db.upvotes).filter(([commentId]) => commentMap.has(commentId))
    );

    // Enhance comments with user details
    const commentsWithUserDetails = rootComments.map((comment) => {
        const user = getUsers().find((u: any) => u.id === comment.userId);
        return {
            ...comment,
            reviewer: user ? user.name : 'Anonymous',
            userProfilePic: user ? user.profilePic || undefined : undefined,
            userRole: user ? user.role || 'user' : 'user',
        };
    });

    res.status(200).json({ comments: commentsWithUserDetails.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()), upvotes: upvotesForMovie });
});

// POST /api/comments (add new comment) - SECURITY: Now uses proper server-side validation
// FIX: Changed type annotations to use express.Request and express.Response to resolve type conflicts.
// @FIX: Use express.Request and express.Response for proper type inference on request handlers.
router.post('/', (req: express.Request, res: express.Response) => {
    const { movieId, commentData } = req.body;
    
    // SECURITY FIX: Validate session token against server-side session store
    const authResult = validateAuthToken(req.headers.authorization, req);
    if (!authResult.valid) {
        return res.status(401).json({ error: `Unauthorized: ${authResult.error}` });
    }

    const user = getUsers().find((u: any) => u.id === authResult.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const db = readCommentsDb();
    const newComment = {
        id: `comment_${Date.now()}`,
        parentId: commentData.parentId || null,
        reviewer: user.name,
        userId: user.id,
        comment: sanitize(commentData.comment),
        date: new Date().toISOString(),
        rating: commentData.parentId ? undefined : commentData.rating,
        userProfilePic: user.profilePic || undefined,
        userRole: user.role || 'user',
      };

    if (!db.comments[movieId]) db.comments[movieId] = [];
    db.comments[movieId].push(newComment);
    writeCommentsDb(db);

    res.status(201).json({ success: true, comment: newComment });
});

// PUT /api/comments (toggle upvote) - SECURITY: Now uses proper server-side validation
// FIX: Changed type annotations to use express.Request and express.Response to resolve type conflicts.
// @FIX: Use express.Request and express.Response for proper type inference on request handlers.
router.put('/', (req: express.Request, res: express.Response) => {
    const { commentId } = req.body;
    
    // SECURITY FIX: Validate session token against server-side session store
    const authResult = validateAuthToken(req.headers.authorization, req);
    if (!authResult.valid) {
        return res.status(401).json({ error: `Unauthorized: ${authResult.error}` });
    }

    const db = readCommentsDb();
    let upvoteUserIds = db.upvotes[commentId] || [];
    if (upvoteUserIds.includes(authResult.userId!)) {
        upvoteUserIds = upvoteUserIds.filter((id: string) => id !== authResult.userId);
    } else {
        upvoteUserIds.push(authResult.userId!);
    }
    db.upvotes[commentId] = upvoteUserIds;
    writeCommentsDb(db);

    res.status(200).json({ success: true, upvotes: upvoteUserIds });
});

// DELETE /api/comments - SECURITY: Admin-only with proper server-side validation
// FIX: Changed type annotations to use express.Request and express.Response to resolve type conflicts.
// @FIX: Use express.Request and express.Response for proper type inference on request handlers.
router.delete('/', (req: express.Request, res: express.Response) => {
    const { movieId, commentId } = req.body;
    
    // SECURITY FIX: Validate session token against server-side session store
    const authResult = validateAuthToken(req.headers.authorization, req);
    if (!authResult.valid) {
        return res.status(401).json({ error: `Unauthorized: ${authResult.error}` });
    }

    const user = getUsers().find((u: any) => u.id === authResult.userId);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const db = readCommentsDb();
    let movieComments = db.comments[movieId] || [];

    const commentsToDelete = new Set([commentId]);
    let changed = true;
    while(changed) {
        changed = false;
        const currentSize = commentsToDelete.size;
        movieComments.forEach((c: any) => { if(c.parentId && commentsToDelete.has(c.parentId)) commentsToDelete.add(c.id); });
        if(commentsToDelete.size > currentSize) changed = true;
    }

    db.comments[movieId] = movieComments.filter((c: any) => !commentsToDelete.has(c.id));
    commentsToDelete.forEach(id => delete db.upvotes[id]);
    writeCommentsDb(db);

    res.status(200).json({ success: true });
});

export default router;