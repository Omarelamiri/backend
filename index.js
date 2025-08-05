// index.js - DEBUG VERSION
require('dotenv').config();
const express = require('express');
const app = express();

// Import config and models
const sequelize = require('./config/config');
const { Tenant } = require('./models')(sequelize);

// Parse incoming JSON
app.use(express.json());

// Health check route
app.get('/', (req, res) => {
  res.json({ message: 'Business-in-a-Box API is running 🚀' });
});

// Basic tenant routes only (to test)
const tenantRoutes = require('./routes/TenantRoutes');
app.use('/api/tenants', tenantRoutes);

console.log('✅ Basic routes loaded successfully');


const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err.stack);
  res.status(err.status || 500).json({ 
    message: err.message || 'Internal Server Error'
  });
});

// Start server
const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    await Tenant.sync();
    console.log('✅ Global models synchronized.');

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📋 Available endpoints:`);
      console.log(`   GET  /                     - Health check`);
      console.log(`   POST /api/tenants          - Create tenant`);
      console.log(`   GET  /api/tenants          - List tenants`);
    });

  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
})();