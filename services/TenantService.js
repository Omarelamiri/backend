// services/TenantService.js
const sequelize = require('../config/config');
const TenantCacheService = require('./TenantCacheService'); // Import centralized cache
const { Tenant } = require('../models')(sequelize);

async function createTenant(name, contactEmail = null, createdBy = null) {
  // Input validation
  if (!name || typeof name !== 'string') {
    throw new Error('Tenant name is required and must be a string');
  }

  // Sanitize and validate schema name
  const schema = name.toLowerCase().replace(/[^a-z0-9_]/g, '').trim();
  
  if (!schema || schema.length === 0) {
    throw new Error('Invalid tenant name: results in empty schema name after sanitization');
  }

  if (schema.length > 50) {
    throw new Error('Schema name too long (max 50 characters)');
  }

  // PostgreSQL reserved words check
  const reservedWords = ['public', 'information_schema', 'pg_catalog', 'pg_toast'];
  if (reservedWords.includes(schema)) {
    throw new Error(`Schema name '${schema}' is reserved`);
  }

  const transaction = await sequelize.transaction();
  let tenantEntry = null;
  let schemaCreated = false;
  let tablesCreated = false;

  try {
    // Step 1: Create tenant entry in database
    tenantEntry = await Tenant.create({
      name,
      schema,
      contactEmail,
      createdBy,
      isActive: true
    }, { transaction });

    // Step 2: Create schema
    await sequelize.createSchema(schema, { ifNotExists: true });
    schemaCreated = true;

    // Step 3: Initialize and cache models using centralized cache
    try {
      const models = TenantCacheService.getModels(sequelize, schema, tenantEntry.id);
      
      if (!models || Object.keys(models).length === 0) {
        throw new Error('Failed to initialize tenant models');
      }
    } catch (cacheError) {
      throw new Error(`Model initialization failed: ${cacheError.message}`);
    }

    // Step 4: Sync only the tenant-specific models
    await sequelize.sync({ schema });
    tablesCreated = true;

    // Commit transaction
    await transaction.commit();

    console.log(`✅ Tenant '${name}' created successfully with schema '${schema}'`);
    return tenantEntry;

  } catch (err) {
    console.error(`❌ Tenant creation failed for '${name}':`, err.message);

    // Rollback transaction
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    // Manual cleanup for schema-level changes (not covered by transaction)
    try {
      if (tablesCreated) {
        // Drop all tables in the schema
        await sequelize.dropSchema(schema, { cascade: true });
        console.log(`🧹 Cleaned up schema '${schema}' after failure`);
      } else if (schemaCreated) {
        // Just drop the empty schema
        await sequelize.dropSchema(schema);
        console.log(`🧹 Cleaned up empty schema '${schema}' after failure`);
      }
    } catch (cleanupErr) {
      console.error(`⚠️  Cleanup failed for schema '${schema}':`, cleanupErr.message);
    }

    // Remove from cache if it was added
    TenantCacheService.clearSchema(schema);

    throw new Error(`Tenant creation failed: ${err.message}`);
  }
}

async function getAllTenants() {
  try {
    return await Tenant.findAll({
      attributes: ['id', 'name', 'schema', 'contactEmail', 'isActive', 'planType', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });
  } catch (err) {
    throw new Error(`Failed to fetch tenants: ${err.message}`);
  }
}

async function deleteTenant(tenantId) {
  const transaction = await sequelize.transaction();
  
  try {
    const tenant = await Tenant.findByPk(tenantId, { transaction });
    
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // Drop schema and all its tables
    await sequelize.dropSchema(tenant.schema, { cascade: true });
    
    // Remove tenant record
    await tenant.destroy({ transaction });
    
    // Remove from centralized cache
    TenantCacheService.clearSchema(tenant.schema);

    await transaction.commit();
    
    console.log(`✅ Tenant '${tenant.name}' deleted successfully`);
    
  } catch (err) {
    await transaction.rollback();
    throw new Error(`Failed to delete tenant: ${err.message}`);
  }
}

// Development helper function to get cache stats
async function getCacheStats() {
  return TenantCacheService.getStats();
}

// Development helper to reload a tenant's models (useful when models change)
async function reloadTenantModels(tenantName) {
  try {
    const tenant = await Tenant.findOne({ where: { name: tenantName } });
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    TenantCacheService.reloadSchema(sequelize, tenant.schema, tenant.id);
    console.log(`🔄 Reloaded models for tenant: ${tenantName}`);
    
  } catch (err) {
    throw new Error(`Failed to reload tenant models: ${err.message}`);
  }
}

module.exports = {
  createTenant,
  getAllTenants,
  deleteTenant,
  getCacheStats,      // Development helper
  reloadTenantModels  // Development helper
};