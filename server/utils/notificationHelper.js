const Notification = require('../models/Notification');

const createNotification = async ({
  userId,
  type,
  text,
  data = {},
}) => {
  try {
    const notification = await Notification.create({
      userId,
      type,
      text,
      data,
    });
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

const createBulkNotifications = async (notifications) => {
  try {
    const createdNotifications = await Notification.insertMany(notifications);
    return createdNotifications;
  } catch (error) {
    console.error('Error creating bulk notifications:', error);
    return null;
  }
};

module.exports = {
  createNotification,
  createBulkNotifications,
};
