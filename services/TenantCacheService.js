// services/TenantCacheService.js
const initModels = require('../models/initModels');

class TenantCacheService {
  constructor() {
    this.tenantModels = new Map();
    this.loadedAt = new Map();
  }

  /**
   * Get models for a tenant schema
   * @param {Object} sequelize - Sequelize instance
   * @param {string} schema - Tenant schema name
   * @param {number} tenantId - Tenant ID for tracking
   * @returns {Object} Tenant models
   */
  getModels(sequelize, schema, tenantId = null) {
    const cacheKey = schema;
    
    if (!this.tenantModels.has(cacheKey)) {
      console.log(`📦 Loading models for tenant schema: ${schema}`);
      
      try {
        const models = initModels(sequelize, schema);
        
        if (!models || Object.keys(models).length === 0) {
          throw new Error(`No models initialized for schema: ${schema}`);
        }

        const cacheEntry = {
          models,
          tenantId,
          schema,
          loadedAt: new Date()
        };

        this.tenantModels.set(cacheKey, cacheEntry);
        this.loadedAt.set(cacheKey, new Date());
        
        console.log(`✅ Models cached for schema: ${schema} (${Object.keys(models).length} models)`);
        
      } catch (error) {
        console.error(`❌ Failed to load models for schema ${schema}:`, error.message);
        throw error;
      }
    }

    return this.tenantModels.get(cacheKey).models;
  }

  /**
   * Get full cache entry with metadata
   * @param {string} schema - Tenant schema name  
   * @returns {Object|null} Cache entry or null if not found
   */
  getCacheEntry(schema) {
    return this.tenantModels.get(schema) || null;
  }

  /**
   * Check if models are cached for a schema
   * @param {string} schema - Tenant schema name
   * @returns {boolean}
   */
  hasModels(schema) {
    return this.tenantModels.has(schema);
  }

  /**
   * Remove models from cache for a specific schema
   * @param {string} schema - Tenant schema name to remove
   */
  clearSchema(schema) {
    if (this.tenantModels.has(schema)) {
      this.tenantModels.delete(schema);
      this.loadedAt.delete(schema);
      console.log(`🧹 Cleared cache for schema: ${schema}`);
      return true;
    }
    return false;
  }

  /**
   * Clear all cached models
   */
  clearAll() {
    const count = this.tenantModels.size;
    this.tenantModels.clear();
    this.loadedAt.clear();
    console.log(`🧹 Cleared all cached models (${count} schemas)`);
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    const schemas = Array.from(this.tenantModels.keys());
    const stats = {
      totalSchemas: schemas.length,
      schemas: schemas,
      memoryUsage: this._estimateMemoryUsage(),
      oldestCache: this._getOldestCacheTime(),
      newestCache: this._getNewestCacheTime()
    };

    return stats;
  }

  /**
   * Reload models for a specific schema (useful for development)
   * @param {Object} sequelize - Sequelize instance
   * @param {string} schema - Tenant schema name
   * @param {number} tenantId - Tenant ID
   * @returns {Object} Reloaded models
   */
  reloadSchema(sequelize, schema, tenantId = null) {
    this.clearSchema(schema);
    return this.getModels(sequelize, schema, tenantId);
  }

  /**
   * Get cache entries older than specified minutes
   * @param {number} minutes - Age threshold in minutes
   * @returns {Array} Array of schema names with old cache
   */
  getStaleEntries(minutes = 60) {
    const threshold = new Date(Date.now() - (minutes * 60 * 1000));
    const staleSchemas = [];

    for (const [schema, loadTime] of this.loadedAt.entries()) {
      if (loadTime < threshold) {
        staleSchemas.push(schema);
      }
    }

    return staleSchemas;
  }

  // Private helper methods
  _estimateMemoryUsage() {
    // Rough estimation - in production you might want a more accurate measurement
    return `~${this.tenantModels.size * 50}KB (estimated)`;
  }

  _getOldestCacheTime() {
    if (this.loadedAt.size === 0) return null;
    return new Date(Math.min(...Array.from(this.loadedAt.values())));
  }

  _getNewestCacheTime() {
    if (this.loadedAt.size === 0) return null;
    return new Date(Math.max(...Array.from(this.loadedAt.values())));
  }
}

// Export singleton instance
module.exports = new TenantCacheService();