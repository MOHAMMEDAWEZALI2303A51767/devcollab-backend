const mongoose = require('mongoose');

const boardSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Project ID is required'],
  },
  name: {
    type: String,
    required: [true, 'Board name is required'],
    trim: true,
    maxlength: [100, 'Board name cannot exceed 100 characters'],
  },
  order: {
    type: Number,
    default: 0,
  },
  color: {
    type: String,
    default: '#3b82f6',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for faster queries
boardSchema.index({ projectId: 1 });
boardSchema.index({ projectId: 1, order: 1 });

module.exports = mongoose.model('Board', boardSchema);
