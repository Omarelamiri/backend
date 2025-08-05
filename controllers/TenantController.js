// controllers/TenantController.js
const TenantService = require('../services/TenantService');

module.exports = {
  async createTenant(req, res, next) {
    try {
      const { name, contactEmail, createdBy } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Tenant name is required' });
      }
      const tenant = await TenantService.createTenant(name, contactEmail, createdBy);
      res.status(201).json(tenant);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  async getAllTenants(req, res, next) {
    try {
      const tenants = await TenantService.getAllTenants();
      res.json(tenants);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};
