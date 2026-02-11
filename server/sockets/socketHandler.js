const jwt = require('jsonwebtoken');
const { User, Message, Project, WorkspaceMember } = require('../models');

// Store connected users
const connectedUsers = new Map();
const userSockets = new Map(); // Track multiple sockets per user

// Authenticate socket connection
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication error: Token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
};

// Initialize socket handlers
const initializeSockets = (io) => {
  // Apply authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);

    // Store user connection
    const userId = socket.userId;
    connectedUsers.set(userId, {
      socketId: socket.id,
      user: socket.user,
      lastSeen: new Date(),
    });

    // Track multiple sockets for same user
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // Join user's personal room for notifications
    socket.join(`user:${userId}`);

    // Broadcast user online status
    socket.broadcast.emit('user-online', {
      userId: userId,
      user: {
        _id: socket.user._id,
        name: socket.user.name,
        avatar: socket.user.avatar,
      },
    });

    // Handle workspace room joining
    socket.on('join-workspace', (workspaceId) => {
      socket.join(`workspace:${workspaceId}`);
      console.log(`User ${userId} joined workspace ${workspaceId}`);
    });

    // Handle workspace room leaving
    socket.on('leave-workspace', (workspaceId) => {
      socket.leave(`workspace:${workspaceId}`);
      console.log(`User ${userId} left workspace ${workspaceId}`);
    });

    // Handle project room joining
    socket.on('join-project', (projectId) => {
      socket.join(`project:${projectId}`);
      console.log(`User ${userId} joined project ${projectId}`);
    });

    // Handle project room leaving
    socket.on('leave-project', (projectId) => {
      socket.leave(`project:${projectId}`);
      console.log(`User ${userId} left project ${projectId}`);
    });

    // Handle task room joining (for real-time task updates)
    socket.on('join-task', (taskId) => {
      socket.join(`task:${taskId}`);
      console.log(`User ${userId} joined task ${taskId}`);
    });

    // Handle task room leaving
    socket.on('leave-task', (taskId) => {
      socket.leave(`task:${taskId}`);
      console.log(`User ${userId} left task ${taskId}`);
    });

    // === CHAT FUNCTIONALITY ===
    
    // Join project chat room
    socket.on('join-chat', (projectId) => {
      socket.join(`chat:${projectId}`);
      console.log(`User ${userId} joined chat room for project ${projectId}`);
      
      // Notify others in the room
      socket.to(`chat:${projectId}`).emit('user-joined-chat', {
        userId: userId,
        userName: socket.user.name,
      });
    });

    // Leave project chat room
    socket.on('leave-chat', (projectId) => {
      socket.leave(`chat:${projectId}`);
      console.log(`User ${userId} left chat room for project ${projectId}`);
      
      // Notify others in the room
      socket.to(`chat:${projectId}`).emit('user-left-chat', {
        userId: userId,
        userName: socket.user.name,
      });
    });

    // Handle new chat message
    socket.on('send-message', async (data) => {
      const { projectId, text, mentions = [] } = data;

      try {
        // Verify user is member of the project
        const project = await Project.findById(projectId);
        if (!project) return;

        const membership = await WorkspaceMember.findOne({
          workspaceId: project.workspaceId,
          userId: userId,
        });

        if (!membership) return;

        // Create and save message
        const message = await Message.create({
          projectId,
          senderId: userId,
          text,
          mentions,
        });

        // Populate message
        const populatedMessage = await Message.findById(message._id)
          .populate('senderId', 'name email avatar')
          .populate('mentions', 'name email avatar');

        // Broadcast to all users in the chat room
        io.to(`chat:${projectId}`).emit('new-message', populatedMessage);

        // Send notifications to mentioned users
        for (const mentionedUserId of mentions) {
          if (mentionedUserId !== userId) {
            io.to(`user:${mentionedUserId}`).emit('notification', {
              type: 'mention',
              text: `${socket.user.name} mentioned you in ${project.name} chat`,
              data: {
                projectId: project._id,
                workspaceId: project.workspaceId,
                senderId: userId,
              },
            });
          }
        }
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('message-error', { error: 'Failed to send message' });
      }
    });

    // Handle message editing
    socket.on('edit-message', async (data) => {
      const { messageId, text } = data;

      try {
        const message = await Message.findById(messageId);
        if (!message || message.senderId.toString() !== userId) {
          return socket.emit('message-error', { error: 'Not authorized' });
        }

        // Can only edit within 15 minutes
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        if (message.createdAt < fifteenMinutesAgo) {
          return socket.emit('message-error', { error: 'Message too old to edit' });
        }

        message.text = text;
        message.edited = true;
        message.editedAt = new Date();
        await message.save();

        const populatedMessage = await Message.findById(message._id)
          .populate('senderId', 'name email avatar')
          .populate('mentions', 'name email avatar');

        io.to(`chat:${message.projectId}`).emit('message-edited', populatedMessage);
      } catch (error) {
        console.error('Error editing message:', error);
        socket.emit('message-error', { error: 'Failed to edit message' });
      }
    });

    // Handle message deletion
    socket.on('delete-message', async (data) => {
      const { messageId } = data;

      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        const project = await Project.findById(message.projectId);
        const membership = await WorkspaceMember.findOne({
          workspaceId: project.workspaceId,
          userId: userId,
        });

        // Only sender or admin can delete
        const isSender = message.senderId.toString() === userId;
        const isAdmin = ['owner', 'admin'].includes(membership?.role);

        if (!isSender && !isAdmin) {
          return socket.emit('message-error', { error: 'Not authorized' });
        }

        const projectId = message.projectId;
        await message.deleteOne();

        io.to(`chat:${projectId}`).emit('message-deleted', { messageId });
      } catch (error) {
        console.error('Error deleting message:', error);
        socket.emit('message-error', { error: 'Failed to delete message' });
      }
    });

    // Handle typing indicator for chat
    socket.on('typing', ({ projectId, isTyping }) => {
      socket.to(`chat:${projectId}`).emit('user-typing', {
        userId: userId,
        userName: socket.user.name,
        isTyping,
      });
    });

    // Get online users in a chat room
    socket.on('get-online-users', async (projectId) => {
      const room = io.sockets.adapter.rooms.get(`chat:${projectId}`);
      if (!room) {
        return socket.emit('online-users', []);
      }

      const onlineUserIds = new Set();
      for (const socketId of room) {
        const socketData = io.sockets.sockets.get(socketId);
        if (socketData) {
          onlineUserIds.add(socketData.userId);
        }
      }

      // Get user details
      const users = await User.find(
        { _id: { $in: Array.from(onlineUserIds) } },
        'name avatar'
      );

      socket.emit('online-users', users);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${userId}`);
      
      // Remove socket from user's socket set
      const userSocketSet = userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        
        // If no more sockets for this user, they're fully offline
        if (userSocketSet.size === 0) {
          userSockets.delete(userId);
          connectedUsers.delete(userId);
          
          // Broadcast user offline status
          socket.broadcast.emit('user-offline', {
            userId: userId,
          });
        }
      }
    });
  });

  return {
    // Emit notification to specific user
    emitNotification: (userId, notification) => {
      io.to(`user:${userId}`).emit('notification', notification);
    },

    // Emit task update to task room
    emitTaskUpdate: (taskId, update) => {
      io.to(`task:${taskId}`).emit('task-updated', update);
    },

    // Emit new comment to task room
    emitNewComment: (taskId, comment) => {
      io.to(`task:${taskId}`).emit('new-comment', comment);
    },

    // Emit board update to project room
    emitBoardUpdate: (projectId, update) => {
      io.to(`project:${projectId}`).emit('board-updated', update);
    },

    // Emit workspace update
    emitWorkspaceUpdate: (workspaceId, update) => {
      io.to(`workspace:${workspaceId}`).emit('workspace-updated', update);
    },

    // Emit new chat message
    emitChatMessage: (projectId, message) => {
      io.to(`chat:${projectId}`).emit('new-message', message);
    },

    // Get connected users count
    getConnectedUsersCount: () => connectedUsers.size,

    // Check if user is online
    isUserOnline: (userId) => userSockets.has(userId),

    // Get online users list
    getOnlineUsers: () => Array.from(connectedUsers.values()).map((u) => ({
      userId: u.user._id,
      name: u.user.name,
      avatar: u.user.avatar,
    })),
  };
};

module.exports = initializeSockets;
