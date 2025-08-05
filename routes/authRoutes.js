// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const tenantMiddleware = require('../middlewares/tenantMiddleware');
const jwtMiddleware = require('../middlewares/jwtMiddleware');
const rbac = require('../middlewares/rbacMiddleware');

// Apply tenant middleware to all auth routes
router.use(tenantMiddleware);

// Public routes (no authentication required)
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);

// Protected routes (authentication required)
router.use(jwtMiddleware); // Apply JWT middleware to all routes below

// Profile management
router.get('/profile', AuthController.profile);
router.put('/profile', AuthController.updateProfile);
router.post('/change-password', AuthController.changePassword);

// Admin-only routes
router.get('/test-admin', rbac.admin, (req, res) => {
  res.json({ 
    message: 'Admin access granted!', 
    user: req.user,
    tenant: req.tenant.name
  });
});

// Manager or Admin routes
router.get('/test-manager', rbac.manager, (req, res) => {
  res.json({ 
    message: 'Manager+ access granted!', 
    user: req.user,
    tenant: req.tenant.name
  });
});

// Any authenticated user routes
router.get('/test-user', rbac.user, (req, res) => {
  res.json({ 
    message: 'User access granted!', 
    user: req.user,
    tenant: req.tenant.name
  });
});

module.exports = router;