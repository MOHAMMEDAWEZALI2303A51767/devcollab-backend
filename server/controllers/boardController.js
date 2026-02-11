const { Board, Project, WorkspaceMember, Task } = require('../models');
const { asyncHandler } = require('../utils');

// @desc    Create a new board
// @route   POST /api/boards
// @access  Private
const createBoard = asyncHandler(async (req, res) => {
  const { projectId, name, color } = req.body;

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
    throw new Error('Not authorized to create boards in this project');
  }

  // Get the highest order number
  const lastBoard = await Board.findOne({ projectId }).sort({ order: -1 });
  const order = lastBoard ? lastBoard.order + 1 : 0;

  // Create board
  const board = await Board.create({
    projectId,
    name,
    color: color || '#3b82f6',
    order,
  });

  res.status(201).json({
    success: true,
    data: board,
  });
});

// @desc    Get all boards for a project
// @route   GET /api/boards/project/:projectId
// @access  Private
const getBoardsByProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

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
    throw new Error('Not authorized to access this project');
  }

  const boards = await Board.find({ projectId }).sort({ order: 1 });

  res.json({
    success: true,
    count: boards.length,
    data: boards,
  });
});

// @desc    Get single board with tasks
// @route   GET /api/boards/:id
// @access  Private
const getBoard = asyncHandler(async (req, res) => {
  const board = await Board.findById(req.params.id);

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

  // Get tasks for this board
  const tasks = await Task.find({ boardId: board._id })
    .populate('assignedTo', 'name email avatar')
    .populate('createdBy', 'name email avatar')
    .sort({ order: 1 });

  res.json({
    success: true,
    data: {
      ...board.toObject(),
      tasks,
    },
  });
});

// @desc    Update board
// @route   PUT /api/boards/:id
// @access  Private
const updateBoard = asyncHandler(async (req, res) => {
  const { name, color, order } = req.body;

  let board = await Board.findById(req.params.id);

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
    throw new Error('Not authorized to update this board');
  }

  board = await Board.findByIdAndUpdate(
    req.params.id,
    {
      name: name || board.name,
      color: color || board.color,
      order: order !== undefined ? order : board.order,
    },
    { new: true, runValidators: true }
  );

  res.json({
    success: true,
    data: board,
  });
});

// @desc    Delete board
// @route   DELETE /api/boards/:id
// @access  Private
const deleteBoard = asyncHandler(async (req, res) => {
  const board = await Board.findById(req.params.id);

  if (!board) {
    res.status(404);
    throw new Error('Board not found');
  }

  const project = await Project.findById(board.projectId);

  // Check if user is workspace admin/owner or project lead
  const membership = await WorkspaceMember.findOne({
    workspaceId: project.workspaceId,
    userId: req.user._id,
  });

  const isLead = project.members.some(
    (m) => m.user.toString() === req.user._id.toString() && m.role === 'lead'
  );

  if (!membership || (!['owner', 'admin'].includes(membership.role) && !isLead)) {
    res.status(403);
    throw new Error('Not authorized to delete this board');
  }

  // Delete all tasks in this board
  await Task.deleteMany({ boardId: board._id });

  // Delete the board
  await board.deleteOne();

  res.json({
    success: true,
    message: 'Board deleted successfully',
  });
});

// @desc    Reorder boards
// @route   PUT /api/boards/reorder/:projectId
// @access  Private
const reorderBoards = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { boardOrders } = req.body; // Array of { boardId, order }

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
    throw new Error('Not authorized to reorder boards in this project');
  }

  // Update board orders
  const updatePromises = boardOrders.map(({ boardId, order }) =>
    Board.findByIdAndUpdate(boardId, { order })
  );

  await Promise.all(updatePromises);

  const boards = await Board.find({ projectId }).sort({ order: 1 });

  res.json({
    success: true,
    data: boards,
  });
});

module.exports = {
  createBoard,
  getBoardsByProject,
  getBoard,
  updateBoard,
  deleteBoard,
  reorderBoards,
};
