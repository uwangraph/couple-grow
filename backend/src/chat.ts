import { DurableObject } from 'cloudflare:workers'

interface Env {
  DB: D1Database
}

/** Info sesi yang disimpan di attachment WebSocket agar selamat dari hibernasi. */
interface SessionInfo {
  userId: string
  coupleId: string
  savingId: string
}

export class ChatRoom extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade')
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 })
    }

    const info: SessionInfo = {
      userId: request.headers.get('X-User-Id') || '',
      coupleId: request.headers.get('X-Couple-Id') || '',
      savingId: request.headers.get('X-Saving-Id') || 'global',
    }
    if (!info.userId || !info.coupleId) {
      return new Response('Unauthorized', { status: 401 })
    }

    const [client, server] = Object.values(new WebSocketPair())
    // Hibernation API: identitas sesi disimpan di attachment, bukan di memori
    // instance — DO bisa di-evict kapan saja dan Map in-memory akan hilang.
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment(info)
    server.send(JSON.stringify({ type: 'connected', message: 'Connected to chat room' }))

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  private sessionInfo(ws: WebSocket): SessionInfo | null {
    try {
      const info = ws.deserializeAttachment() as SessionInfo | null
      if (!info?.userId || !info?.coupleId) return null
      return info
    } catch (e) {
      return null
    }
  }

  /** Kirim payload ke sesi lain (atau semua bila includeSelf). */
  private broadcast(payload: unknown, from: WebSocket | null, includeSelf = false) {
    const data = JSON.stringify(payload)
    for (const session of this.ctx.getWebSockets()) {
      if (!includeSelf && session === from) continue
      try { session.send(data) } catch (e) { try { session.close() } catch (_) {} }
    }
  }

  private async currentRoomId(info: SessionInfo) {
    const isSaving = info.savingId && info.savingId !== 'global'
    const room = isSaving
      ? await (this.env as any).DB.prepare('SELECT id FROM chat_rooms WHERE couple_id = ? AND saving_id = ?').bind(info.coupleId, info.savingId).first()
      : await (this.env as any).DB.prepare('SELECT id FROM chat_rooms WHERE couple_id = ? AND saving_id IS NULL').bind(info.coupleId).first()
    return room?.id ?? null
  }

  /** Ambil room, buat bila belum ada (dipakai saat kirim pesan). */
  private async ensureRoomId(info: SessionInfo) {
    const existing = await this.currentRoomId(info)
    if (existing) return existing
    const isSaving = info.savingId && info.savingId !== 'global'
    const created = isSaving
      ? await (this.env as any).DB.prepare('INSERT INTO chat_rooms (couple_id, saving_id, name) VALUES (?, ?, ?) RETURNING id').bind(info.coupleId, info.savingId, 'Saving Chat').first()
      : await (this.env as any).DB.prepare('INSERT INTO chat_rooms (couple_id, name) VALUES (?, ?) RETURNING id').bind(info.coupleId, 'Global').first()
    return created?.id ?? null
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const info = this.sessionInfo(ws)
    if (!info) return
    const senderId = info.userId

    let msgData: any
    try {
      msgData = JSON.parse(message as string)
    } catch (e) {
      return
    }

    const eventType = msgData.type || 'chat'
    const innerData = msgData.data || msgData

    try {
      if (eventType === 'delete') {
        const msgId = innerData.id
        const roomId = await this.currentRoomId(info)
        if (!roomId || !msgId) return
        const res = await (this.env as any).DB.prepare('UPDATE messages SET is_deleted = 1 WHERE id = ? AND room_id = ? AND sender_id = ?').bind(msgId, roomId, senderId).run()
        if (!res?.meta?.changes) return
        this.broadcast({ type: 'delete', data: { id: msgId } }, ws)
        return
      }

      if (eventType === 'pin') {
        const msgId = innerData.id
        const isPinned = innerData.is_pinned ? 1 : 0
        const roomId = await this.currentRoomId(info)
        if (!roomId || !msgId) return
        // Hanya satu pesan tersemat per room (seperti perilaku di UI).
        let expiresAt: string | null = null
        if (isPinned) {
          const hours = Number(innerData.duration_hours)
          if (Number.isFinite(hours) && hours > 0) {
            expiresAt = new Date(Date.now() + hours * 3600_000).toISOString()
          }
          await (this.env as any).DB.prepare('UPDATE messages SET is_pinned = 0, pin_expires_at = NULL WHERE room_id = ? AND is_pinned = 1').bind(roomId).run()
        }
        const res = await (this.env as any).DB.prepare('UPDATE messages SET is_pinned = ?, pin_expires_at = ? WHERE id = ? AND room_id = ?').bind(isPinned, expiresAt, msgId, roomId).run()
        if (!res?.meta?.changes) return
        this.broadcast({ type: 'pin', data: { id: msgId, is_pinned: isPinned === 1, pin_expires_at: expiresAt } }, ws)
        return
      }

      if (eventType === 'star') {
        const msgId = innerData.id
        const isStarred = innerData.is_starred ? 1 : 0
        const roomId = await this.currentRoomId(info)
        if (!roomId || !msgId) return
        const res = await (this.env as any).DB.prepare('UPDATE messages SET is_starred = ? WHERE id = ? AND room_id = ?').bind(isStarred, msgId, roomId).run()
        if (!res?.meta?.changes) return
        this.broadcast({ type: 'star', data: { id: msgId, is_starred: isStarred === 1 } }, ws)
        return
      }

      if (eventType === 'edit') {
        const msgId = innerData.id
        const newText = typeof innerData.message === 'string' ? innerData.message.trim() : ''
        const roomId = await this.currentRoomId(info)
        if (!roomId || !msgId || !newText) return
        const res = await (this.env as any).DB.prepare('UPDATE messages SET message = ?, is_edited = 1 WHERE id = ? AND room_id = ? AND sender_id = ? AND is_deleted = 0').bind(newText, msgId, roomId, senderId).run()
        if (!res?.meta?.changes) return
        this.broadcast({ type: 'edit', data: { id: msgId, message: newText } }, ws)
        return
      }

      if (eventType === 'react') {
        const msgId = innerData.id
        const emoji = innerData.emoji
        const roomId = await this.currentRoomId(info)
        if (!roomId || !msgId) return
        const msgRec = await (this.env as any).DB.prepare('SELECT reactions FROM messages WHERE id = ? AND room_id = ?').bind(msgId, roomId).first()
        if (!msgRec) return

        let reactionsObj: Record<string, string> = {}
        if (msgRec.reactions) {
          try { reactionsObj = JSON.parse(msgRec.reactions) } catch (e) {}
        }
        if (emoji) reactionsObj[senderId] = emoji
        else delete reactionsObj[senderId]

        const reactionsStr = JSON.stringify(reactionsObj)
        await (this.env as any).DB.prepare('UPDATE messages SET reactions = ? WHERE id = ? AND room_id = ?').bind(reactionsStr, msgId, roomId).run()
        this.broadcast({ type: 'react', data: { id: msgId, reactions: reactionsStr } }, ws)
        return
      }

      // Indikator "sedang mengetik" — tidak disimpan, hanya diteruskan.
      if (eventType === 'typing') {
        this.broadcast({ type: 'typing', data: { user_id: senderId, is_typing: !!innerData.is_typing } }, ws)
        return
      }

      // Read receipt: pembaca menandai pesan pasangan sebagai sudah dibaca.
      if (eventType === 'read') {
        const upToId = innerData.last_id ?? innerData.id ?? null
        const roomId = await this.currentRoomId(info)
        if (!roomId || !upToId) return
        const res = await (this.env as any).DB.prepare(
          'UPDATE messages SET is_read = 1 WHERE room_id = ? AND sender_id != ? AND id <= ? AND is_read = 0'
        ).bind(roomId, senderId, upToId).run()
        // Tidak perlu menyiarkan bila tidak ada perubahan status.
        if (!res?.meta?.changes) return
        this.broadcast({ type: 'read', data: { last_id: upToId, reader_id: senderId } }, ws)
        return
      }

      // Event 'chat'
      const messageText = typeof innerData.message === 'string' ? innerData.message : ''
      const msgType = innerData.type || 'text'
      const fileUrl = innerData.file_url || null
      const replyToId = innerData.reply_to_id || null
      const clientId = innerData.client_id || null
      // metadata JSON: caption, durasi VN, waveform, nama & ukuran file.
      let metadata: string | null = null
      if (innerData.metadata && typeof innerData.metadata === 'object') {
        try { metadata = JSON.stringify(innerData.metadata) } catch (e) { metadata = null }
      }
      if (!messageText.trim() && !fileUrl) return

      const roomId = await this.ensureRoomId(info)
      if (!roomId) return

      // Balasan harus menunjuk pesan di room yang sama.
      let safeReplyToId: number | null = null
      if (replyToId) {
        const reply = await (this.env as any).DB.prepare('SELECT id FROM messages WHERE id = ? AND room_id = ?').bind(replyToId, roomId).first()
        safeReplyToId = reply?.id ?? null
      }

      const savedMsg = await (this.env as any).DB.prepare(
        'INSERT INTO messages (room_id, sender_id, message, type, file_url, reply_to_id, metadata) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *'
      ).bind(roomId, senderId, messageText, msgType, fileUrl, safeReplyToId, metadata).first()

      if (!savedMsg) return

      // Disiarkan ke semua sesi termasuk pengirim: pengirim memakai pesan
      // tersimpan untuk mengganti placeholder optimistik-nya (via client_id).
      this.broadcast({ type: 'chat', data: { ...savedMsg, client_id: clientId } }, ws, true)
    } catch (e) {
      console.error('Error saving/broadcasting message:', e)
      try { ws.send(JSON.stringify({ type: 'error', message: 'Gagal memproses pesan' })) } catch (_) {}
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    try { ws.close(code, reason) } catch (e) {}
  }

  async webSocketError(ws: WebSocket, error: unknown) {
    console.error('WebSocket error:', error)
  }
}
