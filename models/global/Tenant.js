const { DataTypes } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Tenant', {
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        is: /^[a-zA-Z0-9_-]+$/i, // Only letters, numbers, underscores, hyphens
        notEmpty: true,
      }
    },
    schema: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        is: /^[a-z0-9_]+$/, // Lowercase letters, numbers, underscores
        notEmpty: true,
      }
    },
    contactEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: { isEmail: true }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    planType: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    createdBy: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
  }, {
    timestamps: true,
    tableName: 'tenants',
    schema: 'public' 
  });
};