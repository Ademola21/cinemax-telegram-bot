import express from 'express';

const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

export function errorHandler(
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) {
    console.error('Error occurred:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip
    });

    const statusCode = err.statusCode || 500;

    if (isDevelopment) {
        return res.status(statusCode).json({
            error: err.message || 'Internal server error',
            stack: err.stack,
            details: err.details || null
        });
    }

    const safeErrors: { [key: string]: string } = {
        'Unauthorized': 'Authentication required',
        'Forbidden': 'Access denied',
        'Not Found': 'Resource not found',
        'Bad Request': 'Invalid request',
        'Conflict': 'Resource already exists'
    };

    const message = safeErrors[err.message] || 'An error occurred. Please try again later.';

    res.status(statusCode).json({
        error: message
    });
}

export function notFoundHandler(req: express.Request, res: express.Response) {
    res.status(404).json({
        error: 'Endpoint not found'
    });
}
