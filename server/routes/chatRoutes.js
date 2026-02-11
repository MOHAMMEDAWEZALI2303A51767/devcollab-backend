const express = require('express');
const router = express.Router();
const { chatController } = require('../controllers');
const { auth } = require('../middleware');

// Get messages for a project
router.get('/:projectId/messages', auth, chatController.getMessages);

// Send a message
router.post('/:projectId/messages', auth, chatController.sendMessage);

// Edit a message
router.put('/messages/:messageId', auth, chatController.editMessage);

// Delete a message
router.delete('/messages/:messageId', auth, chatController.deleteMessage);

module.exports = router;
