CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  partner_id TEXT,
  avatar TEXT,
  birthday DATE,
  anniversary DATE,
  bio TEXT,
  phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (partner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  is_used BOOLEAN DEFAULT 0,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (from_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  used BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user_code
ON password_resets(user_id, code, used, expires_at);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  couple_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
  category TEXT NOT NULL,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS savings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  couple_id TEXT NOT NULL,
  name TEXT NOT NULL,
  target_amount INTEGER NOT NULL,
  current_amount INTEGER DEFAULT 0,
  deadline DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  updated_by TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  couple_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_private BOOLEAN DEFAULT 0,
  parent_folder_id INTEGER,
  linked_saving_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  updated_by TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_folder_id) REFERENCES folders(id),
  FOREIGN KEY (linked_saving_id) REFERENCES savings(id)
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  folder_id INTEGER NOT NULL,
  title TEXT,
  content TEXT,
  checklist JSON,
  deadline DATE,
  is_done BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  updated_by TEXT,
  FOREIGN KEY (folder_id) REFERENCES folders(id)
);

CREATE TABLE IF NOT EXISTS chat_rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  couple_id TEXT NOT NULL,
  saving_id INTEGER,
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (saving_id) REFERENCES savings(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  sender_id TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  file_url TEXT,
  reply_to_id INTEGER,
  is_deleted BOOLEAN DEFAULT 0,
  is_pinned BOOLEAN DEFAULT 0,
  is_starred BOOLEAN DEFAULT 0,
  is_edited BOOLEAN DEFAULT 0,
  reactions TEXT,
  is_read BOOLEAN DEFAULT 0,
  pin_expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES chat_rooms(id),
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (reply_to_id) REFERENCES messages(id)
);

-- Phase 1: Foundation Tables

-- 1. History log per tabungan (tracking semua aktivitas di tabungan)
CREATE TABLE IF NOT EXISTS saving_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  saving_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT CHECK(type IN ('topup', 'deduct', 'created', 'updated', 'milestone')) NOT NULL,
  amount INTEGER DEFAULT 0,
  note TEXT,
  metadata TEXT, -- JSON untuk data tambahan seperti milestone percentage
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (saving_id) REFERENCES savings(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_saving_activities_saving 
ON saving_activities(saving_id, created_at DESC);

-- 2. Budget bulanan per kategori
CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  couple_id TEXT NOT NULL,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  period_month INTEGER NOT NULL, -- 1-12
  period_year INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  updated_by TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(couple_id, category, period_month, period_year)
);

CREATE INDEX IF NOT EXISTS idx_budgets_couple_period 
ON budgets(couple_id, period_year, period_month);

-- 3. Split bill - modifikasi transactions untuk support split
-- Kita perlu table baru untuk track split details
CREATE TABLE IF NOT EXISTS transaction_splits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  is_paid BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_transaction_splits_transaction 
ON transaction_splits(transaction_id);

-- 4. Wishlist untuk shared dreams
CREATE TABLE IF NOT EXISTS wishlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  couple_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  estimated_price INTEGER,
  priority INTEGER DEFAULT 0, -- 1=low, 2=medium, 3=high
  image_url TEXT,
  is_completed BOOLEAN DEFAULT 0,
  linked_saving_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  updated_by TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (linked_saving_id) REFERENCES savings(id)
);

CREATE INDEX IF NOT EXISTS idx_wishlists_couple 
ON wishlists(couple_id, priority DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  actor_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (actor_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
