// routes/TenantRoutes.js - Updated with validation
const express = require('express');
const router = express.Router();
const TenantController = require('../controllers/TenantController');
const { ValidationRules, validate, customValidations, sanitize } = require('../middlewares/validationMiddleware');
const sequelize = require('../config/config');
const { Tenant } = require('../models')(sequelize);

// Apply sanitization to all routes
router.use(sanitize.trim);
router.use(sanitize.xss);

// Super Admin creates a tenant
router.post('/', 
  validate([
    ...ValidationRules.tenant.create,
    customValidations.uniqueTenantName(Tenant)
  ]),
  TenantController.createTenant
);

// List all tenants with pagination (optional, for management)
router.get('/', 
  validate(ValidationRules.query.pagination),
  TenantController.getAllTenants
);

module.exports = router;