// services/UserService.js
async function getAllUsers(UserModel) {
  try {
    return await UserModel.findAll();
  } catch (err) {
    throw new Error(`Failed to fetch users: ${err.message}`);
  }
}

async function createUser(UserModel, userData) {
  try {
    // Basic validation example
    if (!userData.email || !userData.password) {
      throw new Error('Email and password are required');
    }
    return await UserModel.create(userData);
  } catch (err) {
    throw new Error(`Failed to create user: ${err.message}`);
  }
}

module.exports = {
  getAllUsers,
  createUser,
};
