import { Hono } from 'hono'
import { cors } from 'hono/cors'
export { ChatRoom } from './chat'
import { sign, verify } from 'hono/jwt'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
}

const app = new Hono<{ Bindings: Bindings, Variables: { jwtPayload: any } }>()

// Middleware CORS
app.use('/*', cors({
  origin: (origin) => origin || '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

// Middleware for auth
app.use('/*', async (c, next) => {
  const url = new URL(c.req.url)
  const path = url.pathname
  const method = c.req.method

  console.log(`[AUTH] ${method} ${path}`)

  if (c.req.method === 'OPTIONS' || path === '/auth/login' || path === '/auth/register' || path === '/chat/ws') {
    return next()
  }

  const authHeader = c.req.header('Authorization')
  if (!authHeader) {
    console.log('[AUTH] Missing Authorization header')
    return c.json({ error: 'Unauthorized: Missing Authorization header' }, 401)
  }

  const token = authHeader.split(' ')[1]
  if (!token) {
    console.log('[AUTH] Invalid Authorization header format')
    return c.json({ error: 'Unauthorized: Invalid Authorization header' }, 401)
  }
  
  try {
    const payload = await verify(token, c.env.JWT_SECRET || 'fallback-secret', 'HS256')
    console.log(`[AUTH] Success: User ${payload.id}`)
    c.set('jwtPayload', payload)
    return next() // Use return next() to be safer
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log(`[AUTH] Failure: ${msg}`)
    return c.json({ 
      error: 'Unauthorized', 
      reason: msg,
      detail: 'Silakan logout dan login kembali untuk memperbarui session.' 
    }, 401)
  }
})

app.post('/auth/register', async (c) => {
  const { email, password, name } = await c.req.json()
  
  // Basic validation
  if (!email || !password || !name) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  // Web Crypto API for simple SHA-256 hashing (for MVP)
  // Note: For production, use a stronger algorithm like scrypt or pbkdf2
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashedPassword = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  const id = crypto.randomUUID()

  try {
    await c.env.DB.prepare(
      'INSERT INTO users (id, email, name, password) VALUES (?, ?, ?, ?)'
    ).bind(id, email, name, hashedPassword).run()

    return c.json({ message: 'User registered successfully', id })
  } catch (e: any) {
    if (e.message.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'Email already exists' }, 400)
    }
    return c.json({ error: 'Internal server error' }, 500)
  }
})

app.post('/auth/login', async (c) => {
  const { email, password } = await c.req.json()
  
  if (!email || !password) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashedPassword = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE email = ? AND password = ?'
  ).bind(email, hashedPassword).first()

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const token = await sign(
    { id: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 }, // 7 days
    c.env.JWT_SECRET || 'fallback-secret'
  )

  let partner = null;
  if (user.partner_id) {
    partner = await c.env.DB.prepare('SELECT id, email, name, avatar FROM users WHERE id = ?').bind(user.partner_id).first();
  }

  return c.json({ token, user: { id: user.id, email: user.email, name: user.name, partner_id: user.partner_id, avatar: user.avatar }, partner })
})

app.get('/auth/me', async (c) => {
  const payload = c.get('jwtPayload')
  const user = await c.env.DB.prepare('SELECT id, email, name, partner_id, avatar FROM users WHERE id = ?').bind(payload.id).first()
  if (!user) return c.json({ error: 'User not found' }, 404)
  
  let partner = null;
  if (user.partner_id) {
    partner = await c.env.DB.prepare('SELECT id, email, name, avatar FROM users WHERE id = ?').bind(user.partner_id).first();
  }

  return c.json({ user, partner })
})

app.post('/partner/invite', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const id = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours

  try {
    await c.env.DB.prepare(
      'INSERT INTO invites (id, from_user_id, code, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(id, payload.id, code, expiresAt).run()

    return c.json({ message: 'Invite created', code })
  } catch (e) {
    return c.json({ error: 'Failed to create invite' }, 500)
  }
})

app.post('/partner/connect', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const { code } = await c.req.json()
  if (!code) return c.json({ error: 'Missing code' }, 400)

  try {
    const invite = await c.env.DB.prepare(
      'SELECT * FROM invites WHERE code = ? AND is_used = 0 AND expires_at > ?'
    ).bind(code, new Date().toISOString()).first()

    if (!invite) {
      return c.json({ error: 'Invalid or expired code' }, 400)
    }

    if (invite.from_user_id === payload.id) {
      return c.json({ error: 'Cannot connect with yourself' }, 400)
    }

    // Begin pseudo-transaction to update both users and the invite
    // D1 batches can be used, but for MVP we run them sequentially
    await c.env.DB.prepare('UPDATE invites SET is_used = 1 WHERE id = ?').bind(invite.id).run()
    
    // Update the partner_id for both users
    await c.env.DB.prepare('UPDATE users SET partner_id = ? WHERE id = ?').bind(payload.id, invite.from_user_id).run()
    await c.env.DB.prepare('UPDATE users SET partner_id = ? WHERE id = ?').bind(invite.from_user_id, payload.id).run()

    return c.json({ message: 'Successfully connected with partner' })
  } catch (e) {
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// TRANSACTIONS
app.post('/transactions', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
  if (!user || !user.partner_id) return c.json({ error: 'No partner connected' }, 400)
  
  // Create couple_id by sorting and joining
  const couple_id = [payload.id, user.partner_id].sort().join('_')
  
  const { amount, type, category, note } = await c.req.json()
  if (!amount || !type || !category) return c.json({ error: 'Missing fields' }, 400)

  try {
    const res = await c.env.DB.prepare(
      'INSERT INTO transactions (user_id, couple_id, amount, type, category, note) VALUES (?, ?, ?, ?, ?, ?) RETURNING id'
    ).bind(payload.id, couple_id, amount, type, category, note || '').first()
    
    return c.json({ message: 'Transaction saved', id: res?.id })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

app.get('/transactions', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
  if (!user || !user.partner_id) {
    return c.json({ transactions: [] })
  }
  
  const couple_id = [payload.id, user.partner_id].sort().join('_')
  
  const transactions = await c.env.DB.prepare(
    'SELECT * FROM transactions WHERE couple_id = ? ORDER BY created_at DESC LIMIT 50'
  ).bind(couple_id).all()
  
  return c.json({ transactions: transactions.results })
})

// SAVINGS
app.post('/savings', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
  if (!user || !user.partner_id) return c.json({ error: 'No partner connected' }, 400)
  
  const couple_id = [payload.id, user.partner_id].sort().join('_')
  
  const { name, target_amount, deadline } = await c.req.json()
  if (!name || !target_amount) return c.json({ error: 'Missing fields' }, 400)

  try {
    const res = await c.env.DB.prepare(
      'INSERT INTO savings (couple_id, name, target_amount, current_amount, deadline) VALUES (?, ?, ?, 0, ?) RETURNING id'
    ).bind(couple_id, name, target_amount, deadline || null).first()
    
    return c.json({ message: 'Saving created', id: res?.id })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

app.get('/savings', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
  if (!user || !user.partner_id) {
    return c.json({ savings: [] })
  }
  
  const couple_id = [payload.id, user.partner_id].sort().join('_')
  
  const savings = await c.env.DB.prepare(
    'SELECT * FROM savings WHERE couple_id = ? ORDER BY created_at DESC'
  ).bind(couple_id).all()
  
  return c.json({ savings: savings.results })
})

app.post('/savings/:id/topup', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  const { amount } = await c.req.json()
  if (!amount) return c.json({ error: 'Missing amount' }, 400)

  try {
    await c.env.DB.prepare(
      'UPDATE savings SET current_amount = current_amount + ? WHERE id = ?'
    ).bind(amount, id).run()

    return c.json({ message: 'Top up successful' })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

// PROFILE
app.put('/profile', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)
  const { name, birthday, anniversary, bio } = await c.req.json()
  
  try {
    await c.env.DB.prepare('UPDATE users SET name = ?, birthday = ?, anniversary = ?, bio = ? WHERE id = ?')
      .bind(name, birthday, anniversary, bio, payload.id)
      .run()
    return c.json({ message: 'Profile updated' })
  } catch(e) { return c.json({ error: 'Database error' }, 500) }
})

app.post('/profile/avatar', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)
  
  const body = await c.req.parseBody()
  const file = body['file']
  
  if (!(file instanceof File)) return c.json({ error: 'No file uploaded' }, 400)
  
  const fileName = `avatars/${payload.id}/${Date.now()}-${file.name}`
  await c.env.USER_AVATARS.put(fileName, file)
  
  const avatarUrl = `https://avatars.couplegrow.com/${fileName}` // Assume custom domain or construct r2 url
  
  await c.env.DB.prepare('UPDATE users SET avatar = ? WHERE id = ?').bind(avatarUrl, payload.id).run()
  
  return c.json({ avatarUrl })
})

// FOLDERS
app.post('/folders', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)
  const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
  const couple_id = [payload.id, user?.partner_id || ''].sort().join('_')
  const { name } = await c.req.json()
  
  try {
    const res = await c.env.DB.prepare('INSERT INTO folders (couple_id, name) VALUES (?, ?) RETURNING id').bind(couple_id, name).first()
    return c.json({ message: 'Folder created', id: res?.id })
  } catch(e) { return c.json({ error: 'Database error' }, 500) }
})

app.get('/folders', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)
  const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
  const couple_id = [payload.id, user?.partner_id || ''].sort().join('_')
  
  const folders = await c.env.DB.prepare('SELECT * FROM folders WHERE couple_id = ? ORDER BY created_at ASC').bind(couple_id).all()
  return c.json({ folders: folders.results })
})

app.delete('/folders/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM notes WHERE folder_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM folders WHERE id = ?').bind(id).run()
  return c.json({ message: 'Deleted' })
})

// NOTES
app.post('/notes', async (c) => {
  const { folder_id, title, content } = await c.req.json()
  try {
    const res = await c.env.DB.prepare('INSERT INTO notes (folder_id, title, content) VALUES (?, ?, ?) RETURNING id').bind(folder_id, title, content || '').first()
    return c.json({ message: 'Note created', id: res?.id })
  } catch(e) { return c.json({ error: 'Database error' }, 500) }
})

app.get('/notes', async (c) => {
  const folder_id = c.req.query('folder_id')
  if (!folder_id) return c.json({ notes: [] })
  const notes = await c.env.DB.prepare('SELECT * FROM notes WHERE folder_id = ? ORDER BY updated_at DESC').bind(folder_id).all()
  return c.json({ notes: notes.results })
})

app.get('/notes/:id', async (c) => {
  const id = c.req.param('id')
  const note = await c.env.DB.prepare('SELECT * FROM notes WHERE id = ?').bind(id).first()
  return c.json({ note })
})

app.put('/notes/:id', async (c) => {
  const id = c.req.param('id')
  const { title, content, checklist } = await c.req.json()
  const checklistJson = checklist ? JSON.stringify(checklist) : null
  await c.env.DB.prepare(
    'UPDATE notes SET title = ?, content = ?, checklist = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(title, content, checklistJson, id).run()
  return c.json({ message: 'Updated' })
})

app.delete('/notes/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM notes WHERE id = ?').bind(id).run()
  return c.json({ message: 'Deleted' })
})

// STATS ENDPOINT
app.get('/transactions/stats', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)
  const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
  if (!user || !user.partner_id) {
    return c.json({ monthly: [], categories: [] })
  }
  const couple_id = [payload.id, user.partner_id].sort().join('_')

  // Get monthly stats: last 6 months
  const stats = await c.env.DB.prepare(`
    SELECT
      strftime('%Y-%m', created_at) as month,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense
    FROM transactions
    WHERE couple_id = ? AND created_at >= date('now', '-6 months')
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY month ASC
  `).bind(couple_id).all()

  // Get category breakdown for current month
  const categories = await c.env.DB.prepare(`
    SELECT category, SUM(amount) as total
    FROM transactions
    WHERE couple_id = ? AND type = 'expense' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
    GROUP BY category
    ORDER BY total DESC
    LIMIT 5
  `).bind(couple_id).all()

  return c.json({ monthly: stats.results, categories: categories.results })
})

// CHAT HTTP (Fallback / Fetch History)
app.get('/chat/history', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)
  const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
  const couple_id = [payload.id, user?.partner_id || ''].sort().join('_')

  const saving_id = c.req.query('saving_id') || null

  // Find or create the room (global or per-saving)
  let room
  if (saving_id) {
    room = await c.env.DB.prepare('SELECT id FROM chat_rooms WHERE couple_id = ? AND saving_id = ?').bind(couple_id, saving_id).first()
    if (!room) {
      room = await c.env.DB.prepare('INSERT INTO chat_rooms (couple_id, saving_id, name) VALUES (?, ?, ?) RETURNING id').bind(couple_id, saving_id, 'Saving Chat').first()
    }
  } else {
    room = await c.env.DB.prepare('SELECT id FROM chat_rooms WHERE couple_id = ? AND saving_id IS NULL').bind(couple_id).first()
    if (!room) {
      room = await c.env.DB.prepare('INSERT INTO chat_rooms (couple_id, name) VALUES (?, ?) RETURNING id').bind(couple_id, 'Global').first()
    }
  }

  const messages = await c.env.DB.prepare('SELECT * FROM messages WHERE room_id = ? ORDER BY created_at ASC LIMIT 100').bind(room?.id).all()
  return c.json({ room_id: room?.id, messages: messages.results })
})

app.post('/chat/send', async (c) => {
  const payload = c.get('jwtPayload')
  const { room_id, message } = await c.req.json()
  const res = await c.env.DB.prepare('INSERT INTO messages (room_id, sender_id, message) VALUES (?, ?, ?) RETURNING *').bind(room_id, payload.id, message).first()
  return c.json({ message: res })
})

// CHAT WEBSOCKET (Durable Object Endpoint)
app.get('/chat/ws', async (c) => {
  // Try header first, then query param for WS
  let token = c.req.header('Authorization')?.split(' ')[1]
  if (!token) token = c.req.query('token')
  
  if (!token) return c.json({ error: 'Unauthorized' }, 401)
  
  let payload;
  try {
    payload = await verify(token, c.env.JWT_SECRET || 'fallback-secret')
  } catch(e) { return c.json({ error: 'Unauthorized' }, 401) }

  const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
  const couple_id = [payload.id, user?.partner_id || ''].sort().join('_')

  // Use couple_id as the name to get a unique Durable Object per couple
  const id = c.env.CHAT_ROOM.idFromName(couple_id)
  const stub = c.env.CHAT_ROOM.get(id)

  return stub.fetch(c.req.raw)
})

export default app
