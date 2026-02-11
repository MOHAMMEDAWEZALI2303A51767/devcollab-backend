const express = require('express');
const router = express.Router();
const { taskController } = require('../controllers');
const { auth, createTaskValidation, updateTaskValidation, upload, handleUploadError } = require('../middleware');

// Task CRUD
router.post('/', auth, createTaskValidation, taskController.createTask);
router.get('/board/:boardId', auth, taskController.getTasksByBoard);
router.get('/:id', auth, taskController.getTask);
router.put('/:id', auth, updateTaskValidation, taskController.updateTask);
router.delete('/:id', auth, taskController.deleteTask);

// Task operations
router.put('/:id/move', auth, taskController.moveTask);

// Attachments
router.post(
  '/:id/attachments',
  auth,
  upload.single('file'),
  handleUploadError,
  taskController.addAttachment
);
router.delete('/:id/attachments/:attachmentId', auth, taskController.removeAttachment);

module.exports = router;
