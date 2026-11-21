const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-collab-key-2026';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rootpassword',
  database: process.env.DB_NAME || 'tasklist_app',
  waitForConnections: true,
  connectionLimit: 10
});

// Socket.io Room Management
io.on('connection', (socket) => {
  socket.on('join_group', (groupId) => {
    socket.join(`group_${groupId}`);
  });
  socket.on('leave_group', (groupId) => {
    socket.leave(`group_${groupId}`);
  });
});

function notifyGroup(groupId) {
  io.to(`group_${groupId}`).emit('group_updated');
}

// JWT Auth Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Reset due repeating tasks
async function resetDueRepeatingTasks(groupId) {
  const [tasks] = await pool.query(
    `SELECT * FROM tasks WHERE group_id = ? AND is_completed = TRUE AND repeat_interval != 'none'`,
    [groupId]
  );

  const now = new Date();
  for (const task of tasks) {
    if (!task.completed_at) continue;
    const diffHours = (now - new Date(task.completed_at)) / (1000 * 60 * 60);

    let shouldReset = false;
    if (task.repeat_interval === 'daily' && diffHours >= 24) shouldReset = true;
    if (task.repeat_interval === 'weekly' && diffHours >= 24 * 7) shouldReset = true;
    if (task.repeat_interval === 'monthly' && diffHours >= 24 * 30) shouldReset = true;

    if (shouldReset) {
      let resetContent = typeof task.content === 'string' ? JSON.parse(task.content) : task.content;
      if (task.type === 'checklist' && Array.isArray(resetContent)) {
        resetContent = resetContent.map(item => ({ ...item, done: false }));
      }
      await pool.query(
        `UPDATE tasks SET is_completed = FALSE, completed_by = NULL, completed_at = NULL, content = ? WHERE id = ?`,
        [JSON.stringify(resetContent), task.id]
      );
    }
  }
}

// 1. Register User
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const colors = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2'];
  const avatarColor = colors[Math.floor(Math.random() * colors.length)];
  const hash = await bcrypt.hash(password, 10);

  try {
    const [result] = await pool.query(
      'INSERT INTO users (username, password_hash, avatar_color) VALUES (?, ?, ?)',
      [username.trim(), hash, avatarColor]
    );
    const user = { id: result.insertId, username: username.trim(), avatar_color: avatarColor };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '30d' });
    res.json({ user, token });
  } catch (err) {
    res.status(400).json({ error: 'Username already taken' });
  }
});

// 2. Login User
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username?.trim()]);
  if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

  const dbUser = rows;
  const valid = await bcrypt.compare(password, dbUser.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const user = { id: dbUser.id, username: dbUser.username, avatar_color: dbUser.avatar_color };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '30d' });
  res.json({ user, token });
});

// 3. Get User's Groups
app.get('/api/groups', authenticateToken, async (req, res) => {
  const [groups] = await pool.query(
    `SELECT g.*, gm.role FROM \`groups\` g 
     JOIN group_members gm ON g.id = gm.group_id 
     WHERE gm.user_id = ?`,
    [req.user.id]
  );
  res.json(groups);
});

// 4. Create Group
app.post('/api/groups', authenticateToken, async (req, res) => {
  const { name } = req.body;
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const [result] = await pool.query(
    'INSERT INTO `groups` (name, invite_code, created_by) VALUES (?, ?, ?)',
    [name.trim(), inviteCode, req.user.id]
  );
  await pool.query(
    'INSERT INTO group_members (user_id, group_id, role) VALUES (?, ?, ?)',
    [req.user.id, result.insertId, 'admin']
  );
  res.json({ id: result.insertId, name: name.trim(), invite_code: inviteCode, role: 'admin' });
});

// 5. Join Group
app.post('/api/groups/join', authenticateToken, async (req, res) => {
  const { inviteCode } = req.body;
  const [groups] = await pool.query('SELECT * FROM `groups` WHERE invite_code = ?', [inviteCode.trim().toUpperCase()]);
  if (groups.length === 0) return res.status(404).json({ error: 'Invalid invite code' });

  const group = groups;
  await pool.query('INSERT IGNORE INTO group_members (user_id, group_id, role) VALUES (?, ?, ?)', [req.user.id, group.id, 'member']);
  notifyGroup(group.id);
  res.json(group);
});

// 6. Get Full Group Workspace Data (Tasks, Members, Comments, Logs)
app.get('/api/groups/:groupId/workspace', authenticateToken, async (req, res) => {
  const { groupId } = req.params;
  await resetDueRepeatingTasks(groupId);

  const [members] = await pool.query(
    `SELECT u.id, u.username, u.avatar_color, gm.role,
     (SELECT COUNT(*) FROM completion_logs cl WHERE cl.group_id = ? AND cl.user_id = u.id) AS completed_count
     FROM users u
     JOIN group_members gm ON u.id = gm.user_id
     WHERE gm.group_id = ?`,
    [groupId, groupId]
  );

  const [tasks] = await pool.query(
    `SELECT t.*, 
      u_comp.username AS completed_by_name,
      u_assign.username AS assigned_to_name,
      u_assign.avatar_color AS assigned_to_color,
      u_create.username AS created_by_name
     FROM tasks t
     LEFT JOIN users u_comp ON t.completed_by = u_comp.id
     LEFT JOIN users u_assign ON t.assigned_to = u_assign.id
     LEFT JOIN users u_create ON t.created_by = u_create.id
     WHERE t.group_id = ?
     ORDER BY t.is_completed ASC, FIELD(t.priority, 'urgent', 'high', 'medium', 'low'), t.created_at DESC`,
    [groupId]
  );

  const [comments] = await pool.query(
    `SELECT tc.*, u.username, u.avatar_color
     FROM task_comments tc
     JOIN tasks t ON tc.task_id = t.id
     JOIN users u ON tc.user_id = u.id
     WHERE t.group_id = ?
     ORDER BY tc.created_at ASC`,
    [groupId]
  );

  const [logs] = await pool.query(
    `SELECT cl.*, t.title AS task_title, u.username
     FROM completion_logs cl
     JOIN tasks t ON cl.task_id = t.id
     JOIN users u ON cl.user_id = u.id
     WHERE cl.group_id = ?
     ORDER BY cl.completed_at DESC LIMIT 30`,
    [groupId]
  );

  res.json({ members, tasks, comments, logs });
});

// 7. Create Task
app.post('/api/tasks', authenticateToken, async (req, res) => {
  const { groupId, title, type, content, priority, category, dueDate, assignedTo, repeatInterval } = req.body;
  const [result] = await pool.query(
    `INSERT INTO tasks (group_id, created_by, assigned_to, title, type, content, priority, category, due_date, repeat_interval)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      groupId,
      req.user.id,
      assignedTo || null,
      title,
      type,
      JSON.stringify(content),
      priority || 'medium',
      category || 'General',
      dueDate || null,
      repeatInterval || 'none'
    ]
  );
  notifyGroup(groupId);
  res.json({ id: result.insertId });
});

// 8. Edit Task
app.put('/api/tasks/:taskId', authenticateToken, async (req, res) => {
  const { groupId, title, content, priority, category, dueDate, assignedTo, repeatInterval } = req.body;
  await pool.query(
    `UPDATE tasks SET title = ?, content = ?, priority = ?, category = ?, due_date = ?, assigned_to = ?, repeat_interval = ?
     WHERE id = ?`,
    [title, JSON.stringify(content), priority, category, dueDate || null, assignedTo || null, repeatInterval, req.params.taskId]
  );
  notifyGroup(groupId);
  res.json({ success: true });
});

// 9. Toggle Task Complete & Audit Log
app.post('/api/tasks/:taskId/toggle', authenticateToken, async (req, res) => {
  const { groupId, isCompleted } = req.body;
  const { taskId } = req.params;

  if (isCompleted) {
    const now = new Date();
    await pool.query(
      `UPDATE tasks SET is_completed = TRUE, completed_by = ?, completed_at = ? WHERE id = ?`,
      [req.user.id, now, taskId]
    );
    await pool.query(
      `INSERT INTO completion_logs (group_id, task_id, user_id, action, completed_at) VALUES (?, ?, ?, 'completed', ?)`,
      [groupId, taskId, req.user.id, now]
    );
  } else {
    await pool.query(
      `UPDATE tasks SET is_completed = FALSE, completed_by = NULL, completed_at = NULL WHERE id = ?`,
      [taskId]
    );
  }
  notifyGroup(groupId);
  res.json({ success: true });
});

// 10. Add Comment to Task
app.post('/api/tasks/:taskId/comments', authenticateToken, async (req, res) => {
  const { groupId, comment } = req.body;
  await pool.query(
    `INSERT INTO task_comments (task_id, user_id, comment) VALUES (?, ?, ?)`,
    [req.params.taskId, req.user.id, comment]
  );
  notifyGroup(groupId);
  res.json({ success: true });
});

// 11. Delete Task
app.delete('/api/tasks/:taskId', authenticateToken, async (req, res) => {
  const { groupId } = req.query;
  await pool.query('DELETE FROM tasks WHERE id = ?', [req.params.taskId]);
if (groupId) notifyGroup(groupId);
res.json({ success: true });
});
server.listen(5000, '0.0.0.0', () => console.log('Comprehensive API & Socket server running on port 5000'));
