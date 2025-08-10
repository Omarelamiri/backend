const { DataTypes } = require('sequelize');

module.exports = (sequelize, DataTypes, schema) => {
  const Employee = sequelize.define('Employee', {
    // Basic Information
    employeeId: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [2, 20]
      }
    },
    firstName: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 50],
        is: /^[a-zA-Z\s'-]+$/
      }
    },
    lastName: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 50],
        is: /^[a-zA-Z\s'-]+$/
      }
    },
    middleName: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        len: [0, 50],
        is: /^[a-zA-Z\s'-]*$/
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true
      }
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        len: [0, 20]
      }
    },
    personalEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true
      }
    },

    // Employment Details
    jobTitle: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 100]
      }
    },
    department: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [0, 100]
      }
    },
    managerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'employees',
        key: 'id'
      }
    },
    employmentType: {
      type: DataTypes.ENUM('full-time', 'part-time', 'contract', 'intern', 'temporary'),
      allowNull: false,
      defaultValue: 'full-time'
    },
    employmentStatus: {
      type: DataTypes.ENUM('active', 'inactive', 'terminated', 'on-leave', 'probation'),
      allowNull: false,
      defaultValue: 'active'
    },
    
    // Dates
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: true,
        isBefore: new Date().toISOString().split('T')[0] // Must be in the past
      }
    },
    hireDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: true,
        notEmpty: true
      }
    },
    terminationDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: true,
        isAfterHireDate(value) {
          if (value && this.hireDate && new Date(value) <= new Date(this.hireDate)) {
            throw new Error('Termination date must be after hire date');
          }
        }
      }
    },
    probationEndDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: true
      }
    },

    // Compensation
    salary: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 999999999.99
      }
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: true,
      defaultValue: 'USD',
      validate: {
        len: [3, 3],
        isUppercase: true
      }
    },
    payFrequency: {
      type: DataTypes.ENUM('weekly', 'bi-weekly', 'monthly', 'annually'),
      allowNull: true,
      defaultValue: 'monthly'
    },

    // Address Information
    address: {
      type: DataTypes.JSONB,
      allowNull: true,
      validate: {
        isValidAddress(value) {
          if (value) {
            const required = ['street', 'city', 'country'];
            const missing = required.filter(field => !value[field]);
            if (missing.length > 0) {
              throw new Error(`Address missing required fields: ${missing.join(', ')}`);
            }
          }
        }
      }
    },

    // Emergency Contact
    emergencyContact: {
      type: DataTypes.JSONB,
      allowNull: true,
      validate: {
        isValidEmergencyContact(value) {
          if (value) {
            const required = ['name', 'relationship', 'phone'];
            const missing = required.filter(field => !value[field]);
            if (missing.length > 0) {
              throw new Error(`Emergency contact missing required fields: ${missing.join(', ')}`);
            }
          }
        }
      }
    },

    // Additional Information
    gender: {
      type: DataTypes.ENUM('male', 'female', 'other', 'prefer-not-to-say'),
      allowNull: true
    },
    maritalStatus: {
      type: DataTypes.ENUM('single', 'married', 'divorced', 'widowed', 'prefer-not-to-say'),
      allowNull: true
    },
    nationality: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [0, 100]
      }
    },
    
    // HR Specific Fields
    socialSecurityNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        len: [0, 20]
      }
    },
    taxId: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        len: [0, 50]
      }
    },
    
    // System Fields
    profilePicture: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },

    // Soft Delete
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    schema,
    tableName: 'employees',
    timestamps: true,
    paranoid: true, // Enables soft delete
    
    indexes: [
      {
        unique: true,
        fields: ['employeeId']
      },
      {
        unique: true,
        fields: ['email']
      },
      {
        fields: ['employmentStatus']
      },
      {
        fields: ['department']
      },
      {
        fields: ['managerId']
      },
      {
        fields: ['hireDate']
      }
    ],

    hooks: {
      beforeValidate: (employee, options) => {
        // Auto-generate employee ID if not provided
        if (!employee.employeeId) {
          const timestamp = Date.now().toString().slice(-6);
          const random = Math.random().toString(36).substring(2, 5).toUpperCase();
          employee.employeeId = `EMP${timestamp}${random}`;
        }
        
        // Ensure email is lowercase
        if (employee.email) {
          employee.email = employee.email.toLowerCase();
        }
        if (employee.personalEmail) {
          employee.personalEmail = employee.personalEmail.toLowerCase();
        }
      },

      beforeUpdate: (employee, options) => {
        // Automatically set termination date when status changes to terminated
        if (employee.changed('employmentStatus') && employee.employmentStatus === 'terminated' && !employee.terminationDate) {
          employee.terminationDate = new Date().toISOString().split('T')[0];
        }
      }
    }
  });

  // Define associations
  Employee.associate = function(models) {
    // Self-referencing association for manager
    Employee.belongsTo(models.Employee, {
      as: 'Manager',
      foreignKey: 'managerId'
    });
    
    Employee.hasMany(models.Employee, {
      as: 'DirectReports',
      foreignKey: 'managerId'
    });

    // Future associations (uncomment when you create these models)
    /*
    Employee.hasMany(models.Leave, {
      foreignKey: 'employeeId',
      as: 'LeaveRequests'
    });
    
    Employee.belongsTo(models.Department, {
      foreignKey: 'departmentId',
      as: 'Department'
    });
    
    Employee.hasMany(models.Payroll, {
      foreignKey: 'employeeId',
      as: 'PayrollRecords'
    });
    */
  };

  // Instance methods
  Employee.prototype.getFullName = function() {
    const parts = [this.firstName];
    if (this.middleName) parts.push(this.middleName);
    parts.push(this.lastName);
    return parts.join(' ');
  };

  Employee.prototype.getAge = function() {
    if (!this.dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(this.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  Employee.prototype.getTenure = function() {
    if (!this.hireDate) return null;
    const today = new Date();
    const hireDate = new Date(this.hireDate);
    const diffTime = Math.abs(today - hireDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return {
      days: diffDays,
      years: Math.floor(diffDays / 365),
      months: Math.floor((diffDays % 365) / 30)
    };
  };

  Employee.prototype.isActive = function() {
    return this.employmentStatus === 'active';
  };

  Employee.prototype.toSafeJSON = function() {
    const values = Object.assign({}, this.get());
    // Remove sensitive fields for API responses
    delete values.socialSecurityNumber;
    delete values.taxId;
    delete values.salary;
    return values;
  };

  return Employee;
};