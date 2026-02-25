const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { generateOTP, sendOTP } = require('../utils/otp');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_mpot_key';

// Register User
router.post('/register', async (req, res) => {
    const { contact, password } = req.body;

    if (!contact || !password) {
        return res.status(400).json({ error: 'Contact and password required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = generateOTP();
        const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes from now

        db.get(`SELECT id, isVerified FROM users WHERE contact = ?`, [contact], (err, user) => {
            if (err) return res.status(500).json({ error: 'Database error' });

            if (user) {
                if (user.isVerified === 1) {
                    return res.status(400).json({ error: 'User already exists' });
                } else {
                    // Update OTP for unverified user
                    db.run(`UPDATE users SET password = ?, otp = ?, otpExpiry = ? WHERE id = ?`,
                        [hashedPassword, otp, otpExpiry, user.id],
                        function (updateErr) {
                            if (updateErr) return res.status(500).json({ error: 'Registration update failed' });
                            sendOTP(contact, otp);
                            res.status(201).json({ message: 'OTP resent successfully. Please verify to complete registration. (For testing, OTP is ' + otp + ')', otp: otp });
                        }
                    );
                }
            } else {
                // Insert new user
                db.run(`INSERT INTO users (contact, password, otp, otpExpiry, isVerified) VALUES (?, ?, ?, ?, ?)`,
                    [contact, hashedPassword, otp, otpExpiry, 0],
                    function (insertErr) {
                        if (insertErr) return res.status(500).json({ error: 'Registration failed' });
                        sendOTP(contact, otp);
                        res.status(201).json({ message: 'OTP sent successfully. Please verify to complete registration. (For testing, OTP is ' + otp + ')', otp: otp });
                    }
                );
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Verify Registration OTP
router.post('/verify-otp', (req, res) => {
    let { contact, otp } = req.body;
    otp = String(otp).trim();

    db.get(`SELECT id, otp, otpExpiry FROM users WHERE contact = ? AND isVerified = 0`, [contact], (err, user) => {
        if (err || !user) {
            return res.status(400).json({ error: 'Invalid user or already verified' });
        }

        if (user.otp !== otp || Date.now() > user.otpExpiry) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        // OTP valid, update verification status
        db.run(`UPDATE users SET isVerified = 1, otp = NULL, otpExpiry = NULL WHERE id = ?`, [user.id], function (updateErr) {
            if (updateErr) return res.status(500).json({ error: 'Verification failed' });
            res.status(200).json({ message: 'Registration complete. You can now login.' });
        });
    });
});


// Login
router.post('/login', (req, res) => {
    const { contact, password } = req.body;

    db.get(`SELECT * FROM users WHERE contact = ?`, [contact], async (err, user) => {
        if (err || !user) {
            return res.status(400).json({ error: 'Invalid credentials or user not found' });
        }

        if (user.isVerified === 0) {
            return res.status(401).json({ error: 'Please verify your account first. Request a new OTP.' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, contact: user.contact }, JWT_SECRET, { expiresIn: '30d' }); // 30 days session
        res.status(200).json({ message: 'Login successful', token, user: { contact: user.contact } });
    });
});

// Forgot Password - Request OTP
router.post('/forgot-password', (req, res) => {
    const { contact } = req.body;

    db.get(`SELECT id FROM users WHERE contact = ?`, [contact], (err, user) => {
        if (err || !user) {
            return res.status(400).json({ error: 'User with this contact not found' });
        }

        const otp = generateOTP();
        const otpExpiry = Date.now() + 10 * 60 * 1000;

        db.run(`UPDATE users SET otp = ?, otpExpiry = ? WHERE id = ?`, [otp, otpExpiry, user.id], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: 'Failed to generate reset OTP' });

            sendOTP(contact, otp);
            res.status(200).json({ message: 'Verification OTP sent. (For testing, OTP is ' + otp + ')', otp: otp });
        });
    });
});

// Reset Password - Verify OTP and Set New Password
router.post('/reset-password', async (req, res) => {
    let { contact, otp, newPassword } = req.body;
    otp = String(otp).trim();

    db.get(`SELECT id, otp, otpExpiry FROM users WHERE contact = ?`, [contact], async (err, user) => {
        if (err || !user) {
            return res.status(400).json({ error: 'User not found' });
        }

        if (user.otp !== otp || Date.now() > user.otpExpiry) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        db.run(`UPDATE users SET password = ?, otp = NULL, otpExpiry = NULL WHERE id = ?`, [hashedPassword, user.id], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: 'Failed to reset password' });
            res.status(200).json({ message: 'Password reset successful. Please login.' });
        });
    });
});

module.exports = router;
