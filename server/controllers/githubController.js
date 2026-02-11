const axios = require('axios');
const { User, Project, WorkspaceMember } = require('../models');
const { asyncHandler, generateToken } = require('../utils');

// @desc    GitHub OAuth callback handler
// @route   GET /api/github/callback
// @access  Public
const githubCallback = asyncHandler(async (req, res) => {
  const { code } = req.query;

  if (!code) {
    res.status(400);
    throw new Error('Authorization code is required');
  }

  // Exchange code for access token
  const tokenResponse = await axios.post(
    'https://github.com/login/oauth/access_token',
    {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    },
    {
      headers: {
        Accept: 'application/json',
      },
    }
  );

  const { access_token, refresh_token } = tokenResponse.data;

  if (!access_token) {
    res.status(400);
    throw new Error('Failed to get access token from GitHub');
  }

  // Get user info from GitHub
  const userResponse = await axios.get('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });

  const githubUser = userResponse.data;

  // Check if user exists
  let user = await User.findOne({ githubId: githubUser.id.toString() });

  if (user) {
    // Update existing user
    user.githubAccessToken = access_token;
    if (refresh_token) user.githubRefreshToken = refresh_token;
    user.githubUsername = githubUser.login;
    user.avatar = githubUser.avatar_url;
    user.lastLogin = new Date();
    await user.save();
  } else {
    // Create new user
    user = await User.create({
      name: githubUser.name || githubUser.login,
      email: githubUser.email,
      githubId: githubUser.id.toString(),
      githubUsername: githubUser.login,
      githubAccessToken: access_token,
      githubRefreshToken: refresh_token,
      avatar: githubUser.avatar_url,
      bio: githubUser.bio || '',
      provider: 'github',
    });
  }

  // Generate JWT
  const token = generateToken(user._id);

  // Redirect to frontend with token
  const redirectUrl = `${process.env.CLIENT_URL}/auth/callback?token=${token}`;
  res.redirect(redirectUrl);
});

// @desc    Get GitHub auth URL
// @route   GET /api/github/auth-url
// @access  Public
const getAuthUrl = asyncHandler(async (req, res) => {
  const scopes = ['read:user', 'user:email', 'repo'];
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=${scopes.join('%20')}`;

  res.json({
    success: true,
    data: { authUrl },
  });
});

// @desc    Get user's GitHub repositories
// @route   GET /api/github/repos
// @access  Private
const getUserRepos = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+githubAccessToken');

  if (!user.githubAccessToken) {
    res.status(400);
    throw new Error('GitHub account not connected');
  }

  try {
    const reposResponse = await axios.get('https://api.github.com/user/repos', {
      headers: {
        Authorization: `Bearer ${user.githubAccessToken}`,
      },
      params: {
        sort: 'updated',
        per_page: 100,
      },
    });

    const repos = reposResponse.data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      isPrivate: repo.private,
      updatedAt: repo.updated_at,
    }));

    res.json({
      success: true,
      count: repos.length,
      data: repos,
    });
  } catch (error) {
    if (error.response?.status === 401) {
      res.status(401);
      throw new Error('GitHub token expired. Please reconnect your account.');
    }
    throw error;
  }
});

// @desc    Get commits for a repository
// @route   GET /api/github/repos/:owner/:repo/commits
// @access  Private
const getRepoCommits = asyncHandler(async (req, res) => {
  const { owner, repo } = req.params;
  const { page = 1, perPage = 30 } = req.query;

  const user = await User.findById(req.user._id).select('+githubAccessToken');

  if (!user.githubAccessToken) {
    res.status(400);
    throw new Error('GitHub account not connected');
  }

  try {
    const commitsResponse = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/commits`,
      {
        headers: {
          Authorization: `Bearer ${user.githubAccessToken}`,
        },
        params: {
          page,
          per_page: perPage,
        },
      }
    );

    const commits = commitsResponse.data.map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: {
        name: commit.commit.author.name,
        email: commit.commit.author.email,
        date: commit.commit.author.date,
        avatar: commit.author?.avatar_url,
        username: commit.author?.login,
      },
      url: commit.html_url,
    }));

    res.json({
      success: true,
      count: commits.length,
      data: commits,
    });
  } catch (error) {
    if (error.response?.status === 404) {
      res.status(404);
      throw new Error('Repository not found');
    }
    if (error.response?.status === 401) {
      res.status(401);
      throw new Error('GitHub token expired. Please reconnect your account.');
    }
    throw error;
  }
});

// @desc    Link GitHub repo to project
// @route   POST /api/github/link-repo
// @access  Private
const linkRepoToProject = asyncHandler(async (req, res) => {
  const { projectId, repoFullName } = req.body;

  const project = await Project.findById(projectId);
  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  // Check authorization
  const membership = await WorkspaceMember.findOne({
    workspaceId: project.workspaceId,
    userId: req.user._id,
  });

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    res.status(403);
    throw new Error('Not authorized to link repositories');
  }

  project.linkedRepo = repoFullName;
  await project.save();

  res.json({
    success: true,
    message: 'Repository linked successfully',
    data: project,
  });
});

// @desc    Unlink GitHub repo from project
// @route   DELETE /api/github/unlink-repo/:projectId
// @access  Private
const unlinkRepoFromProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const project = await Project.findById(projectId);
  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  // Check authorization
  const membership = await WorkspaceMember.findOne({
    workspaceId: project.workspaceId,
    userId: req.user._id,
  });

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    res.status(403);
    throw new Error('Not authorized to unlink repositories');
  }

  project.linkedRepo = undefined;
  await project.save();

  res.json({
    success: true,
    message: 'Repository unlinked successfully',
  });
});

// @desc    Get linked repo commits for project
// @route   GET /api/github/project-commits/:projectId
// @access  Private
const getProjectCommits = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const project = await Project.findById(projectId);
  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  if (!project.linkedRepo) {
    res.status(400);
    throw new Error('No repository linked to this project');
  }

  const user = await User.findById(req.user._id).select('+githubAccessToken');

  if (!user.githubAccessToken) {
    res.status(400);
    throw new Error('GitHub account not connected');
  }

  const [owner, repo] = project.linkedRepo.split('/');

  try {
    const commitsResponse = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/commits`,
      {
        headers: {
          Authorization: `Bearer ${user.githubAccessToken}`,
        },
        params: {
          per_page: 20,
        },
      }
    );

    const commits = commitsResponse.data.map((commit) => ({
      sha: commit.sha.substring(0, 7),
      message: commit.commit.message.split('\n')[0],
      author: commit.commit.author.name,
      date: commit.commit.author.date,
      url: commit.html_url,
    }));

    res.json({
      success: true,
      count: commits.length,
      data: commits,
    });
  } catch (error) {
    res.status(500);
    throw new Error('Failed to fetch commits');
  }
});

module.exports = {
  githubCallback,
  getAuthUrl,
  getUserRepos,
  getRepoCommits,
  linkRepoToProject,
  unlinkRepoFromProject,
  getProjectCommits,
};
