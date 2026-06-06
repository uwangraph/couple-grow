import { DurableObject } from 'cloudflare:workers'

export class ChatRoom extends DurableObject {
  // Store connected WebSockets
  sessions: Set<WebSocket> = new Set()

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env)
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade')
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 })
    }

    const [client, server] = Object.values(new WebSocketPair())
    await this.handleSession(server)

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  async handleSession(webSocket: WebSocket) {
    this.ctx.acceptWebSocket(webSocket)
    this.sessions.add(webSocket)

    // Send a welcome message or sync state
    webSocket.send(JSON.stringify({ type: 'connected', message: 'Connected to chat room' }))
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    // Broadcast the message to all other connected sessions
    for (const session of this.sessions) {
      if (session !== ws) {
        try {
          session.send(message)
        } catch (e) {
          this.sessions.delete(session)
        }
      }
    }
    
    // Optionally: save to D1 database via `this.env.DB` here,
    // though Durable Objects can't directly access D1 unless passed in env and D1 is supported in DO.
    // For MVP we just broadcast.
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    this.sessions.delete(ws)
  }

  async webSocketError(ws: WebSocket, error: unknown) {
    this.sessions.delete(ws)
  }
}
