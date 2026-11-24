import { BACKEND_URL } from './backendUrl'
import { io, type Socket } from 'socket.io-client'
import { supabase } from './supabase'

let socket: Socket | null = null

/** Socket ulanishi; har bir (qayta) ulanishda joriy Supabase token yuboriladi */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(BACKEND_URL, {
      autoConnect: false,
      auth: (cb) => {
        supabase.auth.getSession().then(({ data }) => cb({ token: data.session?.access_token ?? '' }))
      },
    })
  }
  return socket
}

type AckResponse<T> = { ok: true; data: T } | { ok: false; error: string; code?: string }

/** Server xatosi; `code` — alohida ishlov berish uchun (masalan, DUPLICATE_ACTIVE) */
export class RequestError extends Error {
  readonly code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

/** Hodisani yuborib, server javobini kutadi; xato bo'lsa Error tashlaydi */
export async function request<T>(event: string, payload: unknown): Promise<T> {
  const s = getSocket()
  if (!s.connected) throw new Error('Server bilan aloqa yo‘q')
  let res: AckResponse<T>
  try {
    res = await s.timeout(15000).emitWithAck(event, payload)
  } catch {
    throw new Error('Server javob bermadi')
  }
  if (!res.ok) throw new RequestError(res.error, res.code)
  return res.data
}
