const { Project, Workspace, WorkspaceMember, Board, Task, Notification } = require('../models');
const { asyncHandler, createNotification } = require('../utils');

// @desc    Create a new project
// @route   POST /api/projects
// @access  Private
const createProject = asyncHandler(async (req, res) => {
  const { workspaceId, name, description } = req.body;

  // Check if workspace exists
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found');
  }

  // Check if user is a member of the workspace
  const membership = await WorkspaceMember.findOne({
    workspaceId,
    userId: req.user._id,
  });

  if (!membership) {
    res.status(403);
    throw new Error('Not authorized to create projects in this workspace');
  }

  // Create project
  const project = await Project.create({
    workspaceId,
    name,
    description: description || '',
    members: [
      {
        user: req.user._id,
        role: 'lead',
      },
    ],
  });

  // Populate and return
  const populatedProject = await Project.findById(project._id).populate(
    'members.user',
    'name email avatar'
  );

  res.status(201).json({
    success: true,
    data: populatedProject,
  });
});

// @desc    Get all projects in a workspace
// @route   GET /api/projects/workspace/:workspaceId
// @access  Private
const getProjectsByWorkspace = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;

  // Check if workspace exists
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found');
  }

  // Check if user is a member of the workspace
  const membership = await WorkspaceMember.findOne({
    workspaceId,
    userId: req.user._id,
  });

  if (!membership) {
    res.status(403);
    throw new Error('Not authorized to access this workspace');
  }

  const projects = await Project.find({ workspaceId })
    .populate('members.user', 'name email avatar')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    count: projects.length,
    data: projects,
  });
});

// @desc    Get single project
// @route   GET /api/projects/:id
// @access  Private
const getProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id)
    .populate('members.user', 'name email avatar')
    .populate('workspaceId', 'name owner');

  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  // Check if user is a member of the workspace or project
  const isProjectMember = project.members.some(
    (m) => m.user._id.toString() === req.user._id.toString()
  );

  const workspaceMembership = await WorkspaceMember.findOne({
    workspaceId: project.workspaceId._id,
    userId: req.user._id,
  });

  if (!isProjectMember && !workspaceMembership) {
    res.status(403);
    throw new Error('Not authorized to access this project');
  }

  res.json({
    success: true,
    data: project,
  });
});

// @desc    Update project
// @route   PUT /api/projects/:id
// @access  Private
const updateProject = asyncHandler(async (req, res) => {
  const { name, description, status } = req.body;

  let project = await Project.findById(req.params.id);

  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  // Check if user is project lead or workspace admin/owner
  const isLead = project.members.some(
    (m) => m.user.toString() === req.user._id.toString() && m.role === 'lead'
  );

  const workspaceMembership = await WorkspaceMember.findOne({
    workspaceId: project.workspaceId,
    userId: req.user._id,
  });

  if (!isLead && !['owner', 'admin'].includes(workspaceMembership?.role)) {
    res.status(403);
    throw new Error('Not authorized to update this project');
  }

  project = await Project.findByIdAndUpdate(
    req.params.id,
    {
      name: name || project.name,
      description: description !== undefined ? description : project.description,
      status: status || project.status,
    },
    { new: true, runValidators: true }
  ).populate('members.user', 'name email avatar');

  res.json({
    success: true,
    data: project,
  });
});

// @desc    Delete project
// @route   DELETE /api/projects/:id
// @access  Private
const deleteProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);

  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  // Check if user is project lead or workspace owner
  const isLead = project.members.some(
    (m) => m.user.toString() === req.user._id.toString() && m.role === 'lead'
  );

  const workspace = await Workspace.findById(project.workspaceId);
  const isWorkspaceOwner = workspace.owner.toString() === req.user._id.toString();

  if (!isLead && !isWorkspaceOwner) {
    res.status(403);
    throw new Error('Not authorized to delete this project');
  }

  // Delete all related data
  const boards = await Board.find({ projectId: project._id });
  const boardIds = boards.map((b) => b._id);

  await Task.deleteMany({ boardId: { $in: boardIds } });
  await Board.deleteMany({ projectId: project._id });
  await project.deleteOne();

  res.json({
    success: true,
    message: 'Project deleted successfully',
  });
});

// @desc    Add member to project
// @route   POST /api/projects/:id/members
// @access  Private
const addProjectMember = asyncHandler(async (req, res) => {
  const { userId, role = 'developer' } = req.body;

  const project = await Project.findById(req.params.id);

  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  // Check if user is project lead or workspace admin/owner
  const isLead = project.members.some(
    (m) => m.user.toString() === req.user._id.toString() && m.role === 'lead'
  );

  const workspaceMembership = await WorkspaceMember.findOne({
    workspaceId: project.workspaceId,
    userId: req.user._id,
  });

  if (!isLead && !['owner', 'admin'].includes(workspaceMembership?.role)) {
    res.status(403);
    throw new Error('Not authorized to add members to this project');
  }

  // Check if user is already a member
  const isAlreadyMember = project.members.some(
    (m) => m.user.toString() === userId
  );

  if (isAlreadyMember) {
    res.status(400);
    throw new Error('User is already a member of this project');
  }

  // Check if user is a workspace member
  const userWorkspaceMembership = await WorkspaceMember.findOne({
    workspaceId: project.workspaceId,
    userId,
  });

  if (!userWorkspaceMembership) {
    res.status(400);
    throw new Error('User must be a workspace member first');
  }

  project.members.push({
    user: userId,
    role,
  });

  await project.save();

  // Create notification
  await createNotification({
    userId,
    type: 'project_added',
    text: `You have been added to project "${project.name}"`,
    data: {
      projectId: project._id,
      workspaceId: project.workspaceId,
      senderId: req.user._id,
    },
  });

  const populatedProject = await Project.findById(project._id).populate(
    'members.user',
    'name email avatar'
  );

  res.json({
    success: true,
    data: populatedProject,
  });
});

// @desc    Remove member from project
// @route   DELETE /api/projects/:id/members/:userId
// @access  Private
const removeProjectMember = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);

  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  // Check if user is project lead or workspace admin/owner
  const isLead = project.members.some(
    (m) => m.user.toString() === req.user._id.toString() && m.role === 'lead'
  );

  const workspaceMembership = await WorkspaceMember.findOne({
    workspaceId: project.workspaceId,
    userId: req.user._id,
  });

  if (!isLead && !['owner', 'admin'].includes(workspaceMembership?.role)) {
    res.status(403);
    throw new Error('Not authorized to remove members from this project');
  }

  // Cannot remove lead
  const memberToRemove = project.members.find(
    (m) => m.user.toString() === req.params.userId
  );

  if (memberToRemove?.role === 'lead') {
    res.status(400);
    throw new Error('Cannot remove project lead');
  }

  project.members = project.members.filter(
    (m) => m.user.toString() !== req.params.userId
  );

  await project.save();

  res.json({
    success: true,
    message: 'Member removed successfully',
  });
});

module.exports = {
  createProject,
  getProjectsByWorkspace,
  getProject,
  updateProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
};
