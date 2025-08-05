// middlewares/validationMiddleware.js
const { body, param, query, validationResult } = require('express-validator');

/**
 * Handle validation results and return formatted errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = {};
    const errorList = [];

    errors.array().forEach(error => {
      // Group errors by field
      if (!formattedErrors[error.path]) {
        formattedErrors[error.path] = [];
      }
      formattedErrors[error.path].push(error.msg);
      
      // Also create a simple list
      errorList.push({
        field: error.path,
        message: error.msg,
        value: error.value
      });
    });

    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: {
        fields: formattedErrors,
        errors: errorList,
        count: errorList.length
      }
    });
  }
  
  next();
};

/**
 * Common validation rules
 */
const ValidationRules = {
  // User validation rules
  user: {
    register: [
      body('fullName')
        .trim()
        .notEmpty()
        .withMessage('Full name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Full name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s'-]+$/)
        .withMessage('Full name can only contain letters, spaces, hyphens, and apostrophes'),

      body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail()
        .isLength({ max: 255 })
        .withMessage('Email cannot exceed 255 characters'),

      body('password')
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 8, max: 128 })
        .withMessage('Password must be between 8 and 128 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/)
        .withMessage('Password must contain at least one lowercase letter, uppercase letter, number, and special character')
        .custom((value) => {
          const commonPasswords = [
            'password', '123456789', 'qwerty', 'abc123', 'password123',
            'admin', 'letmein', 'welcome', '123456', '12345678'
          ];
          if (commonPasswords.includes(value.toLowerCase())) {
            throw new Error('Password is too common, please choose a stronger password');
          }
          return true;
        }),

      body('role')
        .optional()
        .isIn(['admin', 'user', 'manager'])
        .withMessage('Role must be one of: admin, user, manager')
        .default('user')
    ],

    login: [
      body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail(),

      body('password')
        .notEmpty()
        .withMessage('Password is required')
    ],

    updateProfile: [
      body('fullName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Full name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s'-]+$/)
        .withMessage('Full name can only contain letters, spaces, hyphens, and apostrophes'),

      body('email')
        .optional()
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail()
        .isLength({ max: 255 })
        .withMessage('Email cannot exceed 255 characters')
    ],

    changePassword: [
      body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),

      body('newPassword')
        .notEmpty()
        .withMessage('New password is required')
        .isLength({ min: 8, max: 128 })
        .withMessage('New password must be between 8 and 128 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/)
        .withMessage('New password must contain at least one lowercase letter, uppercase letter, number, and special character')
        .custom((value, { req }) => {
          if (value === req.body.currentPassword) {
            throw new Error('New password must be different from current password');
          }
          return true;
        })
    ],

    create: [
      body('fullName')
        .trim()
        .notEmpty()
        .withMessage('Full name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Full name must be between 2 and 100 characters'),

      body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail(),

      body('password')
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters'),

      body('role')
        .optional()
        .isIn(['admin', 'user', 'manager'])
        .withMessage('Role must be one of: admin, user, manager')
    ],

    update: [
      param('userId')
        .isInt({ min: 1 })
        .withMessage('User ID must be a positive integer'),

      body('fullName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Full name must be between 2 and 100 characters'),

      body('email')
        .optional()
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail(),

      body('role')
        .optional()
        .isIn(['admin', 'user', 'manager'])
        .withMessage('Role must be one of: admin, user, manager'),

      body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean value')
    ],

    toggleStatus: [
      param('userId')
        .isInt({ min: 1 })
        .withMessage('User ID must be a positive integer'),

      body('isActive')
        .notEmpty()
        .withMessage('isActive field is required')
        .isBoolean()
        .withMessage('isActive must be a boolean value')
    ]
  },

  // Tenant validation rules
  tenant: {
    create: [
      body('name')
        .trim()
        .notEmpty()
        .withMessage('Tenant name is required')
        .isLength({ min: 2, max: 50 })
        .withMessage('Tenant name must be between 2 and 50 characters')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Tenant name can only contain letters, numbers, underscores, and hyphens'),

      body('contactEmail')
        .optional()
        .trim()
        .isEmail()
        .withMessage('Please provide a valid contact email')
        .normalizeEmail(),

      body('createdBy')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('createdBy cannot exceed 50 characters')
    ]
  },

  // Common parameter validations
  params: {
    userId: [
      param('userId')
        .isInt({ min: 1 })
        .withMessage('User ID must be a positive integer')
    ],

    role: [
      param('role')
        .isIn(['admin', 'user', 'manager'])
        .withMessage('Role must be one of: admin, user, manager')
    ]
  },

  // Query parameter validations
  query: {
    pagination: [
      query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer')
        .toInt(),

      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
        .toInt(),

      query('sort')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Sort must be either "asc" or "desc"'),

      query('sortBy')
        .optional()
        .isLength({ min: 1, max: 50 })
        .withMessage('SortBy field name must be between 1 and 50 characters')
    ]
  }
};

/**
 * Validation middleware factory
 * Creates validation middleware with automatic error handling
 */
const validate = (rules) => {
  return [
    ...rules,
    handleValidationErrors
  ];
};

/**
 * Custom validation middleware for complex business logic
 */
const customValidations = {
  /**
   * Check if email is unique in tenant
   */
  uniqueEmail: (UserModel, excludeUserId = null) => {
    return body('email').custom(async (email, { req }) => {
      if (!email) return true; // Skip if email is empty (handled by other validators)

      const whereClause = { email: email.toLowerCase() };
      
      // Exclude current user when updating
      if (excludeUserId) {
        const userId = req.params.userId || excludeUserId;
        whereClause.id = { [require('sequelize').Op.ne]: userId };
      }

      const existingUser = await UserModel.findOne({ where: whereClause });
      
      if (existingUser) {
        throw new Error('Email is already registered');
      }
      
      return true;
    });
  },

  /**
   * Check if tenant name is unique
   */
  uniqueTenantName: (TenantModel) => {
    return body('name').custom(async (name) => {
      if (!name) return true;

      const existingTenant = await TenantModel.findOne({ 
        where: { name: name.toLowerCase() } 
      });
      
      if (existingTenant) {
        throw new Error('Tenant name is already taken');
      }
      
      return true;
    });
  },

  /**
   * Validate tenant header
   */
  tenantHeader: [
    query('tenant')
      .optional()
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Tenant ID format is invalid')
      .isLength({ max: 50 })
      .withMessage('Tenant ID cannot exceed 50 characters')
  ]
};

/**
 * Sanitization helpers
 */
const sanitize = {
  /**
   * Sanitize user input for XSS prevention
   */
  xss: (req, res, next) => {
    const xss = require('xss');
    
    const sanitizeObject = (obj) => {
      for (let key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = xss(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    };

    if (req.body) sanitizeObject(req.body);
    if (req.query) sanitizeObject(req.query);
    if (req.params) sanitizeObject(req.params);

    next();
  },

  /**
   * Trim whitespace from string fields
   */
  trim: (req, res, next) => {
    const trimObject = (obj) => {
      for (let key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = obj[key].trim();
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          trimObject(obj[key]);
        }
      }
    };

    if (req.body) trimObject(req.body);
    if (req.query) trimObject(req.query);

    next();
  }
};

module.exports = {
  ValidationRules,
  validate,
  customValidations,
  sanitize,
  handleValidationErrors
};