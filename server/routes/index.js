const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const workspaceRoutes = require('./workspaceRoutes');
const projectRoutes = require('./projectRoutes');
const boardRoutes = require('./boardRoutes');
const taskRoutes = require('./taskRoutes');
const commentRoutes = require('./commentRoutes');
const notificationRoutes = require('./notificationRoutes');
const chatRoutes = require('./chatRoutes');
const githubRoutes = require('./githubRoutes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/workspaces', workspaceRoutes);
router.use('/projects', projectRoutes);
router.use('/boards', boardRoutes);
router.use('/tasks', taskRoutes);
router.use('/comments', commentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/chat', chatRoutes);
router.use('/github', githubRoutes);

module.exports = router;
