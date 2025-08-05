const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');

module.exports = function initModels(sequelize, schema) {
  const db = {};
  const tenantModelsPath = path.join(__dirname, 'tenant');

  fs.readdirSync(tenantModelsPath)
    .filter(file => file.endsWith('.js'))
    .forEach(file => {
      const model = require(path.join(tenantModelsPath, file))(
        sequelize,
        Sequelize.DataTypes,
        schema // Pass the tenant schema here
      );
      db[model.name] = model;
    });

  Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
      db[modelName].associate(db);
    }
  });

  return db;
};

