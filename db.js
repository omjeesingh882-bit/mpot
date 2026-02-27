const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'mpot.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');

    // Create Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact TEXT UNIQUE NOT NULL, -- Email or Phone number
      password TEXT NOT NULL,
      otp TEXT,
      otpExpiry INTEGER,
      isVerified INTEGER DEFAULT 0 -- 0 or 1
    )`, (err) => {
      if (err) {
        console.error('Error creating users table', err.message);
      } else {
        console.log('Users table ready.');
        // Add new columns if they do not exist
        db.run(`ALTER TABLE users ADD COLUMN name TEXT`, (err) => { if (!err) console.log('Added name column'); });
        db.run(`ALTER TABLE users ADD COLUMN dob TEXT`, (err) => { if (!err) console.log('Added dob column'); });
        db.run(`ALTER TABLE users ADD COLUMN profilePhoto TEXT`, (err) => { if (!err) console.log('Added profilePhoto column'); });
      }
    });

    // Create Library table
    db.run(`CREATE TABLE IF NOT EXISTS library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      videoId TEXT NOT NULL,
      title TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
    )`, (err) => {
      if (err) {
        console.error('Error creating library table', err.message);
      } else {
        console.log('Library table ready.');
      }
    });
  }
});

module.exports = db;
