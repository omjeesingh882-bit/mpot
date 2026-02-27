const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_mpot_key';

// Middleware to verify token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Configure internal upload directory
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'profiles');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

// Get user account info
router.get('/', authenticateToken, (req, res) => {
    db.get(`SELECT contact, name, dob, profilePhoto FROM users WHERE id = ?`, [req.user.id], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({
            contact: user.contact,
            name: user.name || '',
            dob: user.dob || '',
            profilePhoto: user.profilePhoto || ''
        });
    });
});

// Update user account info
router.post('/update', authenticateToken, (req, res) => {
    // We need to handle the multer upload here
    const uploadSingle = upload.single('profilePhoto');

    uploadSingle(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            // A Multer error occurred when uploading.
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
            }
            return res.status(400).json({ error: err.message });
        } else if (err) {
            // An unknown error occurred when uploading.
            return res.status(400).json({ error: err.message });
        }

        const { name, dob } = req.body;

        db.get(`SELECT profilePhoto FROM users WHERE id = ?`, [req.user.id], (dbErr, row) => {
            if (dbErr) return res.status(500).json({ error: 'Database error' });

            let photoUrl = row ? row.profilePhoto : null;

            // If a new file was uploaded, construct URL and delete old file if it exists
            if (req.file) {
                photoUrl = `/uploads/profiles/${req.file.filename}`;

                // optionally delete old file
                if (row && row.profilePhoto) {
                    const oldFilePath = path.join(__dirname, '..', 'public', row.profilePhoto);
                    if (fs.existsSync(oldFilePath)) {
                        fs.unlinkSync(oldFilePath);
                    }
                }
            }

            db.run(`UPDATE users SET name = ?, dob = ?, profilePhoto = ? WHERE id = ?`,
                [name || null, dob || null, photoUrl, req.user.id],
                function (updateErr) {
                    if (updateErr) return res.status(500).json({ error: 'Failed to update user profile' });
                    res.status(200).json({
                        message: 'Profile updated successfully',
                        profile: {
                            name: name || '',
                            dob: dob || '',
                            profilePhoto: photoUrl || ''
                        }
                    });
                }
            );
        });
    });
});

module.exports = router;
