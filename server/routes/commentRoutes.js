const express = require('express');
const router = express.Router();
const { commentController } = require('../controllers');
const { auth, createCommentValidation } = require('../middleware');

// Comment routes
router.post('/:taskId', auth, createCommentValidation, commentController.createComment);
router.get('/:taskId', auth, commentController.getCommentsByTask);
router.put('/:id', auth, commentController.updateComment);
router.delete('/:id', auth, commentController.deleteComment);

module.exports = router;
