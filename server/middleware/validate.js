const { body, validationResult } = require('express-validator');

// 🔥 GLOBAL VALIDATION ERROR HANDLER
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.log("❌ Validation Errors:", errors.array());

    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg, // send first error cleanly
    });
  }

  next();
};

// REGISTER VALIDATION
const registerValidation = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be 6+ chars'),
  handleValidationErrors,
];

// LOGIN VALIDATION
const loginValidation = [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
  handleValidationErrors,
];

module.exports = {
  registerValidation,
  loginValidation,
};
