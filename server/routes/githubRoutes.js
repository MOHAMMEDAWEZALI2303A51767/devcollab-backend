const express = require('express');
const router = express.Router();
const { githubController } = require('../controllers');
const { auth } = require('../middleware');

// GitHub OAuth
router.get('/auth-url', githubController.getAuthUrl);
router.get('/callback', githubController.githubCallback);

// Protected routes
router.get('/repos', auth, githubController.getUserRepos);
router.get('/repos/:owner/:repo/commits', auth, githubController.getRepoCommits);
router.post('/link-repo', auth, githubController.linkRepoToProject);
router.delete('/unlink-repo/:projectId', auth, githubController.unlinkRepoFromProject);
router.get('/project-commits/:projectId', auth, githubController.getProjectCommits);

module.exports = router;
