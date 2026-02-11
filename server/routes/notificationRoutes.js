const express = require('express');
const router = express.Router();
const { notificationController } = require('../controllers');
const { auth } = require('../middleware');

// Notification routes
router.get('/', auth, notificationController.getNotifications);
router.get('/unread-count', auth, notificationController.getUnreadCount);
router.put('/read-all', auth, notificationController.markAllAsRead);
router.put('/:id/read', auth, notificationController.markAsRead);
router.delete('/clear-read', auth, notificationController.clearReadNotifications);
router.delete('/:id', auth, notificationController.deleteNotification);

module.exports = router;
