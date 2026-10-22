const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'jobportal.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT UNIQUE,
  password TEXT,
  role TEXT
);
CREATE TABLE IF NOT EXISTS jobs(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  company TEXT,
  location TEXT,
  salary TEXT,
  description TEXT,
  employer_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS applications(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER,
  user_id INTEGER,
  message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(job_id, user_id)
);
`);

const email = 'employer@demo.com';
const password = bcrypt.hashSync('123456', 8);

const existing = db.prepare(
  'SELECT id FROM users WHERE email = ?'
).get(email);

let employerId;

if (existing) {
  employerId = existing.id;
  db.prepare(
    'UPDATE users SET name=?, password=?, role=? WHERE id=?'
  ).run('Demo Company', password, 'employer', employerId);
} else {
  const result = db.prepare(
    'INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)'
  ).run('Demo Company', email, password, 'employer');
  employerId = result.lastInsertRowid;
}

if (!db.prepare('SELECT id FROM jobs LIMIT 1').get()) {
  const addJob = db.prepare(
    'INSERT INTO jobs(title,company,location,salary,description,employer_id) VALUES(?,?,?,?,?,?)'
  );
  addJob.run('Junior Web Developer', 'Demo Company', 'Madurai',
    '₹15,000 - 25,000', 'Freshers welcome.', employerId);
  addJob.run('Node.js Backend Developer', 'Demo Company', 'Chennai',
    '₹30,000 - 45,000', 'Node, Express, SQL experience venum.', employerId);
  addJob.run('Data Entry Operator', 'Demo Company', 'Coimbatore',
    '₹12,000 - 16,000', 'Typing speed nalla irukkanum.', employerId);
}

module.exports = db;
