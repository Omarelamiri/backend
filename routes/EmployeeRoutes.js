// routes/employeeRoutes.js
const express = require('express');
const router = express.Router();
const EmployeeController = require('../controllers/EmployeeController');
const tenantMiddleware = require('../middlewares/tenantMiddleware');
const jwtMiddleware = require('../middlewares/jwtMiddleware');
const rbac = require('../middlewares/rbacMiddleware');
const { validate, sanitize } = require('../middlewares/validationMiddleware');
const { 
  EmployeeValidationRules, 
  customEmployeeValidations, 
  employeeSanitization 
} = require('../middlewares/validation/employeeValidation');

// Apply tenant middleware to all employee routes
router.use(tenantMiddleware);

// Apply JWT authentication to all routes
router.use(jwtMiddleware);

// Apply general sanitization to all routes
router.use(sanitize.trim);
router.use(sanitize.xss);

// Apply employee-specific sanitization
router.use(employeeSanitization.sanitizeSensitiveData);
router.use(employeeSanitization.formatDates);

// Employee management routes with proper validation and RBAC

/**
 * GET /api/employees
 * Get all employees with filtering, sorting, and pagination
 * Access: Manager+ (can view all), Users (limited view)
 */
router.get('/', 
  rbac.manager,
  validate(EmployeeValidationRules.query.list),
  EmployeeController.getAllEmployees
);

/**
 * POST /api/employees/search
 * Advanced employee search
 * Access: Manager+ only
 */
router.post('/search',
  rbac.manager,
  validate(EmployeeValidationRules.query.search),
  EmployeeController.searchEmployees
);

/**
 * GET /api/employees/stats
 * Get employee statistics for dashboard
 * Access: Manager+ only
 */
router.get('/stats',
  rbac.manager,
  EmployeeController.getEmployeeStats
);

/**
 * GET /api/employees/my-profile
 * Get current user's employee profile (self-service)
 * Access: All authenticated users
 */
router.get('/my-profile',
  rbac.user,
  EmployeeController.getMyProfile
);

/**
 * PUT /api/employees/my-profile
 * Update current user's employee profile (self-service)
 * Access: All authenticated users
 */
router.put('/my-profile',
  rbac.user,
  validate(EmployeeValidationRules.profileUpdate),
  EmployeeController.updateMyProfile
);

/**
 * POST /api/employees
 * Create new employee
 * Access: Admin only
 */
router.post('/', 
  rbac.admin,
  validate([
    ...EmployeeValidationRules.create,
    // Add dynamic validations that need tenant context
    (req, res, next) => {
      const { Employee } = req.tenant.models;
      return Promise.all([
        customEmployeeValidations.uniqueEmployeeEmail(Employee)(req, res, () => {}),
        customEmployeeValidations.uniqueEmployeeId(Employee)(req, res, () => {}),
        customEmployeeValidations.validManagerId(Employee)(req, res, () => {}),
        customEmployeeValidations.validTermination()(req, res, () => {}),
        customEmployeeValidations.validSalary()(req, res, () => {}),
        customEmployeeValidations.validAge()(req, res, () => {}),
        customEmployeeValidations.validProbation()(req, res, () => {})
      ]).then(() => next()).catch(next);
    }
  ]),
  EmployeeController.createEmployee
);

/**
 * GET /api/employees/department/:department
 * Get employees by department
 * Access: Manager+ only
 */
router.get('/department/:department',
  rbac.manager,
  validate(EmployeeValidationRules.params.department),
  EmployeeController.getEmployeesByDepartment
);

/**
 * GET /api/employees/manager/:managerId/reports
 * Get direct reports for a manager
 * Access: Manager+ or the specific manager themselves
 */
router.get('/manager/:managerId/reports',
  validate(EmployeeValidationRules.params.managerId),
  EmployeeController.getDirectReports
);

/**
 * GET /api/employees/:employeeId
 * Get specific employee details
 * Access: Owner or Manager+ (different data visibility levels)
 */
router.get('/:employeeId', 
  validate(EmployeeValidationRules.params.employeeId),
  rbac.ownerOrManager,
  EmployeeController.getEmployeeById
);

/**
 * PUT /api/employees/:employeeId
 * Update employee details
 * Access: Owner (limited fields) or Admin (full access)
 */
router.put('/:employeeId', 
  validate([
    ...EmployeeValidationRules.update,
    // Add dynamic validations for updates
    (req, res, next) => {
      const { Employee } = req.tenant.models;
      return Promise.all([
        customEmployeeValidations.uniqueEmployeeEmail(Employee, req.params.employeeId)(req, res, () => {}),
        customEmployeeValidations.uniqueEmployeeId(Employee, req.params.employeeId)(req, res, () => {}),
        customEmployeeValidations.validManagerId(Employee)(req, res, () => {}),
        customEmployeeValidations.validTermination()(req, res, () => {}),
        customEmployeeValidations.validSalary()(req, res, () => {}),
        customEmployeeValidations.validAge()(req, res, () => {}),
        customEmployeeValidations.validProbation()(req, res, () => {})
      ]).then(() => next()).catch(next);
    }
  ]),
  rbac.ownerOrAdmin,
  EmployeeController.updateEmployee
);

/**
 * DELETE /api/employees/:employeeId
 * Soft delete employee
 * Access: Admin only
 */
router.delete('/:employeeId', 
  rbac.admin,
  validate(EmployeeValidationRules.params.employeeId),
  EmployeeController.deleteEmployee
);

/**
 * PATCH /api/employees/:employeeId/status
 * Update employee status (active, inactive, terminated, etc.)
 * Access: Admin only
 */
router.patch('/:employeeId/status', 
  rbac.admin,
  validate(EmployeeValidationRules.updateStatus),
  EmployeeController.updateEmployeeStatus
);

// Additional utility routes

/**
 * GET /api/employees/:employeeId/reports
 * Get all direct and indirect reports for an employee (org chart)
 * Access: Manager+ or the specific employee
 */
router.get('/:employeeId/reports',
  validate(EmployeeValidationRules.params.employeeId),
  async (req, res, next) => {
    // Custom RBAC: Allow managers+ or the specific employee to view their org chart
    const canView = ['admin', 'manager'].includes(req.user.role) || 
                   parseInt(req.params.employeeId) === req.user.userId;
    
    if (!canView) {
      return res.status(403).json({
        error: 'Insufficient permissions to view organizational chart',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }
    
    next();
  },
  EmployeeController.getDirectReports
);

/**
 * POST /api/employees/bulk-import
 * Bulk import employees from CSV/JSON
 * Access: Admin only
 * TODO: Implement bulk import functionality
 */
router.post('/bulk-import',
  rbac.admin,
  (req, res) => {
    res.status(501).json({
      error: 'Bulk import functionality not yet implemented',
      code: 'NOT_IMPLEMENTED',
      message: 'This feature will be available in a future release'
    });
  }
);

/**
 * GET /api/employees/export/csv
 * Export employees data as CSV
 * Access: Manager+ only
 * TODO: Implement CSV export functionality
 */
router.get('/export/csv',
  rbac.manager,
  (req, res) => {
    res.status(501).json({
      error: 'CSV export functionality not yet implemented',
      code: 'NOT_IMPLEMENTED',
      message: 'This feature will be available in a future release'
    });
  }
);

/**
 * POST /api/employees/:employeeId/photo
 * Upload employee profile photo
 * Access: Owner or Admin
 * TODO: Implement file upload functionality
 */
router.post('/:employeeId/photo',
  validate(EmployeeValidationRules.params.employeeId),
  rbac.ownerOrAdmin,
  (req, res) => {
    res.status(501).json({
      error: 'Photo upload functionality not yet implemented',
      code: 'NOT_IMPLEMENTED',
      message: 'This feature will be available in a future release'
    });
  }
);

// Error handling middleware for employee routes
router.use((error, req, res, next) => {
  // Log employee-specific errors
  console.error(`Employee API Error [${req.method} ${req.path}]:`, {
    error: error.message,
    tenant: req.tenant?.name,
    user: req.user?.email,
    employeeId: req.params?.employeeId
  });
  
  next(error);
});

module.exports = router;