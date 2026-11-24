/**
 * Telegram Bot API (long polling — webhook va ochiq domen kerak emas, localhost'da ham ishlaydi).
 * Token: @BotFather → /newbot → backend/.env → TELEGRAM_BOT_TOKEN=...
 */
const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? ''

export const isBotConfigured = Boolean(TOKEN)

let botUsername: string | null = null
export const getBotUsername = () => botUsername

export type TgUser = { id: number; first_name?: string; username?: string }
export type TgMessage = {
  message_id: number
  chat: { id: number; type: string }
  from?: TgUser
  text?: string
  contact?: { phone_number: string; user_id?: number; first_name?: string }
}
type TgUpdate = { update_id: number; message?: TgMessage }

async function api<T>(method: string, body?: object, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    signal,
  })
  const json = (await res.json()) as { ok: boolean; result: T; description?: string; error_code?: number }
  if (!json.ok) throw Object.assign(new Error(json.description ?? `Telegram ${method} xatosi`), { code: json.error_code })
  return json.result
}

export type ReplyMarkup =
  | { keyboard: { text: string; request_contact?: boolean }[][]; resize_keyboard: true; one_time_keyboard?: boolean }
  | { remove_keyboard: true }

export function sendMessage(chatId: number, text: string, replyMarkup?: ReplyMarkup) {
  return api('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', reply_markup: replyMarkup })
}

/** Botni ishga tushiradi: har bir xabar `onMessage` ga uzatiladi. Token bo'lmasa — hech narsa qilmaydi. */
export async function startBot(onMessage: (m: TgMessage) => Promise<void>): Promise<void> {
  if (!TOKEN) return
  try {
    const me = await api<{ username: string }>('getMe')
    botUsername = me.username
    await api('deleteWebhook', { drop_pending_updates: false })
  } catch (e) {
    console.error('[telegram] bot ishga tushmadi:', e instanceof Error ? e.message : e)
    return
  }
  console.log(`[telegram] bot: @${botUsername} ✅`)

  let offset = 0
  let warnedConflict = false
  const loop = async () => {
    for (;;) {
      try {
        const updates = await api<TgUpdate[]>('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] })
        for (const u of updates) {
          offset = u.update_id + 1
          if (u.message) await onMessage(u.message).catch((e) => console.error('[telegram] xabarni qayta ishlashda xato:', e))
        }
      } catch (e) {
        const code = (e as { code?: number }).code
        if (code === 409 && !warnedConflict) {
          warnedConflict = true
          console.warn('[telegram] shu token bilan boshqa jarayon ham bot ishlatmoqda (409). Faqat bitta backend ishlasin.')
        } else if (code !== 409) {
          console.warn('[telegram] getUpdates xatosi:', e instanceof Error ? e.message : e)
        }
        await new Promise((r) => setTimeout(r, 5000))
      }
    }
  }
  void loop()
}
