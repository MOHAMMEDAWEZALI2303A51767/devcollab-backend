const {
  Workspace,
  WorkspaceMember,
  User,
  Project,
  Board,
  Task,
  Notification,
} = require('../models');
const { asyncHandler, createNotification } = require('../utils');

// @desc    Create a new workspace
// @route   POST /api/workspaces
// @access  Private
const createWorkspace = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  // Create workspace
  const workspace = await Workspace.create({
    name,
    description: description || '',
    owner: req.user._id,
  });

  // Add creator as owner in workspace members
  await WorkspaceMember.create({
    workspaceId: workspace._id,
    userId: req.user._id,
    role: 'owner',
  });

  res.status(201).json({
    success: true,
    data: workspace,
  });
});

// @desc    Get all workspaces for logged in user
// @route   GET /api/workspaces
// @access  Private
const getWorkspaces = asyncHandler(async (req, res) => {
  // Get workspace memberships
  const memberships = await WorkspaceMember.find({
    userId: req.user._id,
  }).populate({
    path: 'workspaceId',
    populate: {
      path: 'owner',
      select: 'name email avatar',
    },
  });

  const workspaces = memberships.map((membership) => ({
    ...membership.workspaceId.toObject(),
    role: membership.role,
  }));

  res.json({
    success: true,
    count: workspaces.length,
    data: workspaces,
  });
});

// @desc    Get single workspace
// @route   GET /api/workspaces/:id
// @access  Private
const getWorkspace = asyncHandler(async (req, res) => {
  const workspace = await Workspace.findById(req.params.id).populate(
    'owner',
    'name email avatar'
  );

  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found');
  }

  // Check if user is a member
  const membership = await WorkspaceMember.findOne({
    workspaceId: workspace._id,
    userId: req.user._id,
  });

  if (!membership) {
    res.status(403);
    throw new Error('Not authorized to access this workspace');
  }

  res.json({
    success: true,
    data: {
      ...workspace.toObject(),
      role: membership.role,
    },
  });
});

// @desc    Update workspace
// @route   PUT /api/workspaces/:id
// @access  Private
const updateWorkspace = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  let workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found');
  }

  // Check if user is owner or admin
  const membership = await WorkspaceMember.findOne({
    workspaceId: workspace._id,
    userId: req.user._id,
  });

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    res.status(403);
    throw new Error('Not authorized to update this workspace');
  }

  workspace = await Workspace.findByIdAndUpdate(
    req.params.id,
    {
      name: name || workspace.name,
      description: description !== undefined ? description : workspace.description,
    },
    { new: true, runValidators: true }
  );

  res.json({
    success: true,
    data: workspace,
  });
});

// @desc    Delete workspace
// @route   DELETE /api/workspaces/:id
// @access  Private
const deleteWorkspace = asyncHandler(async (req, res) => {
  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found');
  }

  // Only owner can delete
  if (workspace.owner.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Only workspace owner can delete the workspace');
  }

  // Delete all related data
  await WorkspaceMember.deleteMany({ workspaceId: workspace._id });
  
  // Get all projects in workspace
  const projects = await Project.find({ workspaceId: workspace._id });
  const projectIds = projects.map((p) => p._id);
  
  // Get all boards in projects
  const boards = await Board.find({ projectId: { $in: projectIds } });
  const boardIds = boards.map((b) => b._id);
  
  // Delete tasks in boards
  await Task.deleteMany({ boardId: { $in: boardIds } });
  
  // Delete boards
  await Board.deleteMany({ projectId: { $in: projectIds } });
  
  // Delete projects
  await Project.deleteMany({ workspaceId: workspace._id });
  
  // Delete workspace
  await workspace.deleteOne();

  res.json({
    success: true,
    message: 'Workspace deleted successfully',
  });
});

// @desc    Invite member to workspace
// @route   POST /api/workspaces/:id/invite
// @access  Private
const inviteMember = asyncHandler(async (req, res) => {
  const { email, role = 'member' } = req.body;

  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found');
  }

  // Check if user is owner or admin
  const membership = await WorkspaceMember.findOne({
    workspaceId: workspace._id,
    userId: req.user._id,
  });

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    res.status(403);
    throw new Error('Not authorized to invite members');
  }

  // Find user by email
  const userToInvite = await User.findOne({ email });

  if (!userToInvite) {
    res.status(404);
    throw new Error('User not found with this email');
  }

  // Check if already a member
  const existingMembership = await WorkspaceMember.findOne({
    workspaceId: workspace._id,
    userId: userToInvite._id,
  });

  if (existingMembership) {
    res.status(400);
    throw new Error('User is already a member of this workspace');
  }

  // Add member
  await WorkspaceMember.create({
    workspaceId: workspace._id,
    userId: userToInvite._id,
    role,
  });

  // Create notification for invited user
  await createNotification({
    userId: userToInvite._id,
    type: 'workspace_invite',
    text: `You have been invited to join "${workspace.name}" workspace`,
    data: {
      workspaceId: workspace._id,
      senderId: req.user._id,
    },
  });

  res.status(201).json({
    success: true,
    message: 'Member invited successfully',
  });
});

// @desc    Get workspace members
// @route   GET /api/workspaces/:id/members
// @access  Private
const getWorkspaceMembers = asyncHandler(async (req, res) => {
  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found');
  }

  // Check if user is a member
  const userMembership = await WorkspaceMember.findOne({
    workspaceId: workspace._id,
    userId: req.user._id,
  });

  if (!userMembership) {
    res.status(403);
    throw new Error('Not authorized to access this workspace');
  }

  const members = await WorkspaceMember.find({
    workspaceId: workspace._id,
  }).populate('userId', 'name email avatar bio skills');

  res.json({
    success: true,
    count: members.length,
    data: members.map((m) => ({
      _id: m.userId._id,
      name: m.userId.name,
      email: m.userId.email,
      avatar: m.userId.avatar,
      bio: m.userId.bio,
      skills: m.userId.skills,
      role: m.role,
      joinedAt: m.joinedAt,
    })),
  });
});

// @desc    Remove member from workspace
// @route   DELETE /api/workspaces/:id/members/:userId
// @access  Private
const removeMember = asyncHandler(async (req, res) => {
  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found');
  }

  // Check if user is owner or admin
  const membership = await WorkspaceMember.findOne({
    workspaceId: workspace._id,
    userId: req.user._id,
  });

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    res.status(403);
    throw new Error('Not authorized to remove members');
  }

  // Cannot remove owner
  if (workspace.owner.toString() === req.params.userId) {
    res.status(400);
    throw new Error('Cannot remove workspace owner');
  }

  await WorkspaceMember.findOneAndDelete({
    workspaceId: workspace._id,
    userId: req.params.userId,
  });

  res.json({
    success: true,
    message: 'Member removed successfully',
  });
});

module.exports = {
  createWorkspace,
  getWorkspaces,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  inviteMember,
  getWorkspaceMembers,
  removeMember,
};
