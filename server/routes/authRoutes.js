const express = require('express');
const router = express.Router();
const { authController } = require('../controllers');
const { auth, registerValidation, loginValidation } = require('../middleware');

// Public routes
router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);

// Protected routes
router.get('/me', auth, authController.getMe);
router.put('/profile', auth, authController.updateProfile);
router.put('/password', auth, authController.changePassword);

module.exports = router;
