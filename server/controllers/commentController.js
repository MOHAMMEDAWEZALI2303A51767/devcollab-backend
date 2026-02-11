const { Comment, Task, Board, Project, WorkspaceMember, User } = require('../models');
const { asyncHandler, createNotification } = require('../utils');

// @desc    Create a new comment
// @route   POST /api/comments/:taskId
// @access  Private
const createComment = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { text, mentions } = req.body;

  // Check if task exists
  const task = await Task.findById(taskId);
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
    throw new Error('Not authorized to comment on this task');
  }

  // Create comment
  const comment = await Comment.create({
    taskId,
    userId: req.user._id,
    text,
    mentions: mentions || [],
  });

  // Populate and return
  const populatedComment = await Comment.findById(comment._id).populate(
    'userId',
    'name email avatar'
  );

  // Create notifications for mentioned users
  if (mentions && mentions.length > 0) {
    for (const mentionedUserId of mentions) {
      if (mentionedUserId !== req.user._id.toString()) {
        await createNotification({
          userId: mentionedUserId,
          type: 'mention',
          text: `You were mentioned in a comment on task "${task.title}"`,
          data: {
            taskId: task._id,
            projectId: project._id,
            workspaceId: project.workspaceId,
            senderId: req.user._id,
          },
        });
      }
    }
  }

  // Notify task assignee
  if (task.assignedTo && task.assignedTo.toString() !== req.user._id.toString()) {
    const alreadyMentioned = mentions?.includes(task.assignedTo.toString());
    if (!alreadyMentioned) {
      await createNotification({
        userId: task.assignedTo,
        type: 'comment',
        text: `New comment on your task "${task.title}"`,
        data: {
          taskId: task._id,
          projectId: project._id,
          workspaceId: project.workspaceId,
          senderId: req.user._id,
        },
      });
    }
  }

  res.status(201).json({
    success: true,
    data: populatedComment,
  });
});

// @desc    Get all comments for a task
// @route   GET /api/comments/:taskId
// @access  Private
const getCommentsByTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  const task = await Task.findById(taskId);
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

  const comments = await Comment.find({ taskId })
    .populate('userId', 'name email avatar')
    .populate('mentions', 'name email avatar')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    count: comments.length,
    data: comments,
  });
});

// @desc    Update comment
// @route   PUT /api/comments/:id
// @access  Private
const updateComment = asyncHandler(async (req, res) => {
  const { text, mentions } = req.body;

  let comment = await Comment.findById(req.params.id);

  if (!comment) {
    res.status(404);
    throw new Error('Comment not found');
  }

  // Only comment author can update
  if (comment.userId.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to update this comment');
  }

  comment = await Comment.findByIdAndUpdate(
    req.params.id,
    {
      text: text || comment.text,
      mentions: mentions || comment.mentions,
    },
    { new: true, runValidators: true }
  ).populate('userId', 'name email avatar');

  res.json({
    success: true,
    data: comment,
  });
});

// @desc    Delete comment
// @route   DELETE /api/comments/:id
// @access  Private
const deleteComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id);

  if (!comment) {
    res.status(404);
    throw new Error('Comment not found');
  }

  const task = await Task.findById(comment.taskId);
  const board = await Board.findById(task.boardId);
  const project = await Project.findById(board.projectId);

  // Check if user is comment author, workspace admin/owner, or project lead
  const isAuthor = comment.userId.toString() === req.user._id.toString();

  const membership = await WorkspaceMember.findOne({
    workspaceId: project.workspaceId,
    userId: req.user._id,
  });

  const isLead = project.members.some(
    (m) => m.user.toString() === req.user._id.toString() && m.role === 'lead'
  );

  if (!isAuthor && !['owner', 'admin'].includes(membership?.role) && !isLead) {
    res.status(403);
    throw new Error('Not authorized to delete this comment');
  }

  await comment.deleteOne();

  res.json({
    success: true,
    message: 'Comment deleted successfully',
  });
});

module.exports = {
  createComment,
  getCommentsByTask,
  updateComment,
  deleteComment,
};
