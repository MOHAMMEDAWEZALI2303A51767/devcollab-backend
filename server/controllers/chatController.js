const { Message, Project, WorkspaceMember, User } = require('../models');
const { asyncHandler, createNotification } = require('../utils');

// @desc    Get messages for a project
// @route   GET /api/chat/:projectId/messages
// @access  Private
const getMessages = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { page = 1, limit = 50 } = req.query;

  // Check if project exists
  const project = await Project.findById(projectId);
  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  // Check if user is a member of the workspace
  const membership = await WorkspaceMember.findOne({
    workspaceId: project.workspaceId,
    userId: req.user._id,
  });

  if (!membership) {
    res.status(403);
    throw new Error('Not authorized to access this project chat');
  }

  const messages = await Message.find({ projectId })
    .populate('senderId', 'name email avatar')
    .populate('mentions', 'name email avatar')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Message.countDocuments({ projectId });

  res.json({
    success: true,
    count: messages.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    data: messages.reverse(), // Return in chronological order
  });
});

// @desc    Send a message
// @route   POST /api/chat/:projectId/messages
// @access  Private
const sendMessage = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { text, mentions = [] } = req.body;

  // Check if project exists
  const project = await Project.findById(projectId);
  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  // Check if user is a member of the workspace
  const membership = await WorkspaceMember.findOne({
    workspaceId: project.workspaceId,
    userId: req.user._id,
  });

  if (!membership) {
    res.status(403);
    throw new Error('Not authorized to send messages in this project');
  }

  // Create message
  const message = await Message.create({
    projectId,
    senderId: req.user._id,
    text,
    mentions,
  });

  // Populate and return
  const populatedMessage = await Message.findById(message._id)
    .populate('senderId', 'name email avatar')
    .populate('mentions', 'name email avatar');

  // Create notifications for mentioned users
  if (mentions && mentions.length > 0) {
    for (const mentionedUserId of mentions) {
      if (mentionedUserId !== req.user._id.toString()) {
        await createNotification({
          userId: mentionedUserId,
          type: 'mention',
          text: `${req.user.name} mentioned you in ${project.name} chat`,
          data: {
            projectId: project._id,
            workspaceId: project.workspaceId,
            senderId: req.user._id,
          },
        });
      }
    }
  }

  res.status(201).json({
    success: true,
    data: populatedMessage,
  });
});

// @desc    Edit a message
// @route   PUT /api/chat/messages/:messageId
// @access  Private
const editMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { text } = req.body;

  const message = await Message.findById(messageId);

  if (!message) {
    res.status(404);
    throw new Error('Message not found');
  }

  // Only sender can edit
  if (message.senderId.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to edit this message');
  }

  // Can only edit within 15 minutes
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  if (message.createdAt < fifteenMinutesAgo) {
    res.status(400);
    throw new Error('Messages can only be edited within 15 minutes');
  }

  message.text = text;
  message.edited = true;
  message.editedAt = new Date();
  await message.save();

  const populatedMessage = await Message.findById(message._id)
    .populate('senderId', 'name email avatar')
    .populate('mentions', 'name email avatar');

  res.json({
    success: true,
    data: populatedMessage,
  });
});

// @desc    Delete a message
// @route   DELETE /api/chat/messages/:messageId
// @access  Private
const deleteMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  const message = await Message.findById(messageId);

  if (!message) {
    res.status(404);
    throw new Error('Message not found');
  }

  const project = await Project.findById(message.projectId);

  // Check if user is sender or workspace admin/owner
  const isSender = message.senderId.toString() === req.user._id.toString();

  const membership = await WorkspaceMember.findOne({
    workspaceId: project.workspaceId,
    userId: req.user._id,
  });

  if (!isSender && !['owner', 'admin'].includes(membership?.role)) {
    res.status(403);
    throw new Error('Not authorized to delete this message');
  }

  await message.deleteOne();

  res.json({
    success: true,
    message: 'Message deleted successfully',
  });
});

module.exports = {
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
};
