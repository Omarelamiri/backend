// middlewares/jwtMiddleware.js
const AuthService = require('../services/AuthService');

/**
 * JWT Authentication Middleware
 * Verifies JWT token and attaches user info to request
 */
module.exports = (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = AuthService.extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        error: 'Access token is required',
        code: 'TOKEN_MISSING'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = AuthService.verifyToken(token);
    } catch (tokenError) {
      let errorCode = 'TOKEN_INVALID';
      let statusCode = 401;

      if (tokenError.message.includes('expired')) {
        errorCode = 'TOKEN_EXPIRED';
      } else if (tokenError.message.includes('not active')) {
        errorCode = 'TOKEN_NOT_ACTIVE';
        statusCode = 403;
      }

      return res.status(statusCode).json({
        error: tokenError.message,
        code: errorCode
      });
    }

    // Validate token payload
    if (!decoded.userId || !decoded.email || !decoded.role || !decoded.tenantId) {
      return res.status(401).json({
        error: 'Invalid token payload',
        code: 'TOKEN_INVALID_PAYLOAD'
      });
    }

    // Check if token is for the current tenant
    if (req.tenant && decoded.tenantId !== req.tenant.id) {
      return res.status(403).json({
        error: 'Token is not valid for this tenant',
        code: 'TOKEN_TENANT_MISMATCH'
      });
    }

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      tenantId: decoded.tenantId,
      tenantName: decoded.tenantName,
      tokenIssuedAt: decoded.iat
    };

    // Add auth info to response headers (development only)
    if (process.env.NODE_ENV === 'development') {
      res.setHeader('X-Authenticated-User', decoded.email);
      res.setHeader('X-User-Role', decoded.role);
    }

    next();

  } catch (err) {
    console.error('JWT middleware error:', err);
    
    res.status(500).json({
      error: process.env.NODE_ENV === 'production' ? 'Authentication error' : err.message,
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Optional JWT Middleware - doesn't fail if no token provided
 * Useful for routes that work both with and without authentication
 */
module.exports.optional = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = AuthService.extractTokenFromHeader(authHeader);

  if (!token) {
    // No token provided, continue without authentication
    req.user = null;
    return next();
  }

  // Token provided, try to verify it
  try {
    const decoded = AuthService.verifyToken(token);
    
    if (decoded.userId && decoded.email && decoded.role && decoded.tenantId) {
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        tenantId: decoded.tenantId,
        tenantName: decoded.tenantName,
        tokenIssuedAt: decoded.iat
      };
    } else {
      req.user = null;
    }
  } catch (tokenError) {
    // Invalid token, but we don't fail - just continue without auth
    req.user = null;
  }

  next();
};