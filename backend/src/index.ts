import { Hono } from 'hono'
import { cors } from 'hono/cors'
export { ChatRoom } from './chat'
import { sign, verify } from 'hono/jwt'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  MEDIA: R2Bucket
  CHAT_ROOM: DurableObjectNamespace
  ASSETS: Fetcher
  RESEND_API_KEY: string
  RESET_EMAIL_FROM?: string
  RESET_EMAIL_FROM_NAME?: string
}

const app = new Hono<{ Bindings: Bindings, Variables: { jwtPayload: any } }>()

async function ensureAttributionColumns(db: D1Database) {
  for (const table of ['savings', 'folders', 'notes', 'budgets', 'wishlists']) {
    for (const column of ['created_by TEXT', 'updated_by TEXT', 'updated_at DATETIME']) {
      try { await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column}`).run() } catch (_) { /* already exists */ }
    }
  }
}

async function notifyPartner(db: D1Database, partnerId: string | undefined, actorId: string, type: string, title: string, message: string, link: string) {
  if (!partnerId) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, actor_id TEXT,
    type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, link TEXT,
    is_read BOOLEAN DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run()
  await db.prepare('INSERT INTO notifications (user_id, actor_id, type, title, message, link) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(partnerId, actorId, type, title, message, link).run()
}

async function hashPassword(password: string) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

async function sendPasswordResetEmail(c: any, to: string, code: string) {
  const fromEmail = c.env.RESET_EMAIL_FROM || 'noreply@uwangraph.com'
  const fromName = c.env.RESET_EMAIL_FROM_NAME || 'CoupleGrow'
  const safeCode = escapeHtml(code)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: 'Kode reset password CoupleGrow',
      html: `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Reset Password CoupleGrow</title></head>
<body style="margin:0;padding:0;background-color:#f0f4ff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f4ff;padding:40px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

<!-- HEADER -->
<tr><td align="center" style="background:linear-gradient(135deg,#0C8CE9 0%,#7c3aed 100%);border-radius:20px 20px 0 0;padding:40px 32px 32px;">
<p style="margin:0 0 12px;font-size:40px;text-align:center;">💝</p>
<p style="margin:0;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;text-align:center;">CoupleGrow</p>
<p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,0.8);letter-spacing:2px;text-transform:uppercase;text-align:center;">Tumbuh bersama, dari sekarang</p>
</td></tr>

<!-- BODY -->
<tr><td style="background:#ffffff;padding:40px 40px 32px;">
<p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b;">Reset Password Kamu 🔐</p>
<p style="margin:0 0 28px;font-size:15px;color:#64748b;line-height:1.6;">Hei! Kami menerima permintaan untuk mereset password akun CoupleGrow kamu. Gunakan kode di bawah ini untuk melanjutkan.</p>

<!-- OTP BOX -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
<tr><td align="center" style="background:linear-gradient(135deg,#e0e7ff 0%,#f5f3ff 100%);border:2px dashed #8b5cf6;border-radius:16px;padding:28px 20px;">
<p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#0C8CE9;letter-spacing:3px;text-transform:uppercase;">Kode Verifikasi</p>
<p style="margin:0;font-size:52px;font-weight:800;color:#0C8CE9;letter-spacing:18px;">${safeCode}</p>
<p style="margin:12px 0 0;font-size:13px;color:#64748b;">Berlaku selama <strong style="color:#0C8CE9;">15 menit</strong></p>
</td></tr>
</table>

<!-- WARNING BOX -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
<tr><td style="background:#fef9c3;border-left:4px solid #facc15;border-radius:0 8px 8px 0;padding:14px 16px;">
<p style="margin:0;font-size:13px;color:#854d0e;line-height:1.5;">⚠️ <strong>Jangan bagikan kode ini ke siapapun</strong>, termasuk tim CoupleGrow. Kami tidak pernah meminta kode ini.</p>
</td></tr>
</table>

<p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.6;">Kalau kamu tidak meminta reset password, abaikan saja email ini. Password kamu tidak akan berubah.</p>

<!-- CTA BUTTON -->
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center">
<a href="https://couple-grow.pages.dev/login?email=${encodeURIComponent(to)}&code=${safeCode}" style="display:inline-block;background:linear-gradient(135deg,#0C8CE9 0%,#7c3aed 100%);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;letter-spacing:0.3px;">Buka CoupleGrow →</a>
</td></tr>
</table>
</td></tr>

<!-- DIVIDER -->
<tr><td style="background:#ffffff;padding:0 40px;"><hr style="border:none;border-top:1px solid #f1f5f9;margin:0;"/></td></tr>

<!-- FOOTER -->
<tr><td style="background:#ffffff;border-radius:0 0 20px 20px;padding:24px 40px 32px;text-align:center;">
<p style="margin:0 0 4px;font-size:13px;color:#94a3b8;">Dikirim oleh</p>
<p style="margin:0 0 16px;font-size:14px;font-weight:700;color:#0C8CE9;">CoupleGrow Team</p>
<p style="margin:0;font-size:12px;color:#cbd5e1;">© ${new Date().getFullYear()} CoupleGrow</p>
</td></tr>

<tr><td style="height:24px;"></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
      text: `Kode reset password CoupleGrow kamu: ${code}. Kode ini berlaku selama 15 menit. Abaikan email ini kalau kamu tidak meminta reset password.`,
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Resend error ${res.status}: ${errBody}`)
  }
}

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
  if (path !== '/auth/login' && path !== '/auth/register') await ensureAttributionColumns(c.env.DB)

  if (
    c.req.method === 'OPTIONS' ||
    path === '/auth/login' ||
    path === '/auth/register' ||
    path === '/auth/forgot-password' ||
    path === '/auth/reset-password' ||
    path === '/chat/ws' ||
    path.startsWith('/r2/')
  ) {
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

  const hashedPassword = await hashPassword(password)

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

  const hashedPassword = await hashPassword(password)

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
    partner = await c.env.DB.prepare('SELECT id, email, name, avatar, birthday, anniversary, bio, phone FROM users WHERE id = ?').bind(user.partner_id).first();
  }

  return c.json({ token, user: { id: user.id, email: user.email, name: user.name, partner_id: user.partner_id, avatar: user.avatar }, partner })
})

app.get('/auth/me', async (c) => {
  const payload = c.get('jwtPayload')
  const user = await c.env.DB.prepare('SELECT id, email, name, partner_id, avatar, birthday, anniversary, bio, phone FROM users WHERE id = ?').bind(payload.id).first()
  if (!user) return c.json({ error: 'User not found' }, 404)
  
  let partner = null;
  if (user.partner_id) {
    partner = await c.env.DB.prepare('SELECT id, email, name, avatar, birthday, anniversary, bio, phone FROM users WHERE id = ?').bind(user.partner_id).first();
  }

  return c.json({ user, partner })
})

// FORGOT PASSWORD - generate a reset code (no email service needed; user sees code on screen)
app.post('/auth/forgot-password', async (c) => {
  const { email } = await c.req.json()
  if (!email) return c.json({ error: 'Email wajib diisi' }, 400)

  const user = await c.env.DB.prepare('SELECT id, email FROM users WHERE email = ?').bind(email).first()
  if (!user) {
    return c.json({ message: 'Jika email terdaftar, kode reset akan dikirim.' })
  }

  // Generate 6-digit reset code
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes

  try {
    await c.env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(user.id).run()
    await c.env.DB.prepare(
      'INSERT INTO password_resets (user_id, code, expires_at) VALUES (?, ?, ?)'
    ).bind(user.id, code, expiresAt).run()

    try {
      await sendPasswordResetEmail(c, String(user.email), code)
    } catch (emailError) {
      await c.env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(user.id).run()
      throw emailError
    }

    return c.json({ message: 'Jika email terdaftar, kode reset akan dikirim.' })
  } catch (e: any) {
    // If table doesn't exist, create it and retry
    if (e.message?.includes('no such table')) {
      await c.env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS password_resets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          code TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          used INTEGER DEFAULT 0
        )
      `).run()
      await c.env.DB.prepare(
        'INSERT INTO password_resets (user_id, code, expires_at) VALUES (?, ?, ?)'
      ).bind(user.id, code, expiresAt).run()
      try {
        await sendPasswordResetEmail(c, String(user.email), code)
      } catch (emailError) {
        await c.env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(user.id).run()
        throw emailError
      }
      return c.json({ message: 'Jika email terdaftar, kode reset akan dikirim.' })
    }
    console.log(`[AUTH] Failed to send password reset email: ${e.message || String(e)}`)
    return c.json({ error: 'Gagal mengirim kode reset. Coba lagi nanti.' }, 500)
  }
})

// RESET PASSWORD - verify code and set new password
app.post('/auth/reset-password', async (c) => {
  const { email, code, new_password } = await c.req.json()
  if (!email || !code || !new_password) return c.json({ error: 'Semua field wajib diisi' }, 400)
  if (new_password.length < 6) return c.json({ error: 'Password minimal 6 karakter' }, 400)

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  if (!user) return c.json({ error: 'Email tidak ditemukan' }, 404)

  const reset = await c.env.DB.prepare(
    'SELECT * FROM password_resets WHERE user_id = ? AND code = ? AND used = 0 AND expires_at > ?'
  ).bind(user.id, code, new Date().toISOString()).first()

  if (!reset) return c.json({ error: 'Kode tidak valid atau sudah kadaluarsa' }, 400)

  const hashedPassword = await hashPassword(new_password)

  await c.env.DB.prepare('UPDATE users SET password = ? WHERE id = ?').bind(hashedPassword, user.id).run()
  await c.env.DB.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').bind(reset.id).run()

  return c.json({ message: 'Password berhasil diubah. Silakan login kembali.' })
})

// CHANGE PASSWORD - when already logged in
app.put('/auth/change-password', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const { current_password, new_password } = await c.req.json()
  if (!current_password || !new_password) return c.json({ error: 'Semua field wajib diisi' }, 400)
  if (new_password.length < 6) return c.json({ error: 'Password baru minimal 6 karakter' }, 400)

  const currentHashed = await hashPassword(current_password)

  const user = await c.env.DB.prepare('SELECT id, password FROM users WHERE id = ?').bind(payload.id).first()
  if (!user) return c.json({ error: 'User tidak ditemukan' }, 404)
  if (user.password !== currentHashed) return c.json({ error: 'Password saat ini tidak sesuai' }, 400)

  const newHashed = await hashPassword(new_password)

  await c.env.DB.prepare('UPDATE users SET password = ? WHERE id = ?').bind(newHashed, payload.id).run()
  return c.json({ message: 'Password berhasil diubah' })
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

    // Check if current user already has a partner
    const currentUser = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
    if (currentUser?.partner_id) {
      return c.json({ error: 'You already have a partner connected' }, 400)
    }

    // Check if the invite sender already has a partner
    const inviteSender = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(invite.from_user_id).first()
    if (inviteSender?.partner_id) {
      return c.json({ error: 'The invite sender already has a partner' }, 400)
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

app.delete('/partner/disconnect', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const user = await c.env.DB.prepare(
      'SELECT partner_id FROM users WHERE id = ?'
    ).bind(payload.id).first()

    if (!user || !user.partner_id) {
      return c.json({ error: 'No partner connected' }, 400)
    }

    const partnerId = user.partner_id as string

    // Lepaskan kedua sisi
    await c.env.DB.prepare(
      'UPDATE users SET partner_id = NULL WHERE id = ?'
    ).bind(payload.id).run()

    await c.env.DB.prepare(
      'UPDATE users SET partner_id = NULL WHERE id = ?'
    ).bind(partnerId).run()

    return c.json({ message: 'Partner disconnected successfully' })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
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
    await notifyPartner(c.env.DB, user.partner_id, payload.id, 'transaction', 'Transaksi baru', `${category} ditambahkan ke dompet`, '/wallet')
    
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
    `SELECT t.*, u.name as user_name, u.avatar as user_avatar
     FROM transactions t
     JOIN users u ON t.user_id = u.id
     WHERE t.couple_id = ? ORDER BY t.created_at DESC LIMIT 50`
  ).bind(couple_id).all()
  
  return c.json({ transactions: transactions.results })
})

app.put('/transactions/:id', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  const { amount, type, category, note } = await c.req.json()

  try {
    const txn = await c.env.DB.prepare(
      'SELECT user_id FROM transactions WHERE id = ?'
    ).bind(id).first()
    if (!txn) return c.json({ error: 'Transaction not found' }, 404)
    if (txn.user_id !== payload.id) return c.json({ error: 'Unauthorized' }, 403)

    const updates: string[] = []
    const values: any[] = []
    if (amount !== undefined) { updates.push('amount = ?'); values.push(amount); }
    if (type !== undefined) { updates.push('type = ?'); values.push(type); }
    if (category !== undefined) { updates.push('category = ?'); values.push(category); }
    if (note !== undefined) { updates.push('note = ?'); values.push(note); }

    if (updates.length === 0) return c.json({ error: 'No fields to update' }, 400)
    values.push(id)

    await c.env.DB.prepare(
      `UPDATE transactions SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run()

    return c.json({ message: 'Transaction updated' })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

app.delete('/transactions/:id', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')

  try {
    const txn = await c.env.DB.prepare(
      'SELECT user_id FROM transactions WHERE id = ?'
    ).bind(id).first()
    if (!txn) return c.json({ error: 'Transaction not found' }, 404)
    if (txn.user_id !== payload.id) return c.json({ error: 'Unauthorized' }, 403)

    await c.env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(id).run()
    return c.json({ message: 'Transaction deleted' })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

// ANALYTICS
app.get('/analytics/spending-pattern', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
  if (!user || !user.partner_id) return c.json({ pattern: [] })
  
  const couple_id = [payload.id, user.partner_id].sort().join('_')
  const { period = 'week' } = c.req.query() // week or month

  try {
    let groupBy = ''
    let dateFormat = ''
    
    if (period === 'week') {
      // Last 7 days
      groupBy = "date(created_at)"
      dateFormat = "SELECT date(created_at) as date, SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense, SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income FROM transactions WHERE couple_id = ? AND created_at >= datetime('now', '-7 days') GROUP BY date(created_at) ORDER BY date ASC"
    } else {
      // Last 6 months
      groupBy = "strftime('%Y-%m', created_at)"
      dateFormat = "SELECT strftime('%Y-%m', created_at) as period, SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense, SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income FROM transactions WHERE couple_id = ? AND created_at >= datetime('now', '-6 months') GROUP BY strftime('%Y-%m', created_at) ORDER BY period ASC"
    }

    const pattern = await c.env.DB.prepare(dateFormat).bind(couple_id).all()
    return c.json({ pattern: pattern.results })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

app.get('/analytics/category-breakdown', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
  if (!user || !user.partner_id) return c.json({ breakdown: [] })
  
  const couple_id = [payload.id, user.partner_id].sort().join('_')
  const { period = 'month' } = c.req.query() // month, 3months, year

  try {
    let dateFilter = ''
    if (period === 'month') {
      dateFilter = "datetime('now', '-1 month')"
    } else if (period === '3months') {
      dateFilter = "datetime('now', '-3 months')"
    } else {
      dateFilter = "datetime('now', '-1 year')"
    }

    const breakdown = await c.env.DB.prepare(
      `SELECT category, SUM(amount) as total, COUNT(*) as count 
       FROM transactions 
       WHERE couple_id = ? AND type = 'expense' AND created_at >= ${dateFilter}
       GROUP BY category 
       ORDER BY total DESC`
    ).bind(couple_id).all()

    return c.json({ breakdown: breakdown.results })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

app.get('/analytics/compare-months', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
  if (!user || !user.partner_id) return c.json({ comparison: {} })
  
  const couple_id = [payload.id, user.partner_id].sort().join('_')

  try {
    // Current month
    const currentMonth = await c.env.DB.prepare(
      `SELECT 
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        COUNT(CASE WHEN type = 'expense' THEN 1 END) as expense_count
       FROM transactions 
       WHERE couple_id = ? AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
    ).bind(couple_id).first()

    // Previous month
    const previousMonth = await c.env.DB.prepare(
      `SELECT 
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        COUNT(CASE WHEN type = 'expense' THEN 1 END) as expense_count
       FROM transactions 
       WHERE couple_id = ? AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', '-1 month')`
    ).bind(couple_id).first()

    const currentExpense = (currentMonth?.expense as number) || 0
    const previousExpense = (previousMonth?.expense as number) || 0
    
    const difference = previousExpense > 0 
      ? Math.round(((previousExpense - currentExpense) / previousExpense) * 100)
      : 0

    return c.json({ 
      comparison: {
        current: currentMonth,
        previous: previousMonth,
        difference_percentage: difference,
        status: difference > 0 ? 'hemat' : difference < 0 ? 'boros' : 'sama'
      }
    })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

app.get('/analytics/savings-velocity', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
  if (!user || !user.partner_id) return c.json({ velocity: [] })
  
  const couple_id = [payload.id, user.partner_id].sort().join('_')

  try {
    const savings = await c.env.DB.prepare(
      'SELECT id, name, target_amount, current_amount, created_at FROM savings WHERE couple_id = ?'
    ).bind(couple_id).all()

    const velocities = []
    
    for (const saving of savings.results as any[]) {
      // Calculate days since created
      const created = new Date(saving.created_at)
      const now = new Date()
      const daysPassed = Math.max(1, Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)))
      
      // Calculate average per day
      const avgPerDay = saving.current_amount / daysPassed
      
      // Calculate days needed to reach target
      const remaining = saving.target_amount - saving.current_amount
      const daysNeeded = remaining > 0 && avgPerDay > 0 ? Math.ceil(remaining / avgPerDay) : 0
      
      // Convert to months
      const monthsNeeded = Math.ceil(daysNeeded / 30)
      
      // Estimated completion date
      const estimatedDate = new Date()
      estimatedDate.setDate(estimatedDate.getDate() + daysNeeded)

      velocities.push({
        saving_id: saving.id,
        name: saving.name,
        current_amount: saving.current_amount,
        target_amount: saving.target_amount,
        days_passed: daysPassed,
        avg_per_day: Math.round(avgPerDay),
        days_needed: daysNeeded,
        months_needed: monthsNeeded,
        estimated_completion: daysNeeded > 0 ? estimatedDate.toISOString() : null,
        velocity_status: avgPerDay > 0 ? 'on_track' : 'stalled'
      })
    }

    return c.json({ velocity: velocities })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
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
      'INSERT INTO savings (couple_id, name, target_amount, current_amount, deadline, created_by, updated_by) VALUES (?, ?, ?, 0, ?, ?, ?) RETURNING id'
    ).bind(couple_id, name, target_amount, deadline || null, payload.id, payload.id).first()
    
    // Log activity: created
    await c.env.DB.prepare(
      'INSERT INTO saving_activities (saving_id, user_id, type, amount, note) VALUES (?, ?, ?, ?, ?)'
    ).bind(res?.id, payload.id, 'created', target_amount, `Target: ${name}`).run()
    await notifyPartner(c.env.DB, user.partner_id, payload.id, 'saving', 'Tabungan baru', `${name} dibuat bersama`, '/savings')
    
    return c.json({ message: 'Saving created', id: res?.id })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

app.get('/savings/:id', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')

  try {
    const saving = await c.env.DB.prepare(
      `SELECT s.*, u.name as creator_name, u.avatar as creator_avatar
       FROM savings s
       LEFT JOIN saving_activities sa ON sa.saving_id = s.id AND sa.type = 'created'
       LEFT JOIN users u ON sa.user_id = u.id
       WHERE s.id = ?`
    ).bind(id).first()

    if (!saving) return c.json({ error: 'Saving not found' }, 404)

    return c.json({ saving })
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
    `SELECT s.*, u.name as creator_name, u.avatar as creator_avatar
     FROM savings s
     LEFT JOIN saving_activities sa ON sa.saving_id = s.id AND sa.type = 'created'
     LEFT JOIN users u ON sa.user_id = u.id
     WHERE s.couple_id = ? ORDER BY s.created_at DESC`
  ).bind(couple_id).all()
  
  return c.json({ savings: savings.results })
})

app.post('/savings/:id/topup', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  const { amount, note } = await c.req.json()
  if (!amount) return c.json({ error: 'Missing amount' }, 400)

  try {
    // Get saving info before update
    const saving = await c.env.DB.prepare(
      'SELECT current_amount, target_amount FROM savings WHERE id = ?'
    ).bind(id).first()
    
    if (!saving) return c.json({ error: 'Saving not found' }, 404)
    
    const oldAmount = saving.current_amount as number
    const targetAmount = saving.target_amount as number
    const newAmount = oldAmount + amount
    
    // Calculate milestone
    const oldPct = Math.floor((oldAmount / targetAmount) * 100)
    const newPct = Math.floor((newAmount / targetAmount) * 100)
    
    // Update saving
    await c.env.DB.prepare(
      'UPDATE savings SET current_amount = current_amount + ? WHERE id = ?'
    ).bind(amount, id).run()

    // Log activity: topup
    await c.env.DB.prepare(
      'INSERT INTO saving_activities (saving_id, user_id, type, amount, note) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, payload.id, 'topup', amount, note || null).run()
    
    // Check for milestone reached (25%, 50%, 75%, 100%)
    const milestones = [25, 50, 75, 100]
    for (const milestone of milestones) {
      if (oldPct < milestone && newPct >= milestone) {
        await c.env.DB.prepare(
          'INSERT INTO saving_activities (saving_id, user_id, type, amount, metadata) VALUES (?, ?, ?, ?, ?)'
        ).bind(id, payload.id, 'milestone', newAmount, JSON.stringify({ percentage: milestone })).run()
      }
    }

    return c.json({ 
      message: 'Top up successful',
      milestone: milestones.find(m => oldPct < m && newPct >= m) || null
    })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

app.post('/savings/:id/deduct', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  const { amount, note } = await c.req.json()
  if (!amount) return c.json({ error: 'Missing amount' }, 400)

  try {
    // Get current amount first to validate
    const saving = await c.env.DB.prepare(
      'SELECT current_amount FROM savings WHERE id = ?'
    ).bind(id).first()
    
    if (!saving) return c.json({ error: 'Saving not found' }, 404)
    
    const currentAmount = saving.current_amount as number
    if (currentAmount < amount) {
      return c.json({ error: 'Insufficient balance in savings' }, 400)
    }

    await c.env.DB.prepare(
      'UPDATE savings SET current_amount = current_amount - ? WHERE id = ?'
    ).bind(amount, id).run()

    // Log activity: deduct
    await c.env.DB.prepare(
      'INSERT INTO saving_activities (saving_id, user_id, type, amount, note) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, payload.id, 'deduct', amount, note || null).run()

    return c.json({ message: 'Deduction successful' })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

app.put('/savings/:id', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  const { name, target_amount, deadline } = await c.req.json()
  
  if (!name && !target_amount && deadline === undefined) {
    return c.json({ error: 'No fields to update' }, 400)
  }

  try {
    // Verify saving exists and belongs to couple
    const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
    if (!user || !user.partner_id) return c.json({ error: 'No partner connected' }, 400)
    
    const couple_id = [payload.id, user.partner_id].sort().join('_')
    const saving = await c.env.DB.prepare(
      'SELECT couple_id FROM savings WHERE id = ?'
    ).bind(id).first()
    
    if (!saving) return c.json({ error: 'Saving not found' }, 404)
    if (saving.couple_id !== couple_id) return c.json({ error: 'Unauthorized' }, 403)

    // Build dynamic update query
    const updates: string[] = []
    const values: any[] = []
    
    if (name) {
      updates.push('name = ?')
      values.push(name)
    }
    if (target_amount) {
      updates.push('target_amount = ?')
      values.push(target_amount)
    }
    if (deadline !== undefined) {
      updates.push('deadline = ?')
      values.push(deadline || null)
    }
    updates.push('updated_by = ?', 'updated_at = CURRENT_TIMESTAMP')
    values.push(payload.id)
    
    values.push(id)
    
    await c.env.DB.prepare(
      `UPDATE savings SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run()

    // Log activity: updated
    await c.env.DB.prepare(
      'INSERT INTO saving_activities (saving_id, user_id, type, note) VALUES (?, ?, ?, ?)'
    ).bind(id, payload.id, 'updated', 'Tabungan diupdate').run()

    return c.json({ message: 'Saving updated successfully' })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

app.delete('/savings/:id', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')

  try {
    // Verify saving exists and belongs to couple
    const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
    if (!user || !user.partner_id) return c.json({ error: 'No partner connected' }, 400)
    
    const couple_id = [payload.id, user.partner_id].sort().join('_')
    const saving = await c.env.DB.prepare(
      'SELECT couple_id FROM savings WHERE id = ?'
    ).bind(id).first()
    
    if (!saving) return c.json({ error: 'Saving not found' }, 404)
    if (saving.couple_id !== couple_id) return c.json({ error: 'Unauthorized' }, 403)

    await c.env.DB.prepare('DELETE FROM savings WHERE id = ?').bind(id).run()

    return c.json({ message: 'Saving deleted successfully' })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

// SAVING ACTIVITIES (History & Contribution Tracking)
app.get('/savings/:id/activities', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')

  try {
    const activities = await c.env.DB.prepare(
      `SELECT sa.*, u.name as user_name 
       FROM saving_activities sa 
       JOIN users u ON sa.user_id = u.id 
       WHERE sa.saving_id = ? 
       ORDER BY sa.created_at DESC`
    ).bind(id).all()

    return c.json({ activities: activities.results })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

app.get('/savings/:id/contributions', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')

  try {
    const contributions = await c.env.DB.prepare(
      `SELECT u.id, u.name, u.avatar, 
       SUM(CASE WHEN sa.type = 'topup' THEN sa.amount ELSE 0 END) as total_topup,
       SUM(CASE WHEN sa.type = 'deduct' THEN sa.amount ELSE 0 END) as total_deduct,
       SUM(CASE WHEN sa.type = 'topup' THEN sa.amount ELSE 0 END) - 
       SUM(CASE WHEN sa.type = 'deduct' THEN sa.amount ELSE 0 END) as net_contribution
       FROM saving_activities sa
       JOIN users u ON sa.user_id = u.id
       WHERE sa.saving_id = ? AND sa.type IN ('topup', 'deduct')
       GROUP BY u.id, u.name, u.avatar`
    ).bind(id).all()

    return c.json({ contributions: contributions.results })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

// BUDGETS
app.get('/budgets', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
  if (!user || !user.partner_id) return c.json({ budgets: [] })
  
  const couple_id = [payload.id, user.partner_id].sort().join('_')
  
  // Get current month and year
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  try {
    const budgets = await c.env.DB.prepare(
      'SELECT * FROM budgets WHERE couple_id = ? AND period_month = ? AND period_year = ?'
    ).bind(couple_id, month, year).all()

    return c.json({ budgets: budgets.results })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

app.post('/budgets', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
  if (!user || !user.partner_id) return c.json({ error: 'No partner connected' }, 400)
  
  const couple_id = [payload.id, user.partner_id].sort().join('_')
  
  const { category, amount, period_month, period_year } = await c.req.json()
  if (!category || !amount) return c.json({ error: 'Missing fields' }, 400)

  // Default to current period if not specified
  const now = new Date()
  const month = period_month || now.getMonth() + 1
  const year = period_year || now.getFullYear()

  try {
    await c.env.DB.prepare(
      'INSERT OR REPLACE INTO budgets (couple_id, category, amount, period_month, period_year, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(couple_id, category, amount, month, year, payload.id, payload.id).run()
    await notifyPartner(c.env.DB, user.partner_id, payload.id, 'budget', 'Budget baru', `Budget ${category} telah dibuat`, '/budget')

    return c.json({ message: 'Budget set successfully' })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

app.delete('/budgets/:id', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')

  try {
    await c.env.DB.prepare('DELETE FROM budgets WHERE id = ?').bind(id).run()
    return c.json({ message: 'Budget deleted successfully' })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

// SPLIT BILLS
app.post('/transactions/split', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
  if (!user || !user.partner_id) return c.json({ error: 'No partner connected' }, 400)
  
  const couple_id = [payload.id, user.partner_id].sort().join('_')
  
  const { amount, category, note, splits } = await c.req.json()
  // splits = [{ user_id, amount }, { user_id, amount }]
  if (!amount || !category || !splits || splits.length === 0) {
    return c.json({ error: 'Missing fields' }, 400)
  }

  try {
    // Create main transaction
    const txn = await c.env.DB.prepare(
      'INSERT INTO transactions (user_id, couple_id, amount, type, category, note) VALUES (?, ?, ?, ?, ?, ?) RETURNING id'
    ).bind(payload.id, couple_id, amount, 'expense', category, note || null).first()

    // Create split records
    for (const split of splits) {
      await c.env.DB.prepare(
        'INSERT INTO transaction_splits (transaction_id, user_id, amount) VALUES (?, ?, ?)'
      ).bind(txn?.id, split.user_id, split.amount).run()
    }

    return c.json({ message: 'Split transaction created', id: txn?.id })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

app.get('/transactions/:id/splits', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')

  try {
    const splits = await c.env.DB.prepare(
      `SELECT ts.*, u.name as user_name, u.avatar 
       FROM transaction_splits ts 
       JOIN users u ON ts.user_id = u.id 
       WHERE ts.transaction_id = ?`
    ).bind(id).all()

    return c.json({ splits: splits.results })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

app.put('/transactions/splits/:id/pay', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')

  try {
    await c.env.DB.prepare(
      'UPDATE transaction_splits SET is_paid = 1 WHERE id = ?'
    ).bind(id).run()

    return c.json({ message: 'Split marked as paid' })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

// WISHLIST
app.get('/wishlists', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
  if (!user || !user.partner_id) return c.json({ wishlists: [] })
  
  const couple_id = [payload.id, user.partner_id].sort().join('_')

  try {
    const wishlists = await c.env.DB.prepare(
      'SELECT * FROM wishlists WHERE couple_id = ? ORDER BY priority DESC, created_at DESC'
    ).bind(couple_id).all()

    return c.json({ wishlists: wishlists.results })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

app.post('/wishlists', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
  if (!user || !user.partner_id) return c.json({ error: 'No partner connected' }, 400)
  
  const couple_id = [payload.id, user.partner_id].sort().join('_')
  
  const { name, description, estimated_price, priority, image_url, linked_saving_id } = await c.req.json()
  if (!name) return c.json({ error: 'Missing name' }, 400)

  try {
    const res = await c.env.DB.prepare(
      'INSERT INTO wishlists (couple_id, name, description, estimated_price, priority, image_url, linked_saving_id, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id'
    ).bind(couple_id, name, description || null, estimated_price || null, priority || 0, image_url || null, linked_saving_id || null, payload.id, payload.id).first()
    await notifyPartner(c.env.DB, user.partner_id, payload.id, 'wishlist', 'Wishlist baru', `${name} ditambahkan ke wishlist`, '/wishlist')

    return c.json({ message: 'Wishlist created', id: res?.id })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

app.put('/wishlists/:id', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  const { name, description, estimated_price, priority, image_url, is_completed } = await c.req.json()

  try {
    const updates: string[] = []
    const values: any[] = []
    
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (estimated_price !== undefined) { updates.push('estimated_price = ?'); values.push(estimated_price); }
    if (priority !== undefined) { updates.push('priority = ?'); values.push(priority); }
    if (image_url !== undefined) { updates.push('image_url = ?'); values.push(image_url); }
    if (is_completed !== undefined) { updates.push('is_completed = ?'); values.push(is_completed ? 1 : 0); }
    
    if (updates.length === 0) return c.json({ error: 'No fields to update' }, 400)

    updates.push('updated_by = ?', 'updated_at = CURRENT_TIMESTAMP'); values.push(payload.id)
    
    values.push(id)
    await c.env.DB.prepare(`UPDATE wishlists SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()

    return c.json({ message: 'Wishlist updated' })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

app.delete('/wishlists/:id', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')

  try {
    await c.env.DB.prepare('DELETE FROM wishlists WHERE id = ?').bind(id).run()
    return c.json({ message: 'Wishlist deleted' })
  } catch(e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

// PROFILE
app.get('/profile', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)
  try {
    const user = await c.env.DB.prepare(
      'SELECT id, name, email, avatar, birthday, anniversary, bio, phone, partner_id FROM users WHERE id = ?'
    ).bind(payload.id).first()
    if (!user) return c.json({ error: 'User not found' }, 404)
    return c.json({ user })
  } catch(e) { return c.json({ error: 'Database error' }, 500) }
})

app.put('/profile', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)
  const { name, birthday, anniversary, bio, phone } = await c.req.json()
  
  try {
    await c.env.DB.prepare('UPDATE users SET name = ?, birthday = ?, anniversary = ?, bio = ?, phone = ? WHERE id = ?')
      .bind(name, birthday, anniversary, bio, phone || null, payload.id)
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
  await c.env.MEDIA.put(fileName, file)
  
  const workerUrl = `https://couple-grow.uwangraph.workers.dev`
  const avatarUrl = `${workerUrl}/r2/${fileName}`
  
  await c.env.DB.prepare('UPDATE users SET avatar = ? WHERE id = ?').bind(avatarUrl, payload.id).run()
  
  return c.json({ avatarUrl })
})

// Serve R2 files publicly
app.get('/r2/*', async (c) => {
  const key = c.req.path.replace('/r2/', '')
  const obj = await c.env.MEDIA.get(key)
  if (!obj) return c.json({ error: 'Not found' }, 404)
  
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('Cache-Control', 'public, max-age=86400')
  
  return c.body(obj.body, 200, Object.fromEntries(headers.entries()))
})

// FOLDERS
app.post('/folders', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)
  const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
  if (!user?.partner_id) return c.json({ error: 'No partner connected' }, 400)
  const couple_id = [payload.id, user.partner_id].sort().join('_')
  const { name } = await c.req.json()
  if (!name) return c.json({ error: 'Missing folder name' }, 400)
  
  try {
    const res = await c.env.DB.prepare('INSERT INTO folders (couple_id, name, created_by, updated_by) VALUES (?, ?, ?, ?) RETURNING id').bind(couple_id, name, payload.id, payload.id).first()
    await notifyPartner(c.env.DB, user.partner_id, payload.id, 'folder', 'Folder baru', `${name} dibuat di Notes`, '/notes')
    return c.json({ message: 'Folder created', id: res?.id })
  } catch(e) { return c.json({ error: 'Database error' }, 500) }
})

app.get('/folders', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)
  const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
  if (!user?.partner_id) return c.json({ folders: [] })
  const couple_id = [payload.id, user.partner_id].sort().join('_')
  
  const folders = await c.env.DB.prepare('SELECT * FROM folders WHERE couple_id = ? ORDER BY created_at ASC').bind(couple_id).all()
  return c.json({ folders: folders.results })
})

app.delete('/folders/:id', async (c) => {
  const payload = c.get('jwtPayload')
  const id = c.req.param('id')
  const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
  if (!user?.partner_id) return c.json({ error: 'No partner connected' }, 400)
  const couple_id = [payload.id, user.partner_id].sort().join('_')
  const folder = await c.env.DB.prepare('SELECT id FROM folders WHERE id = ? AND couple_id = ?').bind(id, couple_id).first()
  if (!folder) return c.json({ error: 'Folder not found' }, 404)

  await c.env.DB.prepare('DELETE FROM notes WHERE folder_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM folders WHERE id = ? AND couple_id = ?').bind(id, couple_id).run()
  return c.json({ message: 'Deleted' })
})

// NOTES
app.post('/notes', async (c) => {
  const payload = c.get('jwtPayload')
  const { folder_id, title, content } = await c.req.json()
  try {
    const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
    if (!user?.partner_id) return c.json({ error: 'No partner connected' }, 400)
    const couple_id = [payload.id, user.partner_id].sort().join('_')
    const folder = await c.env.DB.prepare('SELECT id, couple_id FROM folders WHERE id = ? AND couple_id = ?').bind(folder_id, couple_id).first()
    if (!folder) return c.json({ error: 'Folder not found' }, 404)

    const res = await c.env.DB.prepare('INSERT INTO notes (folder_id, title, content, created_by, updated_by) VALUES (?, ?, ?, ?, ?) RETURNING id').bind(folder_id, title, content || '', payload.id, payload.id).first()
    const partnerId = folder?.couple_id?.split('_').find((id: string) => id !== payload?.id)
    await notifyPartner(c.env.DB, partnerId, payload?.id, 'note', 'Catatan baru', `${title || 'Catatan'} telah dibuat`, '/notes')
    return c.json({ message: 'Note created', id: res?.id })
  } catch(e) { return c.json({ error: 'Database error' }, 500) }
})

app.get('/notes', async (c) => {
  const payload = c.get('jwtPayload')
  const folder_id = c.req.query('folder_id')
  if (!folder_id) return c.json({ notes: [] })
  const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
  if (!user?.partner_id) return c.json({ notes: [] })
  const couple_id = [payload.id, user.partner_id].sort().join('_')
  const notes = await c.env.DB.prepare(
    'SELECT n.* FROM notes n JOIN folders f ON f.id = n.folder_id WHERE n.folder_id = ? AND f.couple_id = ? ORDER BY n.updated_at DESC'
  ).bind(folder_id, couple_id).all()
  return c.json({ notes: notes.results })
})

app.get('/notes/:id', async (c) => {
  const payload = c.get('jwtPayload')
  const id = c.req.param('id')
  const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
  if (!user?.partner_id) return c.json({ error: 'No partner connected' }, 400)
  const couple_id = [payload.id, user.partner_id].sort().join('_')
  const note = await c.env.DB.prepare(
    'SELECT n.* FROM notes n JOIN folders f ON f.id = n.folder_id WHERE n.id = ? AND f.couple_id = ?'
  ).bind(id, couple_id).first()
  if (!note) return c.json({ error: 'Note not found' }, 404)
  return c.json({ note })
})

app.put('/notes/:id', async (c) => {
  const payload = c.get('jwtPayload')
  const id = c.req.param('id')
  const { title, content, checklist } = await c.req.json()
  const checklistJson = checklist ? JSON.stringify(checklist) : null
  const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
  if (!user?.partner_id) return c.json({ error: 'No partner connected' }, 400)
  const couple_id = [payload.id, user.partner_id].sort().join('_')
  const note = await c.env.DB.prepare(
    'SELECT n.id FROM notes n JOIN folders f ON f.id = n.folder_id WHERE n.id = ? AND f.couple_id = ?'
  ).bind(id, couple_id).first()
  if (!note) return c.json({ error: 'Note not found' }, 404)
  await c.env.DB.prepare(
    'UPDATE notes SET title = ?, content = ?, checklist = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(title, content, checklistJson, payload.id, id).run()
  return c.json({ message: 'Updated' })
})

app.delete('/notes/:id', async (c) => {
  const payload = c.get('jwtPayload')
  const id = c.req.param('id')
  const user = await c.env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(payload.id).first()
  if (!user?.partner_id) return c.json({ error: 'No partner connected' }, 400)
  const couple_id = [payload.id, user.partner_id].sort().join('_')
  const note = await c.env.DB.prepare(
    'SELECT n.id FROM notes n JOIN folders f ON f.id = n.folder_id WHERE n.id = ? AND f.couple_id = ?'
  ).bind(id, couple_id).first()
  if (!note) return c.json({ error: 'Note not found' }, 404)
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
  const { room_id, message, type = 'text', file_url = null, reply_to_id = null } = await c.req.json()
  const res = await c.env.DB.prepare(
    'INSERT INTO messages (room_id, sender_id, message, type, file_url, reply_to_id) VALUES (?, ?, ?, ?, ?, ?) RETURNING *'
  ).bind(room_id, payload.id, message, type, file_url, reply_to_id).first()
  return c.json({ message: res })
})

app.delete('/chat/:id', async (c) => {
  const payload = c.get('jwtPayload')
  const id = c.req.param('id')
  
  const msg = await c.env.DB.prepare('SELECT sender_id FROM messages WHERE id = ?').bind(id).first()
  if (!msg) return c.json({ error: 'Message not found' }, 404)
  if (msg.sender_id !== payload.id) return c.json({ error: 'Unauthorized' }, 403)
  
  await c.env.DB.prepare('UPDATE messages SET is_deleted = 1 WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

app.post('/chat/upload', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)
  
  const formData = await c.req.parseBody()
  const file = formData['file']
  
  if (!file || !(file instanceof File)) {
    return c.json({ error: 'File is required' }, 400)
  }
  
  const ext = file.name.split('.').pop()
  const filename = `chat/${payload.id}_${Date.now()}.${ext}`
  
  await c.env.MEDIA.put(filename, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type }
  })
  
  const fileUrl = `https://couple-grow.uwangraph.workers.dev/r2/${filename}`
  return c.json({ url: fileUrl })
})

// NOTIFICATIONS
app.get('/notifications', async (c) => {
  const payload = c.get('jwtPayload')
  await c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, actor_id TEXT,
    type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, link TEXT,
    is_read BOOLEAN DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run()
  const rows = await c.env.DB.prepare('SELECT n.*, u.name as actor_name FROM notifications n LEFT JOIN users u ON u.id = n.actor_id WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT 100').bind(payload.id).all()
  const unread = await c.env.DB.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').bind(payload.id).first()
  return c.json({ notifications: rows.results, unread: unread?.count || 0 })
})

app.put('/notifications/read-all', async (c) => {
  const payload = c.get('jwtPayload')
  await c.env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').bind(payload.id).run()
  return c.json({ message: 'Notifications marked as read' })
})

app.put('/notifications/:id/read', async (c) => {
  const payload = c.get('jwtPayload')
  await c.env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').bind(c.req.param('id'), payload.id).run()
  return c.json({ message: 'Notification marked as read' })
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
  if (!user?.partner_id) return c.json({ error: 'No partner connected' }, 400)
  const couple_id = [payload.id, user.partner_id].sort().join('_')

  // Include saving_id in the DO name so each saving has its own chat room
  const saving_id = c.req.query('saving_id') || 'global'
  const doName = `${couple_id}:${saving_id}`

  const id = c.env.CHAT_ROOM.idFromName(doName)
  const stub = c.env.CHAT_ROOM.get(id)

  // Forward the request with user info in headers
  const newHeaders = new Headers(c.req.raw.headers)
  newHeaders.set('X-User-Id', payload.id)
  newHeaders.set('X-Couple-Id', couple_id)
  newHeaders.set('X-Saving-Id', saving_id)

  const newReq = new Request(c.req.raw, { headers: newHeaders })
  return stub.fetch(newReq)
})

const workerRoutes = [
  '/auth/', '/partner/', '/transactions', '/savings', '/budgets', '/analytics/',
  '/wishlists', '/folders', '/notes', '/chat/', '/notifications', '/profile', '/r2/'
]

function isWorkerRoute(pathname: string) {
  return workerRoutes.some((route) => pathname === route.slice(0, -1) || pathname.startsWith(route))
}

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
    const url = new URL(request.url)
    if (isWorkerRoute(url.pathname)) return app.fetch(request, env, ctx)
    return env.ASSETS.fetch(request)
  }
}
