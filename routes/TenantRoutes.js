// routes/TenantRoutes.js
const express = require('express');
const router = express.Router();
const TenantController = require('../controllers/TenantController');

// Super Admin creates a tenant
router.post('/', TenantController.createTenant);

// List all tenants (optional, for management)
router.get('/', TenantController.getAllTenants);

module.exports = router;
