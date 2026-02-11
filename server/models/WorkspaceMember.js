const mongoose = require('mongoose');

const workspaceMemberSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: [true, 'Workspace ID is required'],
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
  },
  role: {
    type: String,
    enum: ['owner', 'admin', 'member'],
    default: 'member',
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index to prevent duplicate memberships
workspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

// Index for faster queries
workspaceMemberSchema.index({ workspaceId: 1 });
workspaceMemberSchema.index({ userId: 1 });

module.exports = mongoose.model('WorkspaceMember', workspaceMemberSchema);
