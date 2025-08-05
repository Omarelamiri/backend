// middlewares/errorHandler.js
const winston = require('winston');

// Create a logger instance
const logger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

/**
 * Custom error class for API errors
 */
class APIError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}

/**
 * Database error handler
 */
const handleDatabaseError = (err) => {
  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    const errors = {};
    err.errors.forEach(error => {
      if (!errors[error.path]) {
        errors[error.path] = [];
      }
      errors[error.path].push(error.message);
    });

    return new APIError(
      'Database validation failed',
      400,
      'DATABASE_VALIDATION_ERROR',
      { fields: errors }
    );
  }

  // Sequelize unique constraint errors
  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors[0]?.path || 'unknown';
    return new APIError(
      `${field} already exists`,
      409,
      'DUPLICATE_ENTRY',
      { field, value: err.errors[0]?.value }
    );
  }

  // Sequelize connection errors
  if (err.name === 'SequelizeConnectionError') {
    return new APIError(
      'Database connection failed',
      503,
      'DATABASE_CONNECTION_ERROR'
    );
  }

  // Sequelize timeout errors
  if (err.name === 'SequelizeTimeoutError') {
    return new APIError(
      'Database operation timed out',
      504,
      'DATABASE_TIMEOUT'
    );
  }

  // Foreign key constraint errors
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return new APIError(
      'Referenced record does not exist',
      400,
      'FOREIGN_KEY_CONSTRAINT'
    );
  }

  return null;
};

/**
 * JWT error handler
 */
const handleJWTError = (err) => {
  if (err.name === 'JsonWebTokenError') {
    return new APIError('Invalid token', 401, 'INVALID_TOKEN');
  }
  
  if (err.name === 'TokenExpiredError') {
    return new APIError('Token has expired', 401, 'TOKEN_EXPIRED');
  }
  
  if (err.name === 'NotBeforeError') {
    return new APIError('Token not active yet', 401, 'TOKEN_NOT_ACTIVE');
  }

  return null;
};

/**
 * Generic error handler
 */
const handleGenericError = (err) => {
  // Cast errors
  if (err.name === 'CastError') {
    return new APIError(
      `Invalid ${err.path}: ${err.value}`,
      400,
      'INVALID_PARAMETER'
    );
  }

  // Syntax errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return new APIError(
      'Invalid JSON in request body',
      400,
      'INVALID_JSON'
    );
  }

  return null;
};

/**
 * Development error response
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode || 500).json({
    error: err.message,
    code: err.code || 'INTERNAL_ERROR',
    details: err.details || null,
    stack: err.stack,
    timestamp: new Date().toISOString(),
    path: res.req?.originalUrl,
    method: res.req?.method
  });
};

/**
 * Production error response
 */
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    const response = {
      error: err.message,
      code: err.code || 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    };

    // Only include details for certain error types
    if (err.details && ['VALIDATION_ERROR', 'DATABASE_VALIDATION_ERROR'].includes(err.code)) {
      response.details = err.details;
    }

    res.status(err.statusCode || 500).json(response);
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error('Unknown error occurred', {
      error: err.message,
      stack: err.stack,
      url: res.req?.originalUrl,
      method: res.req?.method,
      ip: res.req?.ip,
      userAgent: res.req?.get('User-Agent')
    });

    res.status(500).json({
      error: 'Something went wrong',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Main error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  // Set default error properties
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log error for monitoring
  const logData = {
    message: err.message,
    statusCode: err.statusCode,
    code: err.code,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    tenant: req.tenant?.name,
    user: req.user?.email
  };

  if (err.statusCode >= 500) {
    logger.error('Server error', { ...logData, stack: err.stack });
  } else {
    logger.warn('Client error', logData);
  }

  // Try to handle specific error types
  let handledError = handleDatabaseError(err) || 
                   handleJWTError(err) || 
                   handleGenericError(err) ||
                   err;

  // Ensure it's an APIError instance
  if (!(handledError instanceof APIError) && handledError.isOperational !== true) {
    handledError = new APIError(
      handledError.message || 'An error occurred',
      handledError.statusCode || 500,
      handledError.code || 'INTERNAL_ERROR'
    );
    handledError.isOperational = false; // Mark as unknown error
  }

  // Send appropriate response based on environment
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(handledError, res);
  } else {
    sendErrorProd(handledError, res);
  }
};

/**
 * 404 handler middleware
 */
const notFoundHandler = (req, res, next) => {
  const error = new APIError(
    `Route ${req.originalUrl} not found`,
    404,
    'ROUTE_NOT_FOUND',
    {
      method: req.method,
      url: req.originalUrl,
      availableRoutes: [
        'GET /api/tenants',
        'POST /api/tenants',
        'POST /api/auth/register',
        'POST /api/auth/login',
        'GET /api/auth/profile',
        'GET /api/users',
        'POST /api/users'
      ]
    }
  );
  
  next(error);
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors automatically
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Rate limiting error handler
 */
const rateLimitHandler = (req, res) => {
  const error = new APIError(
    'Too many requests, please try again later',
    429,
    'RATE_LIMIT_EXCEEDED',
    {
      retryAfter: res.get('Retry-After'),
      limit: res.get('X-RateLimit-Limit'),
      remaining: res.get('X-RateLimit-Remaining')
    }
  );

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

module.exports = {
  APIError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  rateLimitHandler
};