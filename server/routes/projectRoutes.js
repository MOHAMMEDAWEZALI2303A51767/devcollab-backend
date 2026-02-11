const express = require('express');
const router = express.Router();
const { projectController } = require('../controllers');
const { auth, createProjectValidation } = require('../middleware');

// Project CRUD
router.post('/', auth, createProjectValidation, projectController.createProject);
router.get('/workspace/:workspaceId', auth, projectController.getProjectsByWorkspace);
router.get('/:id', auth, projectController.getProject);
router.put('/:id', auth, projectController.updateProject);
router.delete('/:id', auth, projectController.deleteProject);

// Member management
router.post('/:id/members', auth, projectController.addProjectMember);
router.delete('/:id/members/:userId', auth, projectController.removeProjectMember);

module.exports = router;
