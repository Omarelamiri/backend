const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');

module.exports = (sequelize) => {
  const db = {};
  const globalModelsPath = path.join(__dirname, 'global');

  fs.readdirSync(globalModelsPath)
    .filter(file => file.endsWith('.js'))
    .forEach(file => {
      const model = require(path.join(globalModelsPath, file))(
        sequelize,
        Sequelize.DataTypes
      );
      db[model.name] = model;
    });

  // Setup associations if defined
  Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
      db[modelName].associate(db);
    }
  });

  return db;
};
