const { body, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

// Auth validations
const registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 50 })
    .withMessage('Name cannot exceed 50 characters'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  handleValidationErrors,
];

const loginValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors,
];

// Workspace validations
const createWorkspaceValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Workspace name is required')
    .isLength({ max: 100 })
    .withMessage('Workspace name cannot exceed 100 characters'),
  handleValidationErrors,
];

const inviteMemberValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email'),
  body('role')
    .optional()
    .isIn(['admin', 'member'])
    .withMessage('Role must be admin or member'),
  handleValidationErrors,
];

// Project validations
const createProjectValidation = [
  body('workspaceId')
    .trim()
    .notEmpty()
    .withMessage('Workspace ID is required'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Project name is required')
    .isLength({ max: 100 })
    .withMessage('Project name cannot exceed 100 characters'),
  handleValidationErrors,
];

// Board validations
const createBoardValidation = [
  body('projectId')
    .trim()
    .notEmpty()
    .withMessage('Project ID is required'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Board name is required')
    .isLength({ max: 100 })
    .withMessage('Board name cannot exceed 100 characters'),
  handleValidationErrors,
];

// Task validations
const createTaskValidation = [
  body('boardId')
    .trim()
    .notEmpty()
    .withMessage('Board ID is required'),
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Task title is required')
    .isLength({ max: 200 })
    .withMessage('Task title cannot exceed 200 characters'),
  handleValidationErrors,
];

const updateTaskValidation = [
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Task title cannot be empty')
    .isLength({ max: 200 })
    .withMessage('Task title cannot exceed 200 characters'),
  body('status')
    .optional()
    .isIn(['todo', 'in_progress', 'review', 'done'])
    .withMessage('Invalid status'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority'),
  handleValidationErrors,
];

// Comment validations
const createCommentValidation = [
  body('text')
    .trim()
    .notEmpty()
    .withMessage('Comment text is required')
    .isLength({ max: 2000 })
    .withMessage('Comment cannot exceed 2000 characters'),
  handleValidationErrors,
];

module.exports = {
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
};
