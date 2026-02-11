const mongoose = require('mongoose');

const workspaceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Workspace name is required'],
    trim: true,
    maxlength: [100, 'Workspace name cannot exceed 100 characters'],
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Workspace owner is required'],
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for faster queries
workspaceSchema.index({ owner: 1 });

module.exports = mongoose.model('Workspace', workspaceSchema);
