const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const SECRET = 'job_portal_secret_change_me';
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));
// ---- auth middleware ----
const auth = (role) => (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try { req.user = jwt.verify(token, SECRET); }
  catch { return res.status(401).json({ error: 'Please login first' }); }
  if (role && req.user.role !== role) return res.status(403).json({ error: 'Not allowed for your account type' });
  next();
};
const sign = (u) => jwt.sign({ id: u.id, name: u.name, role: u.role }, SECRET, { expiresIn: '7d' });

// ---- register / login ----
app.post('/api/register', (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !['seeker', 'employer'].includes(role))
    return res.status(400).json({ error: 'All fields are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const r = db.prepare('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)')
      .run(name, email.toLowerCase(), bcrypt.hashSync(password, 8), role);
    const user = { id: r.lastInsertRowid, name, role };
    res.json({ token: sign(user), user });
  } catch { res.status(400).json({ error: 'Email already registered' }); }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const u = db.prepare('SELECT * FROM users WHERE email=?').get((email || '').toLowerCase());
  if (!u || !bcrypt.compareSync(password || '', u.password))
    return res.status(401).json({ error: 'Wrong email or password' });
  const user = { id: u.id, name: u.name, role: u.role };
  res.json({ token: sign(user), user });
});

// ---- jobs ----
app.get('/api/jobs', (req, res) => {
  const q = `%${req.query.q || ''}%`;
  res.json(db.prepare(`SELECT * FROM jobs WHERE title LIKE ? OR company LIKE ? OR location LIKE ?
                       ORDER BY id DESC`).all(q, q, q));
});

app.post('/api/jobs', auth('employer'), (req, res) => {
  const { title, company, location, salary, description } = req.body;
  if (!title || !company || !location) return res.status(400).json({ error: 'Title, company, location required' });
  db.prepare('INSERT INTO jobs(title,company,location,salary,description,employer_id) VALUES(?,?,?,?,?,?)')
    .run(title, company, location, salary || '', description || '', req.user.id);
  res.json({ ok: true });
});

app.get('/api/my-jobs', auth('employer'), (req, res) => {
  res.json(db.prepare(`SELECT j.*, (SELECT COUNT(*) FROM applications a WHERE a.job_id=j.id) AS applicants
                       FROM jobs j WHERE employer_id=? ORDER BY id DESC`).all(req.user.id));
});

app.get('/api/jobs/:id/applicants', auth('employer'), (req, res) => {
  const job = db.prepare('SELECT id FROM jobs WHERE id=? AND employer_id=?').get(req.params.id, req.user.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(db.prepare(`SELECT u.name, u.email, a.message, a.created_at FROM applications a
                       JOIN users u ON u.id=a.user_id WHERE a.job_id=? ORDER BY a.id DESC`).all(job.id));
});

app.delete('/api/jobs/:id', auth('employer'), (req, res) => {
  const r = db.prepare('DELETE FROM jobs WHERE id=? AND employer_id=?').run(req.params.id, req.user.id);
  if (r.changes) db.prepare('DELETE FROM applications WHERE job_id=?').run(req.params.id);
  res.json({ ok: true });
});

// ---- applications ----
app.post('/api/jobs/:id/apply', auth('seeker'), (req, res) => {
  try {
    db.prepare('INSERT INTO applications(job_id,user_id,message) VALUES(?,?,?)')
      .run(req.params.id, req.user.id, req.body.message || '');
    res.json({ ok: true });
  } catch { res.status(400).json({ error: 'You already applied for this job' }); }
});

app.get('/api/my-applications', auth('seeker'), (req, res) => {
  res.json(db.prepare(`SELECT j.title, j.company, j.location, a.created_at FROM applications a
                       JOIN jobs j ON j.id=a.job_id WHERE a.user_id=? ORDER BY a.id DESC`).all(req.user.id));
});

app.listen(PORT, () => console.log(`Job Portal running -> http://localhost:${PORT}`));
