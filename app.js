const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Parse JSON bodies
app.use(express.static('public')); // Serve static frontend files

// Setup Routes
app.use('/api/auth', authRoutes);
const libraryRoutes = require('./routes/library');
app.use('/api/library', libraryRoutes);

module.exports = app;
