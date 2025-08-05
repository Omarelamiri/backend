// controllers/UserController.js
const UserService = require('../services/UserService');
const AuthService = require('../services/AuthService');

module.exports = {
  async getAllUsers(req, res, next) {
    try {
      const { User } = req.tenant.models;
      const users = await UserService.getAllUsers(User);
      res.json(users);
    } catch (err) {
      next(err);
    }
  },

  async createUser(req, res, next) {
    try {
      const { User } = req.tenant.models;
      const { fullName, email, password, role = 'user' } = req.body;

      // Input validation
      if (!fullName || !email || !password) {
        return res.status(400).json({
          error: 'Full name, email, and password are required'
        });
      }

      // Validate email format
      if (!AuthService.validateEmail(email)) {
        return res.status(400).json({
          error: 'Invalid email format'
        });
      }

      // Validate password strength
      const passwordValidation = AuthService.validatePassword(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          error: 'Password does not meet requirements',
          details: passwordValidation.errors
        });
      }

      // Validate role
      const validRoles = ['admin', 'user', 'manager'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          error: 'Invalid role. Must be: admin, user, or manager'
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({
        where: { email: email.toLowerCase() }
      });

      if (existingUser) {
        return res.status(409).json({
          error: 'User with this email already exists'
        });
      }

      // Hash password
      const hashedPassword = await AuthService.hashPassword(password);

      // Create user
      const userData = {
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role,
        isActive: true
      };

      const user = await UserService.createUser(User, userData);

      // Response (don't include password)
      const userResponse = {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      };

      res.status(201).json({
        message: 'User created successfully',
        user: userResponse,
        createdBy: req.user.email
      });

    } catch (err) {
      if (err.message.includes('unique constraint')) {
        return res.status(409).json({ error: 'Email already exists' });
      }
      next(err);
    }
  },

  async getUserById(req, res, next) {
    try {
      const { User } = req.tenant.models;
      const { userId } = req.params;

      const user = await User.findByPk(userId, {
        attributes: ['id', 'fullName', 'email', 'role', 'isActive', 'lastLogin', 'createdAt', 'updatedAt']
      });

      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      res.json({ user });

    } catch (err) {
      next(err);
    }
  },

  async updateUser(req, res, next) {
    try {
      const { User } = req.tenant.models;
      const { userId } = req.params;
      const { fullName, email, role, isActive } = req.body;

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      const updateData = {};

      // Update full name
      if (fullName && fullName.trim() !== user.fullName) {
        updateData.fullName = fullName.trim();
      }

      // Update email
      if (email && email.toLowerCase().trim() !== user.email) {
        if (!AuthService.validateEmail(email)) {
          return res.status(400).json({
            error: 'Invalid email format'
          });
        }

        // Check if email is already taken
        const existingUser = await User.findOne({
          where: { 
            email: email.toLowerCase().trim(),
            id: { [require('sequelize').Op.ne]: userId }
          }
        });

        if (existingUser) {
          return res.status(409).json({
            error: 'Email is already taken'
          });
        }

        updateData.email = email.toLowerCase().trim();
      }

      // Update role (only admins can change roles)
      if (role && role !== user.role && req.user.role === 'admin') {
        const validRoles = ['admin', 'user', 'manager'];
        if (!validRoles.includes(role)) {
          return res.status(400).json({
            error: 'Invalid role. Must be: admin, user, or manager'
          });
        }
        updateData.role = role;
      }

      // Update status (only admins can change status)
      if (typeof isActive === 'boolean' && isActive !== user.isActive && req.user.role === 'admin') {
        updateData.isActive = isActive;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          error: 'No valid fields to update'
        });
      }

      await user.update(updateData);

      const updatedUser = {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        updatedAt: user.updatedAt
      };

      res.json({
        message: 'User updated successfully',
        user: updatedUser,
        updatedBy: req.user.email
      });

    } catch (err) {
      next(err);
    }
  },

  async deleteUser(req, res, next) {
    try {
      const { User } = req.tenant.models;
      const { userId } = req.params;

      // Prevent self-deletion
      if (parseInt(userId) === req.user.userId) {
        return res.status(400).json({
          error: 'Cannot delete your own account'
        });
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      await user.destroy();

      res.json({
        message: 'User deleted successfully',
        deletedUser: {
          id: user.id,
          email: user.email,
          fullName: user.fullName
        },
        deletedBy: req.user.email
      });

    } catch (err) {
      next(err);
    }
  },

  async toggleUserStatus(req, res, next) {
    try {
      const { User } = req.tenant.models;
      const { userId } = req.params;
      const { isActive } = req.body;

      // Prevent self-deactivation
      if (parseInt(userId) === req.user.userId) {
        return res.status(400).json({
          error: 'Cannot change your own account status'
        });
      }

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          error: 'isActive must be a boolean value'
        });
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      await user.update({ isActive });

      res.json({
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          isActive: user.isActive
        },
        updatedBy: req.user.email
      });

    } catch (err) {
      next(err);
    }
  },

  async getUsersByRole(req, res, next) {
    try {
      const { User } = req.tenant.models;
      const { role } = req.params;

      const validRoles = ['admin', 'user', 'manager'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          error: 'Invalid role. Must be: admin, user, or manager'
        });
      }

      const users = await User.findAll({
        where: { role },
        attributes: ['id', 'fullName', 'email', 'role', 'isActive', 'lastLogin', 'createdAt'],
        order: [['createdAt', 'DESC']]
      });

      res.json({
        role,
        count: users.length,
        users
      });

    } catch (err) {
      next(err);
    }
  }
};