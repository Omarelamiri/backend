// routes/authRoutes.js - Updated with validation
const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const tenantMiddleware = require('../middlewares/tenantMiddleware');
const jwtMiddleware = require('../middlewares/jwtMiddleware');
const rbac = require('../middlewares/rbacMiddleware');
const { ValidationRules, validate, sanitize } = require('../middlewares/validationMiddleware');

// Apply tenant middleware to all auth routes
router.use(tenantMiddleware);

// Apply sanitization to all routes
router.use(sanitize.trim);
router.use(sanitize.xss);

// Public routes (no authentication required)
router.post('/register', 
  validate(ValidationRules.user.register),
  AuthController.register
);

router.post('/login', 
  validate(ValidationRules.user.login),
  AuthController.login
);

// Protected routes (authentication required)
router.use(jwtMiddleware); // Apply JWT middleware to all routes below

// Profile management
router.get('/profile', AuthController.profile);

router.put('/profile', 
  validate(ValidationRules.user.updateProfile),
  AuthController.updateProfile
);

router.post('/change-password', 
  validate(ValidationRules.user.changePassword),
  AuthController.changePassword
);

// Test routes with validation
router.get('/test-admin', rbac.admin, (req, res) => {
  res.json({ 
    message: 'Admin access granted!', 
    user: req.user,
    tenant: req.tenant.name
  });
});

router.get('/test-manager', rbac.manager, (req, res) => {
  res.json({ 
    message: 'Manager+ access granted!', 
    user: req.user,
    tenant: req.tenant.name
  });
});

router.get('/test-user', rbac.user, (req, res) => {
  res.json({ 
    message: 'User access granted!', 
    user: req.user,
    tenant: req.tenant.name
  });
});

module.exports = router;