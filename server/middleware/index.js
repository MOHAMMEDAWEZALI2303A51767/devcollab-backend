const auth = require('./auth');
const errorHandler = require('./errorHandler');
const {
  handleValidationErrors,
  registerValidation,
  loginValidation,
  createWorkspaceValidation,
  inviteMemberValidation,
  createProjectValidation,
  createBoardValidation,
  createTaskValidation,
  updateTaskValidation,
  createCommentValidation,
} = require('./validate');
const { upload, handleUploadError } = require('./upload');

module.exports = {
  auth,
  errorHandler,
  handleValidationErrors,
  registerValidation,
  loginValidation,
  createWorkspaceValidation,
  inviteMemberValidation,
  createProjectValidation,
  createBoardValidation,
  createTaskValidation,
  updateTaskValidation,
  createCommentValidation,
  upload,
  handleUploadError,
};
