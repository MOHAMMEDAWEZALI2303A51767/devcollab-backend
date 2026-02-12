const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/workspaces', require('./workspaceRoutes'));
router.use('/projects', require('./projectRoutes'));
router.use('/boards', require('./boardRoutes'));
router.use('/tasks', require('./taskRoutes'));
router.use('/comments', require('./commentRoutes'));
router.use('/notifications', require('./notificationRoutes'));
router.use('/chat', require('./chatRoutes'));
router.use('/github', require('./githubRoutes'));

module.exports = router;
