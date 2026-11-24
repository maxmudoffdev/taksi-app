import { Router, type Request, type Response } from 'express'
import { clientIp } from '../security.js'
import { RateLimiter } from '../services/otp.js'
import {
  AuthError,
  pendingStatus,
  registerWithTicket,
  resendCode,
  startLogin,
  telegramEnabled,
  verifyCode,
} from '../services/tgAuth.service.js'
import { getBotUsername } from '../services/telegram.bot.js'

export const authRouter = Router()

// IP bo'yicha (mobil operatorlarda ko'p foydalanuvchi bitta IP ortida — shuning uchun kengroq):
// kod so'rash — 10 daqiqada 60 marta, tekshirish — 120 marta. Har bir raqamga alohida: 60 s da 1 kod, 5 urinish.
const startLimit = new RateLimiter(60, 10 * 60_000)
const verifyLimit = new RateLimiter(120, 10 * 60_000)

type Handler = (req: Request) => Promise<unknown> | unknown

function handle(fn: Handler, limiter?: RateLimiter) {
  return async (req: Request, res: Response) => {
    if (limiter && !limiter.allow(clientIp(req.headers, req.socket.remoteAddress))) {
      res.status(429).json({ error: 'Juda ko‘p urinish. Bir necha daqiqadan keyin qayta urining.' })
      return
    }
    try {
      res.json(await fn(req))
    } catch (e) {
      if (e instanceof AuthError) {
        res.status(e.status).json({ error: e.message })
        return
      }
      console.error('[tg-auth]', e)
      res.status(500).json({ error: 'Serverda xato. Qayta urining.' })
    }
  }
}

authRouter.get('/tg/config', handle(() => ({ enabled: telegramEnabled(), bot: getBotUsername() })))
authRouter.post('/tg/start', handle((req) => startLogin(req.body?.phone), startLimit))
authRouter.get('/tg/status/:nonce', handle((req) => pendingStatus(req.params.nonce)))
authRouter.post('/tg/resend', handle((req) => resendCode(req.body?.phone), startLimit))
authRouter.post('/tg/verify', handle((req) => verifyCode(req.body?.phone, req.body?.code), verifyLimit))
authRouter.post('/tg/register', handle((req) => registerWithTicket(req.body), verifyLimit))
