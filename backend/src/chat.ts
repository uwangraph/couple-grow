import { DurableObject } from 'cloudflare:workers'

interface Env {
  DB: D1Database
}

export class ChatRoom extends DurableObject {
  private sessions: Set<WebSocket> = new Set()
  private coupleId: string = ''
  private savingId: string = 'global'

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade')
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 })
    }

    // Extract user info from headers set by the gateway
    this.coupleId = request.headers.get('X-Couple-Id') || ''
    this.savingId = request.headers.get('X-Saving-Id') || 'global'

    const [client, server] = Object.values(new WebSocketPair())
    await this.handleSession(server, request.headers.get('X-User-Id') || '')

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  async handleSession(webSocket: WebSocket, userId: string) {
    this.ctx.acceptWebSocket(webSocket)
    this.sessions.add(webSocket)

    // Send a welcome message
    webSocket.send(JSON.stringify({ type: 'connected', message: 'Connected to chat room' }))
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    let msgData: any
    try {
      msgData = JSON.parse(message as string)
    } catch (e) {
      msgData = { message: message as string, sender_id: 'unknown', created_at: new Date().toISOString() }
    }

    const eventType = msgData.type || 'chat'
    const innerData = msgData.data || msgData
    const senderId = innerData.sender_id || 'unknown'

    try {
      if (eventType === 'delete') {
        const msgId = innerData.id
        await (this.env as any).DB.prepare('UPDATE messages SET is_deleted = 1 WHERE id = ? AND sender_id = ?').bind(msgId, senderId).run()
        
        for (const session of this.sessions) {
          if (session !== ws) {
            try { session.send(JSON.stringify({ type: 'delete', data: { id: msgId } })) } catch (e) { this.sessions.delete(session) }
          }
        }
        return
      }

      if (eventType === 'pin') {
        const msgId = innerData.id
        const isPinned = innerData.is_pinned ? 1 : 0
        await (this.env as any).DB.prepare('UPDATE messages SET is_pinned = ? WHERE id = ?').bind(isPinned, msgId).run()
        
        for (const session of this.sessions) {
          if (session !== ws) {
            try { session.send(JSON.stringify({ type: 'pin', data: { id: msgId, is_pinned: isPinned === 1 } })) } catch (e) { this.sessions.delete(session) }
          }
        }
        return
      }

      if (eventType === 'star') {
        const msgId = innerData.id
        const isStarred = innerData.is_starred ? 1 : 0
        await (this.env as any).DB.prepare('UPDATE messages SET is_starred = ? WHERE id = ?').bind(isStarred, msgId).run()
        
        for (const session of this.sessions) {
          if (session !== ws) {
            try { session.send(JSON.stringify({ type: 'star', data: { id: msgId, is_starred: isStarred === 1 } })) } catch (e) { this.sessions.delete(session) }
          }
        }
        return
      }

      if (eventType === 'edit') {
        const msgId = innerData.id
        const newText = innerData.message
        await (this.env as any).DB.prepare('UPDATE messages SET message = ?, is_edited = 1 WHERE id = ? AND sender_id = ?').bind(newText, msgId, senderId).run()
        
        for (const session of this.sessions) {
          if (session !== ws) {
            try { session.send(JSON.stringify({ type: 'edit', data: { id: msgId, message: newText } })) } catch (e) { this.sessions.delete(session) }
          }
        }
        return
      }

      if (eventType === 'react') {
        const msgId = innerData.id
        const emoji = innerData.emoji
        
        // Fetch current reactions
        const msgRec = await (this.env as any).DB.prepare('SELECT reactions FROM messages WHERE id = ?').bind(msgId).first()
        let reactionsObj: Record<string, string> = {}
        if (msgRec && msgRec.reactions) {
          try { reactionsObj = JSON.parse(msgRec.reactions) } catch(e) {}
        }
        
        if (emoji) {
          reactionsObj[senderId] = emoji
        } else {
          delete reactionsObj[senderId]
        }
        
        const reactionsStr = JSON.stringify(reactionsObj)
        await (this.env as any).DB.prepare('UPDATE messages SET reactions = ? WHERE id = ?').bind(reactionsStr, msgId).run()
        
        for (const session of this.sessions) {
          if (session !== ws) {
            try { session.send(JSON.stringify({ type: 'react', data: { id: msgId, reactions: reactionsStr } })) } catch (e) { this.sessions.delete(session) }
          }
        }
        return
      }

      // Handling 'chat' event
      const messageText = innerData.message || ''
      const msgType = innerData.type || 'text'
      const fileUrl = innerData.file_url || null
      const replyToId = innerData.reply_to_id || null

      // Find or create the chat room in DB
      let room: any
      if (this.savingId && this.savingId !== 'global') {
        room = await (this.env as any).DB.prepare(
          'SELECT id FROM chat_rooms WHERE couple_id = ? AND saving_id = ?'
        ).bind(this.coupleId, this.savingId).first()
        if (!room) {
          room = await (this.env as any).DB.prepare(
            'INSERT INTO chat_rooms (couple_id, saving_id, name) VALUES (?, ?, ?) RETURNING id'
          ).bind(this.coupleId, this.savingId, 'Saving Chat').first()
        }
      } else {
        room = await (this.env as any).DB.prepare(
          'SELECT id FROM chat_rooms WHERE couple_id = ? AND saving_id IS NULL'
        ).bind(this.coupleId).first()
        if (!room) {
          room = await (this.env as any).DB.prepare(
            'INSERT INTO chat_rooms (couple_id, name) VALUES (?, ?) RETURNING id'
          ).bind(this.coupleId, 'Global').first()
        }
      }

      // Insert the message
      const savedMsg = await (this.env as any).DB.prepare(
        'INSERT INTO messages (room_id, sender_id, message, type, file_url, reply_to_id) VALUES (?, ?, ?, ?, ?, ?) RETURNING *'
      ).bind(room?.id, senderId, messageText, msgType, fileUrl, replyToId).first()

      const broadcastData = {
        type: 'chat',
        data: savedMsg || {
          sender_id: senderId,
          message: messageText,
          type: msgType,
          file_url: fileUrl,
          reply_to_id: replyToId,
          created_at: new Date().toISOString()
        }
      }

      // Broadcast to every connected session, including the sender. The sender
      // uses the persisted message to replace its optimistic placeholder.
      for (const session of this.sessions) {
        try {
          session.send(JSON.stringify(broadcastData))
        } catch (e) {
          this.sessions.delete(session)
        }
      }
    } catch (e) {
      console.error('Error saving/broadcasting message:', e)
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    this.sessions.delete(ws)
  }

  async webSocketError(ws: WebSocket, error: unknown) {
    this.sessions.delete(ws)
  }
}
