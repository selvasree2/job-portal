let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user') || 'null');
const app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 2500);
}

async function api(url, method = 'GET', body) {
  const r = await fetch('/api' + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Something went wrong');
  return d;
}

function renderNav() {
  document.getElementById('nav').innerHTML = user
    ? `<button onclick="show('jobs')">Jobs</button>
       <button onclick="show('dash')">${user.role === 'employer' ? 'My Jobs' : 'My Applications'}</button>
       <button onclick="logout()">Logout (${esc(user.name)})</button>`
    : `<button onclick="show('jobs')">Jobs</button>
       <button onclick="show('login')">Login</button>
       <button onclick="show('register')">Register</button>`;
}

function show(view) {
  renderNav();
  ({ jobs: viewJobs, login: viewLogin, register: viewRegister, dash: viewDash })[view]();
}

function logout() {
  localStorage.clear(); token = null; user = null; show('jobs');
}

// ---------- Jobs list ----------
async function viewJobs(q = '') {
  app.innerHTML = `
    <div class="row"><input id="q" placeholder="Search by title, company or location" value="${esc(q)}">
    <button class="btn" style="flex:0 0 100px;margin:6px 0 12px" onclick="viewJobs(document.getElementById('q').value)">Search</button></div>
    <div id="list">Loading...</div>`;
  const jobs = await api('/jobs?q=' + encodeURIComponent(q));
  document.getElementById('list').innerHTML = jobs.length ? jobs.map(j => `
    <div class="card">
      <h3>${esc(j.title)}</h3>
      <div class="meta">${esc(j.company)} • 📍 ${esc(j.location)}</div>
      ${j.salary ? `<span class="tag">${esc(j.salary)}</span>` : ''}
      <p>${esc(j.description)}</p>
      ${user?.role === 'seeker' ? `<button class="btn" onclick="apply(${j.id})">Apply Now</button>` : ''}
    </div>`).join('') : '<p>No jobs found.</p>';
}

async function apply(id) {
  const message = prompt('Short message to employer (optional):') ?? null;
  if (message === null) return;
  try { await api(`/jobs/${id}/apply`, 'POST', { message }); toast('Applied successfully ✅'); }
  catch (e) { toast(e.message); }
}

// ---------- Login / Register ----------
function viewLogin() {
  app.innerHTML = `<div class="card form"><h2>Login</h2>
    <input id="email" placeholder="Email"><input id="pw" type="password" placeholder="Password">
    <button class="btn" onclick="login()">Login</button>
    <p class="demo">Demo employer: employer@demo.com / 123456</p></div>`;
}
async function login() {
  try {
    const d = await api('/login', 'POST', { email: email.value, password: pw.value });
    saveAuth(d);
  } catch (e) { toast(e.message); }
}
function viewRegister() {
  app.innerHTML = `<div class="card form"><h2>Register</h2>
    <input id="name" placeholder="Full name / Company name"><input id="email" placeholder="Email">
    <input id="pw" type="password" placeholder="Password (min 6 chars)">
    <select id="role"><option value="seeker">I am looking for a job</option><option value="employer">I want to hire (Employer)</option></select>
    <button class="btn" onclick="register()">Create account</button></div>`;
}
async function register() {
  try {
    const d = await api('/register', 'POST', { name: name.value, email: email.value, password: pw.value, role: role.value });
    saveAuth(d);
  } catch (e) { toast(e.message); }
}
function saveAuth(d) {
  token = d.token; user = d.user;
  localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user));
  toast('Welcome ' + user.name); show('dash');
}

// ---------- Dashboard ----------
async function viewDash() {
  if (!user) return show('login');
  if (user.role === 'seeker') {
    const list = await api('/my-applications');
    app.innerHTML = '<h2>My Applications</h2>' + (list.length ? list.map(a => `
      <div class="card"><h3>${esc(a.title)}</h3>
      <div class="meta">${esc(a.company)} • 📍 ${esc(a.location)} • Applied: ${esc(a.created_at)}</div></div>`).join('')
      : '<p>You have not applied to any job yet.</p>');
    return;
  }
  app.innerHTML = `<div class="card"><h2>Post a New Job</h2>
    <input id="t" placeholder="Job title"><input id="c" placeholder="Company name" value="${esc(user.name)}">
    <div class="row"><input id="l" placeholder="Location"><input id="s" placeholder="Salary (e.g. ₹20,000)"></div>
    <textarea id="d" rows="3" placeholder="Job description"></textarea>
    <button class="btn" onclick="postJob()">Post Job</button></div>
    <h2>My Posted Jobs</h2><div id="mine">Loading...</div>`;
  loadMine();
}
async function postJob() {
  try {
    await api('/jobs', 'POST', { title: t.value, company: c.value, location: l.value, salary: s.value, description: d.value });
    toast('Job posted ✅'); viewDash();
  } catch (e) { toast(e.message); }
}
async function loadMine() {
  const jobs = await api('/my-jobs');
  document.getElementById('mine').innerHTML = jobs.length ? jobs.map(j => `
    <div class="card"><h3>${esc(j.title)}</h3>
    <div class="meta">📍 ${esc(j.location)} • ${j.applicants} applicant(s)</div>
    <button class="btn gray" onclick="applicants(${j.id})">View Applicants</button>
    <button class="btn red" onclick="delJob(${j.id})">Delete</button>
    <div id="ap${j.id}"></div></div>`).join('') : '<p>No jobs posted yet.</p>';
}
async function applicants(id) {
  const list = await api(`/jobs/${id}/applicants`);
  document.getElementById('ap' + id).innerHTML = list.length ? '<hr>' + list.map(a =>
    `<p><b>${esc(a.name)}</b> (${esc(a.email)})<br><span class="meta">${esc(a.message || 'No message')}</span></p>`).join('')
    : '<p class="meta">No applicants yet.</p>';
}
async function delJob(id) {
  if (!confirm('Delete this job?')) return;
  await api('/jobs/' + id, 'DELETE'); loadMine();
}

show('jobs');
