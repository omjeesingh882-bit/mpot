const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_mpot_key';

// Middleware to authenticate
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Failed to authenticate token' });
        req.user = decoded;
        next();
    });
};

// GET /api/library - Get all saved songs for the user
router.get('/', authenticate, (req, res) => {
    db.all(`SELECT id, videoId, title FROM library WHERE userId = ? ORDER BY id DESC`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error fetching library' });
        res.status(200).json(rows);
    });
});

// POST /api/library - Save a new song to library
router.post('/', authenticate, (req, res) => {
    const { videoId, title } = req.body;

    if (!videoId || !title) {
        return res.status(400).json({ error: 'Video ID and Title required' });
    }

    db.run(`INSERT INTO library (userId, videoId, title) VALUES (?, ?, ?)`,
        [req.user.id, videoId, title],
        function (err) {
            if (err) return res.status(500).json({ error: 'Failed to save to library' });
            res.status(201).json({ message: 'Saved to library', id: this.lastID });
        }
    );
});

// DELETE /api/library/:id - Remove a song from library
router.delete('/:id', authenticate, (req, res) => {
    const { id } = req.params;

    db.run(`DELETE FROM library WHERE id = ? AND userId = ?`, [id, req.user.id], function (err) {
        if (err) return res.status(500).json({ error: 'Failed to delete from library' });
        if (this.changes === 0) return res.status(404).json({ error: 'Song not found or unauthorized' });

        res.status(200).json({ message: 'Removed from library' });
    });
});

module.exports = router;
