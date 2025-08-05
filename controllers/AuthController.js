// controllers/AuthController.js
const AuthService = require('../services/AuthService');

module.exports = {
  /**
   * Register a new user in the current tenant
   */
  async register(req, res, next) {
    try {
      const { fullName, email, password, role = 'user' } = req.body;
      const { User } = req.tenant.models;

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
      const user = await User.create({
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role,
        isActive: true
      });

      // Update last login
      await user.update({ lastLogin: new Date() });

      // Create session data
      const sessionData = AuthService.createUserSession(user, req.tenant);

      // Generate JWT token
      const token = AuthService.generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: req.tenant.id,
        tenantName: req.tenant.name
      });

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
        message: 'User registered successfully',
        user: userResponse,
        token,
        tenant: {
          id: req.tenant.id,
          name: req.tenant.name
        }
      });

    } catch (err) {
      console.error('Registration error:', err);
      next(err);
    }
  },

  /**
   * Login user
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const { User } = req.tenant.models;

      // Input validation
      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password are required'
        });
      }

      // Find user by email
      const user = await User.findOne({
        where: { 
          email: email.toLowerCase().trim() 
        }
      });

      if (!user) {
        return res.status(401).json({
          error: 'Invalid email or password'
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({
          error: 'Account is inactive. Please contact administrator.'
        });
      }

      // Verify password
      const isPasswordValid = await AuthService.comparePassword(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          error: 'Invalid email or password'
        });
      }

      // Update last login
      await user.update({ lastLogin: new Date() });

      // Create session data
      const sessionData = AuthService.createUserSession(user, req.tenant);

      // Generate JWT token
      const token = AuthService.generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: req.tenant.id,
        tenantName: req.tenant.name
      });

      // Response (don't include password)
      const userResponse = {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        lastLogin: user.lastLogin
      };

      res.json({
        message: 'Login successful',
        user: userResponse,
        token,
        tenant: {
          id: req.tenant.id,
          name: req.tenant.name
        }
      });

    } catch (err) {
      console.error('Login error:', err);
      next(err);
    }
  },

  /**
   * Get current user profile
   */
  async profile(req, res, next) {
    try {
      const { User } = req.tenant.models;
      
      // req.user is set by JWT middleware
      const user = await User.findByPk(req.user.userId, {
        attributes: ['id', 'fullName', 'email', 'role', 'isActive', 'lastLogin', 'createdAt', 'updatedAt']
      });

      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      res.json({
        user,
        tenant: {
          id: req.tenant.id,
          name: req.tenant.name
        }
      });

    } catch (err) {
      console.error('Profile error:', err);
      next(err);
    }
  },

  /**
   * Update user profile
   */
  async updateProfile(req, res, next) {
    try {
      const { fullName, email } = req.body;
      const { User } = req.tenant.models;

      const user = await User.findByPk(req.user.userId);
      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      const updateData = {};

      if (fullName && fullName.trim() !== user.fullName) {
        updateData.fullName = fullName.trim();
      }

      if (email && email.toLowerCase().trim() !== user.email) {
        // Validate email format
        if (!AuthService.validateEmail(email)) {
          return res.status(400).json({
            error: 'Invalid email format'
          });
        }

        // Check if email is already taken
        const existingUser = await User.findOne({
          where: { 
            email: email.toLowerCase().trim(),
            id: { [require('sequelize').Op.ne]: user.id }
          }
        });

        if (existingUser) {
          return res.status(409).json({
            error: 'Email is already taken'
          });
        }

        updateData.email = email.toLowerCase().trim();
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
        message: 'Profile updated successfully',
        user: updatedUser
      });

    } catch (err) {
      console.error('Profile update error:', err);
      next(err);
    }
  },

  /**
   * Change password
   */
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const { User } = req.tenant.models;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          error: 'Current password and new password are required'
        });
      }

      const user = await User.findByPk(req.user.userId);
      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await AuthService.comparePassword(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(401).json({
          error: 'Current password is incorrect'
        });
      }

      // Validate new password
      const passwordValidation = AuthService.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          error: 'New password does not meet requirements',
          details: passwordValidation.errors
        });
      }

      // Hash new password
      const hashedNewPassword = await AuthService.hashPassword(newPassword);

      // Update password
      await user.update({ password: hashedNewPassword });

      res.json({
        message: 'Password changed successfully'
      });

    } catch (err) {
      console.error('Change password error:', err);
      next(err);
    }
  }
};