const {
  Task,
  Board,
  Project,
  WorkspaceMember,
  Notification,
  User,
} = require('../models');
const { asyncHandler, createNotification } = require('../utils');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');
const fs = require('fs');

// @desc    Create a new task
// @route   POST /api/tasks
// @access  Private
const createTask = asyncHandler(async (req, res) => {
  const {
    boardId,
    title,
    description,
    assignedTo,
    dueDate,
    priority,
    labels,
  } = req.body;

  // Check if board exists
  const board = await Board.findById(boardId);
  if (!board) {
    res.status(404);
    throw new Error('Board not found');
  }

  const project = await Project.findById(board.projectId);

  // Check if user is a member of the workspace
  const membership = await WorkspaceMember.findOne({
    workspaceId: project.workspaceId,
    userId: req.user._id,
  });

  if (!membership) {
    res.status(403);
    throw new Error('Not authorized to create tasks in this board');
  }

  // Get the highest order number for this board
  const lastTask = await Task.findOne({ boardId }).sort({ order: -1 });
  const order = lastTask ? lastTask.order + 1 : 0;

  // Create task
  const task = await Task.create({
    boardId,
    title,
    description: description || '',
    assignedTo: assignedTo || null,
    dueDate: dueDate || null,
    priority: priority || 'medium',
    labels: labels || [],
    order,
    createdBy: req.user._id,
  });

  // Populate and return
  const populatedTask = await Task.findById(task._id)
    .populate('assignedTo', 'name email avatar')
    .populate('createdBy', 'name email avatar');

  // Create notification for assigned user
  if (assignedTo && assignedTo !== req.user._id.toString()) {
    await createNotification({
      userId: assignedTo,
      type: 'task_assigned',
      text: `You have been assigned to task "${title}"`,
      data: {
        taskId: task._id,
        projectId: project._id,
        workspaceId: project.workspaceId,
        senderId: req.user._id,
      },
    });
  }

  res.status(201).json({
    success: true,
    data: populatedTask,
  });
});

// @desc    Get all tasks for a board
// @route   GET /api/tasks/board/:boardId
// @access  Private
const getTasksByBoard = asyncHandler(async (req, res) => {
  const { boardId } = req.params;

  const board = await Board.findById(boardId);
  if (!board) {
    res.status(404);
    throw new Error('Board not found');
  }

  const project = await Project.findById(board.projectId);

  // Check if user is a member of the workspace
  const membership = await WorkspaceMember.findOne({
    workspaceId: project.workspaceId,
    userId: req.user._id,
  });

  if (!membership) {
    res.status(403);
    throw new Error('Not authorized to access this board');
  }

  const tasks = await Task.find({ boardId })
    .populate('assignedTo', 'name email avatar')
    .populate('createdBy', 'name email avatar')
    .sort({ order: 1 });

  res.json({
    success: true,
    count: tasks.length,
    data: tasks,
  });
});

// @desc    Get single task
// @route   GET /api/tasks/:id
// @access  Private
const getTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id)
    .populate('assignedTo', 'name email avatar')
    .populate('createdBy', 'name email avatar');

  if (!task) {
    res.status(404);
    throw new Error('Task not found');
  }

  const board = await Board.findById(task.boardId);
  const project = await Project.findById(board.projectId);

  // Check if user is a member of the workspace
  const membership = await WorkspaceMember.findOne({
    workspaceId: project.workspaceId,
    userId: req.user._id,
  });

  if (!membership) {
    res.status(403);
    throw new Error('Not authorized to access this task');
  }

  res.json({
    success: true,
    data: task,
  });
});

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
const updateTask = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    assignedTo,
    dueDate,
    status,
    priority,
    labels,
    boardId,
    order,
  } = req.body;

  let task = await Task.findById(req.params.id);

  if (!task) {
    res.status(404);
    throw new Error('Task not found');
  }

  const board = await Board.findById(task.boardId);
  const project = await Project.findById(board.projectId);

  // Check if user is a member of the workspace
  const membership = await WorkspaceMember.findOne({
    workspaceId: project.workspaceId,
    userId: req.user._id,
  });

  if (!membership) {
    res.status(403);
    throw new Error('Not authorized to update this task');
  }

  // Check if assignment changed
  const wasAssigned = task.assignedTo?.toString();
  const newAssigned = assignedTo;

  task = await Task.findByIdAndUpdate(
    req.params.id,
    {
      title: title || task.title,
      description: description !== undefined ? description : task.description,
      assignedTo: assignedTo !== undefined ? assignedTo : task.assignedTo,
      dueDate: dueDate !== undefined ? dueDate : task.dueDate,
      status: status || task.status,
      priority: priority || task.priority,
      labels: labels || task.labels,
      boardId: boardId || task.boardId,
      order: order !== undefined ? order : task.order,
    },
    { new: true, runValidators: true }
  )
    .populate('assignedTo', 'name email avatar')
    .populate('createdBy', 'name email avatar');

  // Create notification for new assignment
  if (newAssigned && newAssigned !== wasAssigned && newAssigned !== req.user._id.toString()) {
    await createNotification({
      userId: newAssigned,
      type: 'task_assigned',
      text: `You have been assigned to task "${task.title}"`,
      data: {
        taskId: task._id,
        projectId: project._id,
        workspaceId: project.workspaceId,
        senderId: req.user._id,
      },
    });
  }

  // Notify previous assignee of update
  if (wasAssigned && wasAssigned !== req.user._id.toString() && wasAssigned !== newAssigned) {
    await createNotification({
      userId: wasAssigned,
      type: 'task_updated',
      text: `Task "${task.title}" has been updated`,
      data: {
        taskId: task._id,
        projectId: project._id,
        workspaceId: project.workspaceId,
        senderId: req.user._id,
      },
    });
  }

  res.json({
    success: true,
    data: task,
  });
});

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private
const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    res.status(404);
    throw new Error('Task not found');
  }

  const board = await Board.findById(task.boardId);
  const project = await Project.findById(board.projectId);

  // Check if user is workspace admin/owner, project lead, or task creator
  const membership = await WorkspaceMember.findOne({
    workspaceId: project.workspaceId,
    userId: req.user._id,
  });

  const isLead = project.members.some(
    (m) => m.user.toString() === req.user._id.toString() && m.role === 'lead'
  );

  const isCreator = task.createdBy.toString() === req.user._id.toString();

  if (!['owner', 'admin'].includes(membership?.role) && !isLead && !isCreator) {
    res.status(403);
    throw new Error('Not authorized to delete this task');
  }

  // Delete attachments from Cloudinary
  if (task.attachments && task.attachments.length > 0) {
    for (const attachment of task.attachments) {
      if (attachment.publicId) {
        await deleteFromCloudinary(attachment.publicId);
      }
    }
  }

  await task.deleteOne();

  res.json({
    success: true,
    message: 'Task deleted successfully',
  });
});

// @desc    Move task to different board
// @route   PUT /api/tasks/:id/move
// @access  Private
const moveTask = asyncHandler(async (req, res) => {
  const { boardId, order } = req.body;

  let task = await Task.findById(req.params.id);

  if (!task) {
    res.status(404);
    throw new Error('Task not found');
  }

  const currentBoard = await Board.findById(task.boardId);
  const newBoard = await Board.findById(boardId);

  if (!newBoard) {
    res.status(404);
    throw new Error('Target board not found');
  }

  const project = await Project.findById(currentBoard.projectId);

  // Check if user is a member of the workspace
  const membership = await WorkspaceMember.findOne({
    workspaceId: project.workspaceId,
    userId: req.user._id,
  });

  if (!membership) {
    res.status(403);
    throw new Error('Not authorized to move this task');
  }

  task = await Task.findByIdAndUpdate(
    req.params.id,
    {
      boardId,
      order,
    },
    { new: true }
  )
    .populate('assignedTo', 'name email avatar')
    .populate('createdBy', 'name email avatar');

  res.json({
    success: true,
    data: task,
  });
});

// @desc    Add attachment to task
// @route   POST /api/tasks/:id/attachments
// @access  Private
const addAttachment = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    res.status(404);
    throw new Error('Task not found');
  }

  const board = await Board.findById(task.boardId);
  const project = await Project.findById(board.projectId);

  // Check if user is a member of the workspace
  const membership = await WorkspaceMember.findOne({
    workspaceId: project.workspaceId,
    userId: req.user._id,
  });

  if (!membership) {
    res.status(403);
    throw new Error('Not authorized to add attachments to this task');
  }

  if (!req.file) {
    res.status(400);
    throw new Error('Please upload a file');
  }

  // Upload to Cloudinary
  const result = await uploadToCloudinary(req.file.path, 'devcollab/attachments');

  // Delete local file
  fs.unlinkSync(req.file.path);

  // Add attachment to task
  task.attachments.push({
    name: req.file.originalname,
    url: result.url,
    publicId: result.publicId,
    uploadedBy: req.user._id,
  });

  await task.save();

  const populatedTask = await Task.findById(task._id)
    .populate('assignedTo', 'name email avatar')
    .populate('createdBy', 'name email avatar');

  res.json({
    success: true,
    data: populatedTask,
  });
});

// @desc    Remove attachment from task
// @route   DELETE /api/tasks/:id/attachments/:attachmentId
// @access  Private
const removeAttachment = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    res.status(404);
    throw new Error('Task not found');
  }

  const board = await Board.findById(task.boardId);
  const project = await Project.findById(board.projectId);

  // Check if user is a member of the workspace
  const membership = await WorkspaceMember.findOne({
    workspaceId: project.workspaceId,
    userId: req.user._id,
  });

  if (!membership) {
    res.status(403);
    throw new Error('Not authorized to remove attachments from this task');
  }

  const attachment = task.attachments.id(req.params.attachmentId);

  if (!attachment) {
    res.status(404);
    throw new Error('Attachment not found');
  }

  // Delete from Cloudinary
  if (attachment.publicId) {
    await deleteFromCloudinary(attachment.publicId);
  }

  // Remove attachment
  task.attachments.pull(req.params.attachmentId);
  await task.save();

  res.json({
    success: true,
    message: 'Attachment removed successfully',
  });
});

module.exports = {
  createTask,
  getTasksByBoard,
  getTask,
  updateTask,
  deleteTask,
  moveTask,
  addAttachment,
  removeAttachment,
};
