const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters'],
  },
  email: {
    type: String,
    unique: true,
    sparse: true, // Allow null for OAuth users without email conflict
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email',
    ],
  },
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters'],
    select: false,
  },
  // GitHub OAuth fields
  githubId: {
    type: String,
    unique: true,
    sparse: true,
  },
  githubUsername: {
    type: String,
  },
  githubAccessToken: {
    type: String,
    select: false,
  },
  githubRefreshToken: {
    type: String,
    select: false,
  },
  avatar: {
    type: String,
    default: '',
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    default: '',
  },
  skills: [
    {
      type: String,
      trim: true,
    },
  ],
  provider: {
    type: String,
    enum: ['local', 'github', 'google'],
    default: 'local',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastLogin: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving (only for local provider)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || this.provider !== 'local') {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.githubAccessToken;
  delete user.githubRefreshToken;
  return user;
};

module.exports = mongoose.model('User', userSchema);
