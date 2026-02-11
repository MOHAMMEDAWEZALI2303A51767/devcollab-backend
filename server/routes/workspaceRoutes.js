const express = require('express');
const router = express.Router();
const { workspaceController } = require('../controllers');
const { auth, createWorkspaceValidation, inviteMemberValidation } = require('../middleware');

// Workspace CRUD
router.post('/', auth, createWorkspaceValidation, workspaceController.createWorkspace);
router.get('/', auth, workspaceController.getWorkspaces);
router.get('/:id', auth, workspaceController.getWorkspace);
router.put('/:id', auth, workspaceController.updateWorkspace);
router.delete('/:id', auth, workspaceController.deleteWorkspace);

// Member management
router.post('/:id/invite', auth, inviteMemberValidation, workspaceController.inviteMember);
router.get('/:id/members', auth, workspaceController.getWorkspaceMembers);
router.delete('/:id/members/:userId', auth, workspaceController.removeMember);

module.exports = router;
