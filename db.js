const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const db = new Database('jobportal.db');

db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, password TEXT, role TEXT);
CREATE TABLE IF NOT EXISTS jobs(
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, company TEXT, location TEXT, salary TEXT,
  description TEXT, employer_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS applications(
  id INTEGER PRIMARY KEY AUTOINCREMENT, job_id INTEGER, user_id INTEGER, message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(job_id, user_id));
`);

// Demo data (first run only)
if (!db.prepare('SELECT COUNT(*) c FROM users').get().c) {
  const emp = db.prepare('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)')
    .run('Demo Company', 'employer@demo.com', bcrypt.hashSync('123456', 8), 'employer');
  const ins = db.prepare('INSERT INTO jobs(title,company,location,salary,description,employer_id) VALUES(?,?,?,?,?,?)');
  ins.run('Junior Web Developer', 'Demo Company', 'Madurai', '₹15,000 - 25,000', 'HTML, CSS, JavaScript theriyanum. Freshers welcome.', emp.lastInsertRowid);
  ins.run('Node.js Backend Developer', 'Demo Company', 'Chennai', '₹30,000 - 45,000', 'Node, Express, SQL experience venum.', emp.lastInsertRowid);
  ins.run('Data Entry Operator', 'Demo Company', 'Coimbatore', '₹12,000 - 16,000', 'Typing speed nalla irukkanum.', emp.lastInsertRowid);
}
module.exports = db;
