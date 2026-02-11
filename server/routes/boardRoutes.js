const express = require('express');
const router = express.Router();
const { boardController } = require('../controllers');
const { auth, createBoardValidation } = require('../middleware');

// Board CRUD
router.post('/', auth, createBoardValidation, boardController.createBoard);
router.get('/project/:projectId', auth, boardController.getBoardsByProject);
router.get('/:id', auth, boardController.getBoard);
router.put('/:id', auth, boardController.updateBoard);
router.delete('/:id', auth, boardController.deleteBoard);

// Reorder boards
router.put('/reorder/:projectId', auth, boardController.reorderBoards);

module.exports = router;
