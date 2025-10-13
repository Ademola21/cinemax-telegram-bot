import express from 'express';

/**
 * Security Headers Middleware
 * 
 * PRODUCTION HARDENING RECOMMENDATIONS:
 * 1. Build Tailwind CSS into your bundle (npm run build already does this)
 * 2. Remove cdn.tailwindcss.com from index.html
 * 3. Update CSP to remove 'unsafe-inline' and 'unsafe-eval' after Tailwind CDN removal
 * 
 * Current CSP allows cdn.tailwindcss.com for development convenience.
 * For production deployment, use the built-in Tailwind compilation.
 */

export function securityHeadersMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    res.setHeader(
        'Content-Security-Policy',
        [
            "default-src 'self'",
            "script-src 'self' https://cdn.jsdelivr.net",
            "style-src 'self' https://fonts.googleapis.com",
            "img-src 'self' data: https:",
            "font-src 'self' data: https://fonts.gstatic.com",
            "connect-src 'self' https:",
            "media-src 'self' blob: https:",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'self'"
        ].join('; ')
    );
    
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    if (isHttps) {
        res.setHeader(
            'Strict-Transport-Security',
            'max-age=31536000; includeSubDomains'
        );
    }
    
    res.removeHeader('X-Powered-By');
    
    next();
}
