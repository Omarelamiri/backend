// services/AuthService.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.saltRounds = 12;
  }

  /**
   * Hash a password
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password
   */
  async hashPassword(password) {
    try {
      return await bcrypt.hash(password, this.saltRounds);
    } catch (error) {
      throw new Error(`Password hashing failed: ${error.message}`);
    }
  }

  /**
   * Compare password with hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} Password match result
   */
  async comparePassword(password, hash) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      throw new Error(`Password comparison failed: ${error.message}`);
    }
  }

  /**
   * Generate JWT token
   * @param {Object} payload - Token payload
   * @param {number} payload.userId - User ID
   * @param {string} payload.email - User email
   * @param {string} payload.role - User role
   * @param {string} payload.tenantId - Tenant ID
   * @param {string} payload.tenantName - Tenant name
   * @returns {string} JWT token
   */
  generateToken(payload) {
    try {
      const tokenPayload = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        tenantId: payload.tenantId,
        tenantName: payload.tenantName,
        iat: Math.floor(Date.now() / 1000)
      };

      return jwt.sign(tokenPayload, this.jwtSecret, {
        expiresIn: this.jwtExpiresIn,
        issuer: 'business-in-a-box',
        audience: payload.tenantName
      });
    } catch (error) {
      throw new Error(`Token generation failed: ${error.message}`);
    }
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {Object} Decoded token payload
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else if (error.name === 'NotBeforeError') {
        throw new Error('Token not active yet');
      } else {
        throw new Error(`Token verification failed: ${error.message}`);
      }
    }
  }

  /**
   * Extract token from Authorization header
   * @param {string} authHeader - Authorization header value
   * @returns {string|null} JWT token or null
   */
  extractTokenFromHeader(authHeader) {
    if (!authHeader) return null;

    // Support both "Bearer token" and "token" formats
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return authHeader;
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {Object} Validation result
   */
  validatePassword(password) {
    const result = {
      isValid: true,
      errors: []
    };

    if (!password) {
      result.isValid = false;
      result.errors.push('Password is required');
      return result;
    }

    if (password.length < 8) {
      result.isValid = false;
      result.errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      result.isValid = false;
      result.errors.push('Password must be less than 128 characters');
    }

    if (!/(?=.*[a-z])/.test(password)) {
      result.isValid = false;
      result.errors.push('Password must contain at least one lowercase letter');
    }

    if (!/(?=.*[A-Z])/.test(password)) {
      result.isValid = false;
      result.errors.push('Password must contain at least one uppercase letter');
    }

    if (!/(?=.*\d)/.test(password)) {
      result.isValid = false;
      result.errors.push('Password must contain at least one number');
    }

    if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(password)) {
      result.isValid = false;
      result.errors.push('Password must contain at least one special character');
    }

    // Check for common weak passwords
    const commonPasswords = [
      'password', '123456789', 'qwerty', 'abc123', 'password123',
      'admin', 'letmein', 'welcome', '123456', '12345678'
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      result.isValid = false;
      result.errors.push('Password is too common');
    }

    return result;
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} Validation result
   */
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Generate refresh token (simple random string for now)
   * @returns {string} Refresh token
   */
  generateRefreshToken() {
    return require('crypto').randomBytes(64).toString('hex');
  }

  /**
   * Create user session data
   * @param {Object} user - User object
   * @param {Object} tenant - Tenant context
   * @returns {Object} Session data
   */
  createUserSession(user, tenant) {
    return {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSchema: tenant.schema,
      lastLogin: new Date()
    };
  }
}

module.exports = new AuthService();