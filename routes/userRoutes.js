// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/UserController');
const tenantMiddleware = require('../middlewares/tenantMiddleware');
const jwtMiddleware = require('../middlewares/jwtMiddleware');
const rbac = require('../middlewares/rbacMiddleware');

// Apply tenant middleware to all user routes
router.use(tenantMiddleware);

// Apply JWT authentication to all routes
router.use(jwtMiddleware);

// User management routes with role-based access control

// Get all users - Manager+ only
router.get('/', rbac.manager, userController.getAllUsers);

// Create user - Admin only (different from registration)
router.post('/', rbac.admin, userController.createUser);

// Get specific user - Owner or Manager+
router.get('/:userId', rbac.ownerOrManager, userController.getUserById);

// Update user - Owner or Admin
router.put('/:userId', rbac.ownerOrAdmin, userController.updateUser);

// Delete user - Admin only
router.delete('/:userId', rbac.admin, userController.deleteUser);

// Deactivate/Activate user - Admin only
router.patch('/:userId/status', rbac.admin, userController.toggleUserStatus);

// Get users by role - Manager+ only
router.get('/role/:role', rbac.manager, userController.getUsersByRole);

module.exports = router;