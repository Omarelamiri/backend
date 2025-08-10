// services/EmployeeService.js
const { Op } = require('sequelize');

class EmployeeService {
  constructor() {
    this.defaultPageSize = 20;
    this.maxPageSize = 100;
  }

  /**
   * Get all employees with filtering, sorting, and pagination
   * @param {Object} EmployeeModel - Sequelize Employee model
   * @param {Object} options - Query options
   * @returns {Object} Paginated employees data
   */
  async getAllEmployees(EmployeeModel, options = {}) {
    try {
      const {
        page = 1,
        limit = this.defaultPageSize,
        search,
        department,
        employmentStatus,
        employmentType,
        managerId,
        sortBy = 'createdAt',
        sortOrder = 'DESC',
        includeInactive = false
      } = options;

      // Validate pagination
      const pageNum = Math.max(1, parseInt(page));
      const pageSize = Math.min(this.maxPageSize, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * pageSize;

      // Build where conditions
      const whereConditions = {};

      // Search across multiple fields
      if (search) {
        whereConditions[Op.or] = [
          { firstName: { [Op.iLike]: `%${search}%` } },
          { lastName: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } },
          { employeeId: { [Op.iLike]: `%${search}%` } },
          { jobTitle: { [Op.iLike]: `%${search}%` } }
        ];
      }

      // Filter by department
      if (department) {
        whereConditions.department = department;
      }

      // Filter by employment status
      if (employmentStatus) {
        whereConditions.employmentStatus = employmentStatus;
      } else if (!includeInactive) {
        // By default, exclude terminated employees
        whereConditions.employmentStatus = {
          [Op.ne]: 'terminated'
        };
      }

      // Filter by employment type
      if (employmentType) {
        whereConditions.employmentType = employmentType;
      }

      // Filter by manager
      if (managerId) {
        whereConditions.managerId = managerId;
      }

      // Validate sort field
      const allowedSortFields = [
        'firstName', 'lastName', 'email', 'employeeId', 'jobTitle',
        'department', 'hireDate', 'employmentStatus', 'createdAt', 'updatedAt'
      ];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
      const sortDirection = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

      const { count, rows } = await EmployeeModel.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: EmployeeModel,
            as: 'Manager',
            attributes: ['id', 'firstName', 'lastName', 'employeeId', 'jobTitle'],
            required: false
          }
        ],
        attributes: {
          exclude: ['socialSecurityNumber', 'taxId'] // Exclude sensitive data
        },
        order: [[sortField, sortDirection]],
        limit: pageSize,
        offset: offset,
        distinct: true
      });

      return {
        employees: rows,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(count / pageSize),
          pageSize: pageSize,
          totalCount: count,
          hasNext: pageNum < Math.ceil(count / pageSize),
          hasPrev: pageNum > 1
        },
        filters: {
          search,
          department,
          employmentStatus,
          employmentType,
          managerId,
          includeInactive
        },
        sort: {
          field: sortField,
          order: sortDirection
        }
      };

    } catch (error) {
      throw new Error(`Failed to fetch employees: ${error.message}`);
    }
  }

  /**
   * Get employee by ID with full details
   * @param {Object} EmployeeModel - Sequelize Employee model
   * @param {number} employeeId - Employee ID
   * @param {boolean} includeSensitive - Include sensitive data (admin only)
   * @returns {Object} Employee data
   */
  async getEmployeeById(EmployeeModel, employeeId, includeSensitive = false) {
    try {
      const attributes = includeSensitive 
        ? undefined // Include all fields
        : { exclude: ['socialSecurityNumber', 'taxId', 'salary'] };

      const employee = await EmployeeModel.findByPk(employeeId, {
        attributes,
        include: [
          {
            model: EmployeeModel,
            as: 'Manager',
            attributes: ['id', 'firstName', 'lastName', 'employeeId', 'jobTitle']
          },
          {
            model: EmployeeModel,
            as: 'DirectReports',
            attributes: ['id', 'firstName', 'lastName', 'employeeId', 'jobTitle', 'employmentStatus']
          }
        ]
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      // Add computed fields
      const employeeData = employee.toJSON();
      employeeData.fullName = employee.getFullName();
      employeeData.age = employee.getAge();
      employeeData.tenure = employee.getTenure();

      return employeeData;

    } catch (error) {
      throw new Error(`Failed to fetch employee: ${error.message}`);
    }
  }

  /**
   * Create new employee
   * @param {Object} EmployeeModel - Sequelize Employee model
   * @param {Object} employeeData - Employee data
   * @returns {Object} Created employee
   */
  async createEmployee(EmployeeModel, employeeData) {
    try {
      // Validate required fields
      const requiredFields = ['firstName', 'lastName', 'email', 'jobTitle', 'hireDate'];
      const missingFields = requiredFields.filter(field => !employeeData[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Check for duplicate email
      const existingEmployee = await EmployeeModel.findOne({
        where: { email: employeeData.email.toLowerCase() }
      });

      if (existingEmployee) {
        throw new Error('Employee with this email already exists');
      }

      // Check for duplicate employee ID if provided
      if (employeeData.employeeId) {
        const existingEmployeeId = await EmployeeModel.findOne({
          where: { employeeId: employeeData.employeeId }
        });

        if (existingEmployeeId) {
          throw new Error('Employee ID already exists');
        }
      }

      // Validate manager exists if provided
      if (employeeData.managerId) {
        const manager = await EmployeeModel.findByPk(employeeData.managerId);
        if (!manager) {
          throw new Error('Specified manager does not exist');
        }
      }

      const employee = await EmployeeModel.create(employeeData);

      // Return employee without sensitive data
      return this.getEmployeeById(EmployeeModel, employee.id, false);

    } catch (error) {
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => err.message);
        throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      }
      throw new Error(`Failed to create employee: ${error.message}`);
    }
  }

  /**
   * Update employee
   * @param {Object} EmployeeModel - Sequelize Employee model
   * @param {number} employeeId - Employee ID
   * @param {Object} updateData - Update data
   * @returns {Object} Updated employee
   */
  async updateEmployee(EmployeeModel, employeeId, updateData) {
    try {
      const employee = await EmployeeModel.findByPk(employeeId);
      
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Check for duplicate email (excluding current employee)
      if (updateData.email) {
        const existingEmployee = await EmployeeModel.findOne({
          where: { 
            email: updateData.email.toLowerCase(),
            id: { [Op.ne]: employeeId }
          }
        });

        if (existingEmployee) {
          throw new Error('Employee with this email already exists');
        }
      }

      // Check for duplicate employee ID (excluding current employee)
      if (updateData.employeeId) {
        const existingEmployeeId = await EmployeeModel.findOne({
          where: { 
            employeeId: updateData.employeeId,
            id: { [Op.ne]: employeeId }
          }
        });

        if (existingEmployeeId) {
          throw new Error('Employee ID already exists');
        }
      }

      // Validate manager exists if provided
      if (updateData.managerId) {
        const manager = await EmployeeModel.findByPk(updateData.managerId);
        if (!manager) {
          throw new Error('Specified manager does not exist');
        }

        // Prevent circular reference (employee cannot be their own manager)
        if (updateData.managerId === employeeId) {
          throw new Error('Employee cannot be their own manager');
        }
      }

      await employee.update(updateData);

      return this.getEmployeeById(EmployeeModel, employeeId, false);

    } catch (error) {
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => err.message);
        throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      }
      throw new Error(`Failed to update employee: ${error.message}`);
    }
  }

  /**
   * Soft delete employee
   * @param {Object} EmployeeModel - Sequelize Employee model
   * @param {number} employeeId - Employee ID
   * @returns {boolean} Success status
   */
  async deleteEmployee(EmployeeModel, employeeId) {
    try {
      const employee = await EmployeeModel.findByPk(employeeId);
      
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Check if employee has direct reports
      const directReports = await EmployeeModel.findAll({
        where: { managerId: employeeId }
      });

      if (directReports.length > 0) {
        throw new Error('Cannot delete employee with direct reports. Please reassign or remove direct reports first.');
      }

      // Soft delete
      await employee.destroy();

      return true;

    } catch (error) {
      throw new Error(`Failed to delete employee: ${error.message}`);
    }
  }

  /**
   * Update employee status
   * @param {Object} EmployeeModel - Sequelize Employee model
   * @param {number} employeeId - Employee ID
   * @param {string} status - New employment status
   * @returns {Object} Updated employee
   */
  async updateEmployeeStatus(EmployeeModel, employeeId, status) {
    try {
      const employee = await EmployeeModel.findByPk(employeeId);
      
      if (!employee) {
        throw new Error('Employee not found');
      }

      const validStatuses = ['active', 'inactive', 'terminated', 'on-leave', 'probation'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }

      const updateData = { employmentStatus: status };

      // Set termination date if terminating
      if (status === 'terminated' && !employee.terminationDate) {
        updateData.terminationDate = new Date().toISOString().split('T')[0];
      }

      await employee.update(updateData);

      return this.getEmployeeById(EmployeeModel, employeeId, false);

    } catch (error) {
      throw new Error(`Failed to update employee status: ${error.message}`);
    }
  }

  /**
   * Get employees by department
   * @param {Object} EmployeeModel - Sequelize Employee model
   * @param {string} department - Department name
   * @returns {Array} Employees in department
   */
  async getEmployeesByDepartment(EmployeeModel, department) {
    try {
      return await EmployeeModel.findAll({
        where: { 
          department,
          employmentStatus: { [Op.ne]: 'terminated' }
        },
        attributes: {
          exclude: ['socialSecurityNumber', 'taxId', 'salary']
        },
        order: [['firstName', 'ASC'], ['lastName', 'ASC']]
      });

    } catch (error) {
      throw new Error(`Failed to fetch employees by department: ${error.message}`);
    }
  }

  /**
   * Get direct reports for a manager
   * @param {Object} EmployeeModel - Sequelize Employee model
   * @param {number} managerId - Manager ID
   * @returns {Array} Direct reports
   */
  async getDirectReports(EmployeeModel, managerId) {
    try {
      return await EmployeeModel.findAll({
        where: { 
          managerId,
          employmentStatus: { [Op.ne]: 'terminated' }
        },
        attributes: {
          exclude: ['socialSecurityNumber', 'taxId', 'salary']
        },
        order: [['firstName', 'ASC'], ['lastName', 'ASC']]
      });

    } catch (error) {
      throw new Error(`Failed to fetch direct reports: ${error.message}`);
    }
  }

  /**
   * Get employee statistics for dashboard
   * @param {Object} EmployeeModel - Sequelize Employee model
   * @returns {Object} Employee statistics
   */
  async getEmployeeStats(EmployeeModel) {
    try {
      const [
        totalEmployees,
        activeEmployees,
        departmentStats,
        employmentTypeStats,
        recentHires
      ] = await Promise.all([
        // Total employees
        EmployeeModel.count(),
        
        // Active employees
        EmployeeModel.count({
          where: { employmentStatus: 'active' }
        }),
        
        // Department distribution
        EmployeeModel.findAll({
          attributes: [
            'department',
            [EmployeeModel.sequelize.fn('COUNT', EmployeeModel.sequelize.col('id')), 'count']
          ],
          where: { employmentStatus: { [Op.ne]: 'terminated' } },
          group: ['department'],
          raw: true
        }),
        
        // Employment type distribution
        EmployeeModel.findAll({
          attributes: [
            'employmentType',
            [EmployeeModel.sequelize.fn('COUNT', EmployeeModel.sequelize.col('id')), 'count']
          ],
          where: { employmentStatus: { [Op.ne]: 'terminated' } },
          group: ['employmentType'],
          raw: true
        }),
        
        // Recent hires (last 30 days)
        EmployeeModel.count({
          where: {
            hireDate: {
              [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        })
      ]);

      return {
        total: totalEmployees,
        active: activeEmployees,
        inactive: totalEmployees - activeEmployees,
        recentHires,
        departmentDistribution: departmentStats,
        employmentTypeDistribution: employmentTypeStats
      };

    } catch (error) {
      throw new Error(`Failed to fetch employee statistics: ${error.message}`);
    }
  }
}

module.exports = new EmployeeService();