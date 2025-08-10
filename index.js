// index.js - Enhanced with better error handling and validation
require('dotenv').config();
const express = require('express');
const app = express();

// Import config and models
const sequelize = require('./config/config');
const { Tenant } = require('./models')(sequelize);

// Import error handling middleware
const { errorHandler, notFoundHandler, asyncHandler } = require('./middlewares/errorHandler');

// Parse incoming JSON with size limits
app.use(express.json({ 
  limit: '10mb',
  strict: true
}));

// Parse URL-encoded data
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Request logging middleware (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`, {
      tenant: req.headers['x-tenant-id'],
      body: req.method !== 'GET' ? req.body : undefined
    });
    next();
  });
}

// Health check route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Business-in-a-Box API is running 🚀',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
const tenantRoutes = require('./routes/TenantRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const employeeRoutes = require('./routes/EmployeeRoutes');

app.use('/api/tenants', tenantRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/employees', employeeRoutes);

console.log('✅ All routes loaded successfully');

// API documentation endpoint (development only)
if (process.env.NODE_ENV === 'development') {
  app.get('/api/docs', (req, res) => {
    res.json({
      title: 'Business-in-a-Box API Documentation',
      version: '1.0.0',
      endpoints: {
        tenants: {
          'POST /api/tenants': {
            description: 'Create a new tenant',
            body: {
              name: 'string (required, 2-50 chars, alphanumeric + _ -)',
              contactEmail: 'string (optional, valid email)',
              createdBy: 'string (optional, max 50 chars)'
            },
            headers: {
              'Content-Type': 'application/json'
            }
          },
          'GET /api/tenants': {
            description: 'List all tenants',
            query: {
              page: 'integer (optional, min 1)',
              limit: 'integer (optional, 1-100)',
              sort: 'string (optional, asc|desc)',
              sortBy: 'string (optional, field name)'
            }
          }
        },
        auth: {
          'POST /api/auth/register': {
            description: 'Register a new user',
            headers: {
              'x-tenant-id': 'string (required)',
              'Content-Type': 'application/json'
            },
            body: {
              fullName: 'string (required, 2-100 chars)',
              email: 'string (required, valid email)',
              password: 'string (required, 8+ chars, complex)',
              role: 'string (optional, admin|user|manager)'
            }
          },
          'POST /api/auth/login': {
            description: 'Login user',
            headers: {
              'x-tenant-id': 'string (required)',
              'Content-Type': 'application/json'
            },
            body: {
              email: 'string (required)',
              password: 'string (required)'
            }
          },
          'GET /api/auth/profile': {
            description: 'Get current user profile',
            headers: {
              'x-tenant-id': 'string (required)',
              'Authorization': 'Bearer <token> (required)'
            }
          }
        },
        users: {
          'GET /api/users': {
            description: 'List all users (Manager+ only)',
            headers: {
              'x-tenant-id': 'string (required)',
              'Authorization': 'Bearer <token> (required)'
            },
            query: {
              page: 'integer (optional)',
              limit: 'integer (optional)',
              sort: 'string (optional)',
              sortBy: 'string (optional)'
            }
          },
          'POST /api/users': {
            description: 'Create user (Admin only)',
            headers: {
              'x-tenant-id': 'string (required)',
              'Authorization': 'Bearer <token> (required)'
            },
            body: {
              fullName: 'string (required)',
              email: 'string (required)',
              password: 'string (required)',
              role: 'string (optional)'
            }
          }
        },
        employees: {
          'GET /api/employees': {
            description: 'List employees with filtering and pagination',
            headers: {
              'x-tenant-id': 'string (required)',
              'Authorization': 'Bearer <token> (required)'
            },
            query: {
              page: 'integer (optional)',
              limit: 'integer (optional, max 100)',
              search: 'string (optional)',
              department: 'string (optional)',
              employmentStatus: 'string (optional)',
              employmentType: 'string (optional)',
              managerId: 'integer (optional)',
              sortBy: 'string (optional)',
              sortOrder: 'string (optional, ASC|DESC)',
              includeInactive: 'boolean (optional)'
            }
          },
          'POST /api/employees': {
            description: 'Create new employee (Admin only)',
            headers: {
              'x-tenant-id': 'string (required)',
              'Authorization': 'Bearer <token> (required)'
            },
            body: {
              firstName: 'string (required)',
              lastName: 'string (required)',
              email: 'string (required)',
              jobTitle: 'string (required)',
              hireDate: 'string (required, YYYY-MM-DD)',
              department: 'string (optional)',
              employmentType: 'string (optional)',
              salary: 'number (optional)',
              // ... other optional fields
            }
          },
          'GET /api/employees/:id': {
            description: 'Get employee details',
            access: 'Owner or Manager+'
          },
          'PUT /api/employees/:id': {
            description: 'Update employee',
            access: 'Owner (limited) or Admin (full)'
          },
          'DELETE /api/employees/:id': {
            description: 'Delete employee (Admin only)'
          },
          'GET /api/employees/my-profile': {
            description: 'Get own employee profile'
          },
          'PUT /api/employees/my-profile': {
            description: 'Update own profile (limited fields)'
          },
          'GET /api/employees/stats': {
            description: 'Get employee statistics (Manager+ only)'
          }
        }
      },
      errorCodes: {
        'VALIDATION_ERROR': 'Request validation failed',
        'AUTH_REQUIRED': 'Authentication required',
        'INSUFFICIENT_ROLE': 'Insufficient permissions',
        'TENANT_NOT_FOUND': 'Tenant not found',
        'USER_NOT_FOUND': 'User not found',
        'DUPLICATE_ENTRY': 'Resource already exists',
        'DATABASE_ERROR': 'Database operation failed',
        'RATE_LIMIT_EXCEEDED': 'Too many requests'
      }
    });
  });
}

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Starting graceful shutdown...');
  server.close(() => {
    console.log('HTTP server closed.');
    sequelize.close().then(() => {
      console.log('Database connection closed.');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Starting graceful shutdown...');
  server.close(() => {
    console.log('HTTP server closed.');
    sequelize.close().then(() => {
      console.log('Database connection closed.');
      process.exit(0);
    });
  });
});

// Start server
const PORT = process.env.PORT || 3000;

const startServer = asyncHandler(async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    // Sync global models
    await Tenant.sync();
    console.log('✅ Global models synchronized.');

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📋 Available endpoints:`);
      console.log(`   GET  /                     - Health check`);
      console.log(`   GET  /api/docs             - API documentation (dev only)`);
      console.log(`   POST /api/tenants          - Create tenant`);
      console.log(`   GET  /api/tenants          - List tenants`);
      console.log(`   POST /api/auth/register    - Register user`);
      console.log(`   POST /api/auth/login       - Login user`);
      console.log(`   GET  /api/auth/profile     - Get profile`);
      console.log(`   GET  /api/users            - List users`);
      console.log(`   POST /api/users            - Create user`);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
      }
    });

    // Store server instance for graceful shutdown
    app.locals.server = server;

  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
});

// Start the server
startServer();