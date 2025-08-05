// routes/userRoutes.js - Updated with validation
const express = require('express');
const router = express.Router();
const userController = require('../controllers/UserController');
const tenantMiddleware = require('../middlewares/tenantMiddleware');
const jwtMiddleware = require('../middlewares/jwtMiddleware');
const rbac = require('../middlewares/rbacMiddleware');
const { ValidationRules, validate, customValidations, sanitize } = require('../middlewares/validationMiddleware');

// Apply tenant middleware to all user routes
router.use(tenantMiddleware);

// Apply JWT authentication to all routes
router.use(jwtMiddleware);

// Apply sanitization to all routes
router.use(sanitize.trim);
router.use(sanitize.xss);

// User management routes with validation and role-based access control

// Get all users with pagination - Manager+ only
router.get('/', 
  rbac.manager,
  validate(ValidationRules.query.pagination),
  userController.getAllUsers
);

// Create user - Admin only (different from registration)
router.post('/', 
  rbac.admin,
  validate([
    ...ValidationRules.user.create,
    // Add unique email validation that uses tenant context
    customValidations.uniqueEmail(() => {
      // This will be called with the User model from tenant context
      return (req, res, next) => {
        const { User } = req.tenant.models;
        return customValidations.uniqueEmail(User)(req, res, next);
      };
    })
  ]),
  userController.createUser
);

// Get specific user - Owner or Manager+
router.get('/:userId', 
  validate(ValidationRules.params.userId),
  rbac.ownerOrManager, 
  userController.getUserById
);

// Update user - Owner or Admin
router.put('/:userId', 
  validate([
    ...ValidationRules.user.update,
    // Add unique email validation excluding current user
    (req, res, next) => {
      const { User } = req.tenant.models;
      return customValidations.uniqueEmail(User, req.params.userId)(req, res, next);
    }
  ]),
  rbac.ownerOrAdmin, 
  userController.updateUser
);

// Delete user - Admin only
router.delete('/:userId', 
  validate(ValidationRules.params.userId),
  rbac.admin, 
  userController.deleteUser
);

// Deactivate/Activate user - Admin only
router.patch('/:userId/status', 
  validate(ValidationRules.user.toggleStatus),
  rbac.admin, 
  userController.toggleUserStatus
);

// Get users by role - Manager+ only
router.get('/role/:role', 
  validate(ValidationRules.params.role),
  rbac.manager, 
  userController.getUsersByRole
);

module.exports = router;