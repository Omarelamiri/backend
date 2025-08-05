// middlewares/rbacMiddleware.js

/**
 * Role hierarchy definition
 * Higher number = more permissions
 */
const ROLE_HIERARCHY = {
  'user': 1,
  'manager': 2,
  'admin': 3
};

/**
 * Check if user has required role or higher
 * @param {string} userRole - User's current role
 * @param {string} requiredRole - Required minimum role
 * @returns {boolean}
 */
function hasPermission(userRole, requiredRole) {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
}

/**
 * Require specific role (exact match)
 * @param {string|Array<string>} allowedRoles - Role(s) that are allowed
 * @returns {Function} Express middleware
 */
function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return (req, res, next) => {
    // Ensure user is authenticated (should have JWT middleware before this)
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Check if user has one of the allowed roles
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${req.user.role}`,
        code: 'INSUFFICIENT_ROLE',
        requiredRoles: roles,
        userRole: req.user.role
      });
    }

    next();
  };
}

/**
 * Require minimum role level (hierarchical)
 * @param {string} minimumRole - Minimum role required
 * @returns {Function} Express middleware
 */
function requireMinimumRole(minimumRole) {
  return (req, res, next) => {
    // Ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Check if user has sufficient role level
    if (!hasPermission(req.user.role, minimumRole)) {
      return res.status(403).json({
        error: `Access denied. Minimum role required: ${minimumRole}. Your role: ${req.user.role}`,
        code: 'INSUFFICIENT_PERMISSIONS',
        minimumRole,
        userRole: req.user.role,
        userLevel: ROLE_HIERARCHY[req.user.role] || 0,
        requiredLevel: ROLE_HIERARCHY[minimumRole] || 0
      });
    }

    next();
  };
}

/**
 * Allow access to resource owner or users with minimum role
 * @param {string} minimumRole - Minimum role for non-owners
 * @param {string} ownerField - Field name to check ownership (default: 'userId')
 * @returns {Function} Express middleware
 */
function requireOwnershipOrRole(minimumRole, ownerField = 'userId') {
  return async (req, res, next) => {
    // Ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    try {
      // Check if user has sufficient role (bypass ownership check)
      if (hasPermission(req.user.role, minimumRole)) {
        return next();
      }

      // For regular users, check ownership
      let resourceOwnerId;

      // Check in route params first (e.g., /users/:userId)
      if (req.params[ownerField]) {
        resourceOwnerId = parseInt(req.params[ownerField]);
      }
      // Check in request body
      else if (req.body && req.body[ownerField]) {
        resourceOwnerId = parseInt(req.body[ownerField]);
      }
      // Check in query params
      else if (req.query && req.query[ownerField]) {
        resourceOwnerId = parseInt(req.query[ownerField]);
      }

      // If we can't determine ownership, deny access
      if (!resourceOwnerId) {
        return res.status(403).json({
          error: 'Cannot determine resource ownership',
          code: 'OWNERSHIP_UNKNOWN'
        });
      }

      // Check if user owns the resource
      if (req.user.userId === resourceOwnerId) {
        return next();
      }

      // User doesn't own resource and doesn't have sufficient role
      return res.status(403).json({
        error: `Access denied. You can only access your own resources or need ${minimumRole} role`,
        code: 'INSUFFICIENT_PERMISSIONS_OR_OWNERSHIP',
        minimumRole,
        userRole: req.user.role
      });

    } catch (err) {
      console.error('RBAC ownership check error:', err);
      res.status(500).json({
        error: 'Authorization error',
        code: 'RBAC_ERROR'
      });
    }
  };
}

/**
 * Check if user is active
 * @returns {Function} Express middleware
 */
function requireActiveUser() {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    try {
      const { User } = req.tenant.models;
      const user = await User.findByPk(req.user.userId, {
        attributes: ['isActive']
      });

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          error: 'Account is inactive. Please contact administrator.',
          code: 'ACCOUNT_INACTIVE'
        });
      }

      next();
    } catch (err) {
      console.error('Active user check error:', err);
      res.status(500).json({
        error: 'User status verification error',
        code: 'USER_STATUS_ERROR'
      });
    }
  };
}

/**
 * Convenience middleware combinations
 */
const rbac = {
  // Role-based access
  admin: requireRole('admin'),
  manager: requireMinimumRole('manager'),
  user: requireMinimumRole('user'),
  
  // Specific role combinations
  adminOrManager: requireRole(['admin', 'manager']),
  adminOnly: requireRole('admin'),
  
  // Ownership-based access
  ownerOrAdmin: requireOwnershipOrRole('admin'),
  ownerOrManager: requireOwnershipOrRole('manager'),
  
  // User status checks
  activeUser: requireActiveUser(),
  
  // Custom functions
  requireRole,
  requireMinimumRole,
  requireOwnershipOrRole,
  requireActiveUser,
  hasPermission
};

module.exports = rbac;