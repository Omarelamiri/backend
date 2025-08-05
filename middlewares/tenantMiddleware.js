const sequelize = require('../config/config');
const TenantCacheService = require('../services/TenantCacheService'); // Import centralized cache
const { Tenant } = require('../models')(sequelize);

module.exports = async (req, res, next) => {
  try {
    const tenantName = req.headers['x-tenant-id'];
    
    // Validate tenant header
    if (!tenantName) {
      return res.status(400).json({ 
        error: 'Missing tenant ID in x-tenant-id header' 
      });
    }

    if (typeof tenantName !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(tenantName)) {
      return res.status(400).json({ 
        error: 'Invalid tenant ID format. Only alphanumeric characters, underscores, and hyphens allowed' 
      });
    }

    if (tenantName.length > 50) {
      return res.status(400).json({ 
        error: 'Tenant ID too long (max 50 characters)' 
      });
    }

    // Find tenant in global public schema
    const tenant = await Tenant.findOne({ 
      where: { name: tenantName },
      attributes: ['id', 'name', 'schema', 'isActive']
    });

    if (!tenant) {
      return res.status(404).json({ 
        error: `Tenant '${tenantName}' not found` 
      });
    }

    // Check if tenant is active
    if (!tenant.isActive) {
      return res.status(403).json({ 
        error: `Tenant '${tenantName}' is inactive` 
      });
    }

    // Load models using centralized cache
    let models;
    try {
      models = TenantCacheService.getModels(sequelize, tenant.schema, tenant.id);
      
      // Validate models were loaded
      if (!models || Object.keys(models).length === 0) {
        throw new Error('No models were initialized');
      }

      // Verify schema exists and tables are accessible
      await sequelize.authenticate();
      
      // Test a simple query to ensure schema/tables exist
      const testModel = Object.values(models)[0];
      if (testModel) {
        await testModel.count(); // This will fail if schema/table doesn't exist
      }

    } catch (modelError) {
      console.error(`❌ Failed to load models for schema '${tenant.schema}':`, modelError.message);
      
      return res.status(500).json({ 
        error: `Tenant database schema error. Please contact support.`,
        details: process.env.NODE_ENV === 'development' ? modelError.message : undefined
      });
    }

    // Attach tenant context to request
    req.tenant = {
      id: tenant.id,
      name: tenant.name,
      schema: tenant.schema,
      models: models,
      isActive: tenant.isActive,
      cacheInfo: TenantCacheService.getCacheEntry(tenant.schema) // Optional: cache metadata
    };

    // Add tenant info to response headers (optional, for debugging)
    if (process.env.NODE_ENV === 'development') {
      res.setHeader('X-Current-Tenant', tenant.name);
      res.setHeader('X-Tenant-Schema', tenant.schema);
      res.setHeader('X-Models-Cached', TenantCacheService.hasModels(tenant.schema) ? 'true' : 'false');
    }

    next();

  } catch (err) {
    console.error('❌ Tenant middleware error:', err);
    
    // Don't expose internal errors in production
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message;

    res.status(500).json({ 
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
};