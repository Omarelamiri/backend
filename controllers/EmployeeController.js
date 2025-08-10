// controllers/EmployeeController.js
const EmployeeService = require('../services/EmployeeService');
const { APIError } = require('../middlewares/errorHandler');

module.exports = {
  /**
   * Get all employees with filtering and pagination
   */
  async getAllEmployees(req, res, next) {
    try {
      const { Employee } = req.tenant.models;
      
      const options = {
        page: req.query.page,
        limit: req.query.limit,
        search: req.query.search,
        department: req.query.department,
        employmentStatus: req.query.employmentStatus,
        employmentType: req.query.employmentType,
        managerId: req.query.managerId,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder,
        includeInactive: req.query.includeInactive === 'true'
      };

      const result = await EmployeeService.getAllEmployees(Employee, options);

      res.json({
        success: true,
        message: `Retrieved ${result.employees.length} employees`,
        data: result,
        tenant: {
          id: req.tenant.id,
          name: req.tenant.name
        }
      });

    } catch (error) {
      next(new APIError(error.message, 500, 'EMPLOYEE_FETCH_ERROR'));
    }
  },

  /**
   * Get employee by ID
   */
  async getEmployeeById(req, res, next) {
    try {
      const { Employee } = req.tenant.models;
      const { employeeId } = req.params;

      // Determine if user can view sensitive data
      const canViewSensitive = req.user.role === 'admin' || 
                              parseInt(employeeId) === req.user.userId;

      const employee = await EmployeeService.getEmployeeById(
        Employee, 
        employeeId, 
        canViewSensitive
      );

      res.json({
        success: true,
        message: 'Employee retrieved successfully',
        data: { employee },
        tenant: {
          id: req.tenant.id,
          name: req.tenant.name
        }
      });

    } catch (error) {
      if (error.message === 'Employee not found') {
        next(new APIError('Employee not found', 404, 'EMPLOYEE_NOT_FOUND'));
      } else {
        next(new APIError(error.message, 500, 'EMPLOYEE_FETCH_ERROR'));
      }
    }
  },

  /**
   * Create new employee
   */
  async createEmployee(req, res, next) {
    try {
      const { Employee } = req.tenant.models;
      
      const employeeData = {
        ...req.body,
        // Add metadata for audit trail
        metadata: {
          ...req.body.metadata,
          createdBy: req.user.email,
          createdByRole: req.user.role,
          createdAt: new Date().toISOString()
        }
      };

      const employee = await EmployeeService.createEmployee(Employee, employeeData);

      res.status(201).json({
        success: true,
        message: 'Employee created successfully',
        data: { employee },
        createdBy: req.user.email,
        tenant: {
          id: req.tenant.id,
          name: req.tenant.name
        }
      });

    } catch (error) {
      if (error.message.includes('already exists')) {
        next(new APIError(error.message, 409, 'DUPLICATE_EMPLOYEE'));
      } else if (error.message.includes('Validation failed')) {
        next(new APIError(error.message, 400, 'VALIDATION_ERROR'));
      } else {
        next(new APIError(error.message, 500, 'EMPLOYEE_CREATE_ERROR'));
      }
    }
  },

  /**
   * Update employee
   */
  async updateEmployee(req, res, next) {
    try {
      const { Employee } = req.tenant.models;
      const { employeeId } = req.params;

      // Check permissions - only admins or managers can update employee details
      // Employees can only update their own basic info
      const canUpdateFull = ['admin', 'manager'].includes(req.user.role);
      const isOwnRecord = parseInt(employeeId) === req.user.userId;

      if (!canUpdateFull && !isOwnRecord) {
        return next(new APIError('Insufficient permissions to update employee', 403, 'INSUFFICIENT_PERMISSIONS'));
      }

      let updateData = { ...req.body };

      // Restrict fields for non-admin users
      if (!canUpdateFull) {
        const allowedFields = [
          'phone', 'personalEmail', 'address', 'emergencyContact', 
          'profilePicture'
        ];
        
        updateData = Object.keys(updateData)
          .filter(key => allowedFields.includes(key))
          .reduce((obj, key) => {
            obj[key] = updateData[key];
            return obj;
          }, {});
      }

      // Add metadata for audit trail
      updateData.metadata = {
        ...req.body.metadata,
        lastUpdatedBy: req.user.email,
        lastUpdatedByRole: req.user.role,
        lastUpdatedAt: new Date().toISOString()
      };

      const employee = await EmployeeService.updateEmployee(Employee, employeeId, updateData);

      res.json({
        success: true,
        message: 'Employee updated successfully',
        data: { employee },
        updatedBy: req.user.email,
        tenant: {
          id: req.tenant.id,
          name: req.tenant.name
        }
      });

    } catch (error) {
      if (error.message === 'Employee not found') {
        next(new APIError('Employee not found', 404, 'EMPLOYEE_NOT_FOUND'));
      } else if (error.message.includes('already exists')) {
        next(new APIError(error.message, 409, 'DUPLICATE_EMPLOYEE'));
      } else if (error.message.includes('Validation failed')) {
        next(new APIError(error.message, 400, 'VALIDATION_ERROR'));
      } else {
        next(new APIError(error.message, 500, 'EMPLOYEE_UPDATE_ERROR'));
      }
    }
  },

  /**
   * Delete employee (soft delete)
   */
  async deleteEmployee(req, res, next) {
    try {
      const { Employee } = req.tenant.models;
      const { employeeId } = req.params;

      // Prevent self-deletion
      if (parseInt(employeeId) === req.user.userId) {
        return next(new APIError('Cannot delete your own employee record', 400, 'CANNOT_DELETE_SELF'));
      }

      await EmployeeService.deleteEmployee(Employee, employeeId);

      res.json({
        success: true,
        message: 'Employee deleted successfully',
        deletedBy: req.user.email,
        tenant: {
          id: req.tenant.id,
          name: req.tenant.name
        }
      });

    } catch (error) {
      if (error.message === 'Employee not found') {
        next(new APIError('Employee not found', 404, 'EMPLOYEE_NOT_FOUND'));
      } else if (error.message.includes('direct reports')) {
        next(new APIError(error.message, 400, 'EMPLOYEE_HAS_REPORTS'));
      } else {
        next(new APIError(error.message, 500, 'EMPLOYEE_DELETE_ERROR'));
      }
    }
  },

  /**
   * Update employee status
   */
  async updateEmployeeStatus(req, res, next) {
    try {
      const { Employee } = req.tenant.models;
      const { employeeId } = req.params;
      const { status } = req.body;

      // Prevent self-status change for termination
      if (parseInt(employeeId) === req.user.userId && status === 'terminated') {
        return next(new APIError('Cannot terminate your own employee record', 400, 'CANNOT_TERMINATE_SELF'));
      }

      const employee = await EmployeeService.updateEmployeeStatus(Employee, employeeId, status);

      res.json({
        success: true,
        message: `Employee status updated to ${status}`,
        data: { employee },
        updatedBy: req.user.email,
        tenant: {
          id: req.tenant.id,
          name: req.tenant.name
        }
      });

    } catch (error) {
      if (error.message === 'Employee not found') {
        next(new APIError('Employee not found', 404, 'EMPLOYEE_NOT_FOUND'));
      } else if (error.message.includes('Invalid status')) {
        next(new APIError(error.message, 400, 'INVALID_STATUS'));
      } else {
        next(new APIError(error.message, 500, 'EMPLOYEE_STATUS_UPDATE_ERROR'));
      }
    }
  },

  /**
   * Get employees by department
   */
  async getEmployeesByDepartment(req, res, next) {
    try {
      const { Employee } = req.tenant.models;
      const { department } = req.params;

      const employees = await EmployeeService.getEmployeesByDepartment(Employee, department);

      res.json({
        success: true,
        message: `Retrieved ${employees.length} employees from ${department} department`,
        data: { 
          department,
          employees,
          count: employees.length
        },
        tenant: {
          id: req.tenant.id,
          name: req.tenant.name
        }
      });

    } catch (error) {
      next(new APIError(error.message, 500, 'DEPARTMENT_FETCH_ERROR'));
    }
  },

  /**
   * Get direct reports for a manager
   */
  async getDirectReports(req, res, next) {
    try {
      const { Employee } = req.tenant.models;
      const { managerId } = req.params;

      // Check if user can view reports (admin, manager, or the manager themselves)
      const canViewReports = ['admin', 'manager'].includes(req.user.role) || 
                            parseInt(managerId) === req.user.userId;

      if (!canViewReports) {
        return next(new APIError('Insufficient permissions to view direct reports', 403, 'INSUFFICIENT_PERMISSIONS'));
      }

      const directReports = await EmployeeService.getDirectReports(Employee, managerId);

      res.json({
        success: true,
        message: `Retrieved ${directReports.length} direct reports`,
        data: { 
          managerId: parseInt(managerId),
          directReports,
          count: directReports.length
        },
        tenant: {
          id: req.tenant.id,
          name: req.tenant.name
        }
      });

    } catch (error) {
      next(new APIError(error.message, 500, 'DIRECT_REPORTS_FETCH_ERROR'));
    }
  },

  /**
   * Get employee statistics (dashboard)
   */
  async getEmployeeStats(req, res, next) {
    try {
      const { Employee } = req.tenant.models;

      const stats = await EmployeeService.getEmployeeStats(Employee);

      res.json({
        success: true,
        message: 'Employee statistics retrieved successfully',
        data: { stats },
        tenant: {
          id: req.tenant.id,
          name: req.tenant.name
        }
      });

    } catch (error) {
      next(new APIError(error.message, 500, 'EMPLOYEE_STATS_ERROR'));
    }
  },

  /**
   * Search employees (advanced search with multiple criteria)
   */
  async searchEmployees(req, res, next) {
    try {
      const { Employee } = req.tenant.models;
      
      const searchOptions = {
        ...req.query,
        search: req.query.q || req.query.search, // Support both 'q' and 'search' params
        page: req.query.page || 1,
        limit: Math.min(req.query.limit || 20, 50) // Cap search results
      };

      const result = await EmployeeService.getAllEmployees(Employee, searchOptions);

      res.json({
        success: true,
        message: `Found ${result.pagination.totalCount} employees matching search criteria`,
        data: result,
        searchQuery: req.query.q || req.query.search,
        tenant: {
          id: req.tenant.id,
          name: req.tenant.name
        }
      });

    } catch (error) {
      next(new APIError(error.message, 500, 'EMPLOYEE_SEARCH_ERROR'));
    }
  },

  /**
   * Get employee profile (for self-service)
   */
  async getMyProfile(req, res, next) {
    try {
      const { Employee } = req.tenant.models;
      
      // Get the employee record linked to the current user
      // Note: This assumes you link User and Employee models by email or add employeeId to User model
      const employee = await Employee.findOne({
        where: { email: req.user.email }
      });

      if (!employee) {
        return next(new APIError('Employee profile not found', 404, 'EMPLOYEE_PROFILE_NOT_FOUND'));
      }

      const profileData = await EmployeeService.getEmployeeById(Employee, employee.id, true);

      res.json({
        success: true,
        message: 'Employee profile retrieved successfully',
        data: { profile: profileData },
        tenant: {
          id: req.tenant.id,
          name: req.tenant.name
        }
      });

    } catch (error) {
      next(new APIError(error.message, 500, 'PROFILE_FETCH_ERROR'));
    }
  },

  /**
   * Update my profile (self-service)
   */
  async updateMyProfile(req, res, next) {
    try {
      const { Employee } = req.tenant.models;
      
      const employee = await Employee.findOne({
        where: { email: req.user.email }
      });

      if (!employee) {
        return next(new APIError('Employee profile not found', 404, 'EMPLOYEE_PROFILE_NOT_FOUND'));
      }

      // Only allow updating specific fields for self-service
      const allowedFields = [
        'phone', 'personalEmail', 'address', 'emergencyContact', 
        'profilePicture', 'maritalStatus'
      ];
      
      const updateData = Object.keys(req.body)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = req.body[key];
          return obj;
        }, {});

      if (Object.keys(updateData).length === 0) {
        return next(new APIError('No valid fields provided for update', 400, 'NO_VALID_FIELDS'));
      }

      const updatedEmployee = await EmployeeService.updateEmployee(Employee, employee.id, updateData);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { profile: updatedEmployee },
        tenant: {
          id: req.tenant.id,
          name: req.tenant.name
        }
      });

    } catch (error) {
      next(new APIError(error.message, 500, 'PROFILE_UPDATE_ERROR'));
    }
  }
};