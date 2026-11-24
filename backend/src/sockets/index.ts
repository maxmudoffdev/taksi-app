import type { Server, Socket } from 'socket.io'
import { isActive } from '../../../shared/orderStatus'
import { validateTariffPatch } from '../../../shared/pricing'
import type { Order, OrderStatus, Tariff } from '../../../shared/types'
import { BLOCKED_MESSAGE, verifyToken, type SocketUser } from '../auth.js'
import { checkEvent, clientIp, connectLimit, looksLikeValidJwt, MAX_SOCKETS_PER_USER, RATE_LIMIT_MESSAGE } from '../security.js'
import {
  getStats,
  listDispatchers,
  listDrivers,
  listOnlineDrivers,
  setBlocked,
  setDispatcher,
  setDriverApproved,
} from '../services/admin.service.js'
import { getLocation, isValidLocation, saveLocation, setOnline, updateCar } from '../services/drivers.service.js'
import { driverSummary, listMyHistory, searchOrders } from '../services/history.service.js'
import { getSurgeSettings, quoteSurge, updateSurgeSettings } from '../services/surge.service.js'
import { getTariffs, updateTariff } from '../services/tariffs.service.js'
import {
  acceptOrder,
  assignOrder,
  changeStatus,
  createOrder,
  createPhoneOrder,
  findNearbyDriverIds,
  getActiveOrderFor,
  getOrder,
  listActiveOrders,
  cancelStaleOrders,
  listOpenOrders,
  lookupCustomer,
  MAX_CARS_PER_CALL,
  OrderError,
  parsePickup,
  rateOrder,
} from '../services/orders.service.js'
import {
  afterOrderChange,
  afterRating,
  assertCanTakeOrders,
  blockMessage,
  changeBalance,
  changeScore,
  dailyRecovery,
  dispatchTargets,
  getCommissionPct,
  getStanding,
  releaseRedDrivers,
  updateCommission,
  walletDetails,
  walletReady,
  YELLOW_DELAY_MS,
} from '../services/wallet.service.js'
import type { DriverStanding } from '../../../shared/wallet'

type Ack<T = unknown> = (res: { ok: true; data: T } | { ok: false; error: string; code?: string }) => void

const userRoom = (id: string) => `user:${id}`
/** Faqat onlayn va tasdiqlangan haydovchilar */
const DRIVERS = 'drivers'
/** Admin va dispetcherlar: jonli monitoring (buyurtmalar, haydovchilar joylashuvi) */
const STAFF = 'staff'

/** Koordinatalarni haydovchidan qabul qilishning eng kichik oralig'i */
const LOCATION_MIN_INTERVAL_MS = 1000

/** Haydovchi → uning faol buyurtmasi (GPS'ni kimga uzatishni bilish uchun) */
const activeTrips = new Map<string, { orderId: string; passengerId: string | null }>()

function trackTrip(order: Order) {
  if (!order.driverId) return
  if (isActive(order.status)) activeTrips.set(order.driverId, { orderId: order.id, passengerId: order.passengerId })
  else if (activeTrips.get(order.driverId)?.orderId === order.id) activeTrips.delete(order.driverId)
}

export function registerSockets(io: Server) {
  // Har bir ulanish Supabase access token bilan tekshiriladi
  io.use(async (socket, next) => {
    const ip = clientIp(socket.handshake.headers, socket.handshake.address)
    if (!connectLimit.allow(ip)) return next(new Error('Juda ko‘p ulanish urinishi. Birozdan keyin qayta urining.'))
    const token = socket.handshake.auth?.token
    if (typeof token !== 'string' || !token) return next(new Error('Token yuborilmadi'))
    // Axlat / muddati o'tgan token Supabase'ga yuborilmaydi
    if (!looksLikeValidJwt(token, process.env.SUPABASE_URL ?? '')) return next(new Error("Token yaroqsiz yoki muddati o'tgan"))
    try {
      const user = await verifyToken(token)
      const open = [...io.sockets.sockets.values()].filter((s) => (s.data.user as SocketUser | undefined)?.id === user.id)
      // Chegaradan oshsa — eng eski ulanish uziladi (mobil internet uzilib-ulanganda "osilib" qolganlari)
      for (const old of open.slice(0, Math.max(0, open.length - MAX_SOCKETS_PER_USER + 1))) old.disconnect(true)
      socket.data.user = user
      next()
    } catch (e) {
      next(new Error(e instanceof Error ? e.message : 'Avtorizatsiya xatosi'))
    }
  })

  /** Buyurtma o'zgarishini unga aloqador hammaga yuborish */
  const broadcastOrder = (order: Order) => {
    trackTrip(order)
    let target = io.to(STAFF)
    // Telefon buyurtmada yo'lovchi ilovada bo'lmasligi mumkin
    if (order.passengerId) target = target.to(userRoom(order.passengerId))
    if (order.driverId) target = target.to(userRoom(order.driverId))
    target.emit('order:updated', order)
  }

  /**
   * Yangi buyurtma haqida yaqin haydovchilarga (topilmasa — barcha onlayn haydovchilarga) xabar berish.
   * Balans va ball tizimi yoqilgan bo'lsa: balansi manfiy / qizil pauzadagilarga — yo'q,
   * sariq zonadagilarga — 15 soniya kechikib (shu paytgacha hech kim olmagan bo'lsa).
   */
  const notifyDrivers = async (order: Order) => {
    if (walletReady()) {
      const t = await dispatchTargets(order.pickup)
      if (t.green.length) io.to(t.green.map(userRoom)).emit('order:new', order)
      if (t.yellow.length) {
        setTimeout(async () => {
          const fresh = await getOrder(order.id).catch(() => null)
          if (fresh?.status === 'created') io.to(t.yellow.map(userRoom)).emit('order:new', fresh)
        }, YELLOW_DELAY_MS).unref()
      }
      const where = t.nearby ? 'yaqin' : 'onlayn (yaqinda hech kim yo‘q)'
      console.log(`[order] ${order.id} → ${where}: ${t.green.length} ta darhol, ${t.yellow.length} ta 15 s dan keyin`)
      return
    }
    // Joy belgilanmagan bo'lsa (faqat mo'ljal) — barcha onlayn haydovchilarga
    const nearby = order.pickup ? await findNearbyDriverIds(order.pickup) : []
    if (nearby.length) {
      io.to(nearby.map(userRoom)).emit('order:new', order)
      console.log(`[order] ${order.id} → ${nearby.length} ta yaqin haydovchiga yuborildi`)
    } else {
      io.to(DRIVERS).emit('order:new', order)
      console.log(`[order] ${order.id} → yaqin haydovchi topilmadi, barcha onlayn haydovchilarga yuborildi`)
    }
  }

  /** Haydovchining oxirgi joylashuvini yo'lovchiga yuborish (qabul qilinganda / qayta ulanganda) */
  const sendLastDriverLocation = async (order: Order) => {
    if (!order.driverId || !order.passengerId) return
    const loc = await getLocation(order.driverId).catch(() => null)
    if (loc) io.to(userRoom(order.passengerId)).emit('driver:location', { ...loc, orderId: order.id })
  }

  /** Haydovchiga balans/ball holatini yuborish */
  const sendStanding = (driverId: string, standing: DriverStanding) => {
    io.to(userRoom(driverId)).emit('wallet:updated', { ...standing, blockMessage: blockMessage(standing) })
  }

  /** Buyurtma o'zgargach komissiya va ball; xato bo'lsa buyurtmaning o'zi buzilmaydi */
  const settleOrder = async (order: Order) => {
    try {
      const standing = await afterOrderChange(order)
      if (standing && order.driverId) sendStanding(order.driverId, standing)
    } catch (e) {
      console.error(`[wallet] ${order.id} hisob-kitob xatosi:`, e instanceof Error ? e.message : e)
    }
  }

  // Osilib qolgan buyurtmalarni har daqiqada tozalash (haydovchi topilmadi / unutilgan)
  let lastRecoveryAt = 0
  const sweep = async () => {
    try {
      // Qizil pauzasi tugaganlar va kunlik ball tiklanishi
      for (const id of await releaseRedDrivers()) {
        sendStanding(id, await getStanding(id))
        console.log(`[wallet] ${id} pauzadan chiqdi`)
      }
      if (Date.now() - lastRecoveryAt > 10 * 60_000) {
        lastRecoveryAt = Date.now()
        const n = await dailyRecovery()
        if (n) console.log(`[wallet] kunlik tiklanish: ${n} ta haydovchi +3 ball`)
      }
    } catch (e) {
      console.warn('[wallet] davriy ish xatosi:', e instanceof Error ? e.message : e)
    }
    try {
      const cancelled = await cancelStaleOrders()
      for (const order of cancelled) {
        console.log(`[sweep] ${order.id} avtomatik bekor qilindi (${order.cancelReason})`)
        if (!order.driverId) io.to(DRIVERS).emit('order:taken', order.id)
        broadcastOrder(order)
      }
    } catch (e) {
      console.warn('[sweep] xato:', e instanceof Error ? e.message : e)
    }
  }
  setInterval(sweep, 60_000).unref()
  setTimeout(sweep, 5_000).unref()

  /** Haydovchi hozir buyurtmada (bo'sh emas) */
  const isBusy = (driverId: string) => activeTrips.has(driverId)
  /** A nuqta uchun joriy koeffitsiyent (surge o'chiq yoki A yo'q bo'lsa — 1) */
  const surgeAt = async (payload: unknown) => {
    const pickup = parsePickup(payload)
    return pickup ? (await quoteSurge(pickup, isBusy)).surge : 1
  }

  /** Shu foydalanuvchining shu serverdagi barcha ulanishlari */
  const socketsOf = (userId: string) =>
    [...io.sockets.sockets.values()].filter((s) => (s.data.user as SocketUser | undefined)?.id === userId)

  /** Haydovchining hech bir ulanishi onlayn bo'lmasa — bazada oflayn qilish */
  const driverHasOnlineSocket = async (driverId: string) => {
    const sockets = await io.in(userRoom(driverId)).fetchSockets()
    return sockets.some((s) => s.data.online === true)
  }

  io.on('connection', async (socket: Socket) => {
    const user = socket.data.user as SocketUser
    const isDriver = user.role === 'driver'
    socket.data.online = false
    let lastLocationAt = 0
    console.log(`[socket] ulandi: ${user.role} ${user.fullName ?? user.id}`)

    socket.join(userRoom(user.id))
    const isStaff = user.role === 'admin' || user.role === 'dispatcher'
    if (isStaff) socket.join(STAFF)
    socket.emit('tariffs', getTariffs())

    const handle = <T>(event: string, fn: (payload: any) => Promise<T>) => {
      socket.on(event, async (payload: unknown, ack?: Ack<T>) => {
        const verdict = checkEvent(user.id, event)
        if (verdict === 'abuse') {
          console.warn(`[security] ${user.role} ${user.id} juda ko‘p so‘rov — ulanish uzildi`)
          socket.disconnect(true)
          return
        }
        if (verdict === 'limited') {
          if (typeof ack === 'function') ack({ ok: false, error: RATE_LIMIT_MESSAGE, code: 'RATE_LIMITED' })
          return
        }
        try {
          const data = await fn(payload)
          if (typeof ack === 'function') ack({ ok: true, data })
        } catch (e) {
          // Faqat biz yozgan (OrderError) xabarlar foydalanuvchiga; qolgani — logda
          const isUserError = e instanceof OrderError
          if (!isUserError) console.error(`[socket] ${event} xatosi`, e)
          const error = isUserError ? e.message : 'Serverda xato. Birozdan keyin qayta urining.'
          const code = isUserError ? e.code : undefined
          if (typeof ack === 'function') ack({ ok: false, error, ...(code && { code }) })
        }
      })
    }

    // ---------- Yo'lovchi ----------

    handle('surge:quote', async (payload) => {
      const pickup = parsePickup(payload)
      if (!pickup) throw new OrderError("A nuqta noto'g'ri")
      const quote = await quoteSurge(pickup, isBusy)
      return { surge: quote.surge, enabled: getSurgeSettings().enabled }
    })

    handle('order:create', async (payload) => {
      const order = await createOrder(user, payload, await surgeAt(payload))
      const surge = order.surge > 1 ? ` · ×${order.surge}` : ''
      console.log(`[order] yaratildi ${order.id} · ${order.tariff} · ${order.distanceKm} km · ${order.price} so'm${surge}`)
      broadcastOrder(order)
      await notifyDrivers(order)
      return order
    })

    // ---------- Haydovchi ----------

    handle('driver:online', async ({ online }: { online: boolean }) => {
      if (!isDriver) throw new OrderError('Faqat haydovchi uchun')
      if (!user.isApproved) throw new OrderError('Hisobingiz hali admin tomonidan tasdiqlanmagan')

      socket.data.online = Boolean(online)
      if (socket.data.online) {
        socket.join(DRIVERS)
        await setOnline(user.id, true)
        console.log(`[driver] onlayn: ${user.fullName ?? user.id}`)
        if (!walletReady()) return { openOrders: await listOpenOrders() }
        // Balansi tugagan / pauzadagiga ro'yxat yo'q; sariq zonaga — 15 soniyadan eski buyurtmalar
        const standing = await getStanding(user.id)
        const block = blockMessage(standing)
        if (block) return { openOrders: [], standing, blockMessage: block }
        const all = await listOpenOrders()
        const cutoff = Date.now() - YELLOW_DELAY_MS
        const openOrders = standing.zone === 'green' ? all : all.filter((o) => new Date(o.createdAt).getTime() < cutoff)
        return { openOrders, standing, blockMessage: null }
      }
      socket.leave(DRIVERS)
      if (!(await driverHasOnlineSocket(user.id))) {
        await setOnline(user.id, false)
        io.to(STAFF).emit('driver:offline', user.id)
      }
      console.log(`[driver] oflayn: ${user.fullName ?? user.id}`)
      return { openOrders: [] }
    })

    handle('driver:location', async (payload) => {
      if (!isDriver || !user.isApproved) throw new OrderError('Faqat tasdiqlangan haydovchi uchun')
      if (!isValidLocation(payload)) throw new OrderError("Koordinata noto'g'ri")

      const now = Date.now()
      if (now - lastLocationAt < LOCATION_MIN_INTERVAL_MS) return { skipped: true }
      lastLocationAt = now

      const loc = await saveLocation(user.id, payload, socket.data.online === true)
      const trip = activeTrips.get(user.id)
      let target = io.to(STAFF)
      if (trip?.passengerId) target = target.to(userRoom(trip.passengerId))
      target.emit('driver:location', { ...loc, orderId: trip?.orderId ?? null })
      return { skipped: false }
    })

    handle('order:rate', async (payload) => {
      const order = await rateOrder(user, payload)
      afterRating(order)
        .then((st) => st && order.driverId && sendStanding(order.driverId, st))
        .catch((e) => console.error('[wallet] baho balli xatosi:', e instanceof Error ? e.message : e))
      console.log(`[order] ${order.id} baholandi: ${order.rating}★`)
      io.to(STAFF).to(userRoom(user.id)).emit('order:updated', order)
      if (order.driverId) io.to(userRoom(order.driverId)).emit('order:rated', { orderId: order.id, rating: order.rating })
      return order
    })

    handle('history:list', async (payload) => listMyHistory(user, payload))

    handle('driver:summary', async () => driverSummary(user))

    handle('driver:car', async (payload) => {
      const result = await updateCar(user, payload)
      console.log(`[driver] ${user.fullName ?? user.id} mashina: ${result.car.model}, ${result.car.plate}${result.needsApproval ? ' (qayta tasdiq kerak)' : ''}`)
      if (result.needsApproval) {
        for (const s of socketsOf(user.id)) {
          ;(s.data.user as SocketUser).isApproved = false
          s.data.online = false
          s.leave(DRIVERS)
        }
        await setOnline(user.id, false).catch(() => {})
        io.to(STAFF).emit('driver:offline', user.id)
      }
      io.to(userRoom(user.id)).emit('profile:updated')
      return result
    })

    handle('order:accept', async ({ orderId }: { orderId: string }) => {
      if (isDriver) await assertCanTakeOrders(user.id)
      const order = await acceptOrder(user, orderId)
      console.log(`[order] ${order.id} qabul qilindi → ${user.fullName ?? user.id}`)
      io.to(DRIVERS).emit('order:taken', order.id)
      broadcastOrder(order)
      await sendLastDriverLocation(order)
      return order
    })

    // ---------- Umumiy ----------

    type StatusPayload = { orderId: string; status: OrderStatus; finalPrice?: number; reason?: string }
    handle('order:status', async ({ orderId, status, finalPrice, reason }: StatusPayload) => {
      const order = await changeStatus(user, orderId, status, { finalPrice, reason })
      const extra = order.status === 'in_trip' && order.waitingFee ? ` (kutish haqi ${order.waitingFee} so'm)` : ''
      const why = order.cancelReason ? ` (${order.cancelReason})` : ''
      console.log(`[order] ${order.id} → ${order.status}${extra}${why}`)
      if (order.status === 'cancelled' && !order.driverId) io.to(DRIVERS).emit('order:taken', order.id)
      broadcastOrder(order)
      await settleOrder(order)
      return order
    })

    // ---------- Dispetcher (va admin) ----------

    const requireStaff = () => {
      if (!isStaff) throw new OrderError('Faqat dispetcher yoki admin uchun')
    }

    handle('dispatch:lookup', async ({ phone }: { phone: string }) => lookupCustomer(user, phone))

    handle('dispatch:create', async (payload: { assignDriverId?: string | null; carCount?: number; confirmDuplicate?: boolean }) => {
      requireStaff()
      const carCount = Math.min(MAX_CARS_PER_CALL, Math.max(1, Math.floor(Number(payload?.carCount) || 1)))
      const surge = await surgeAt(payload)
      const orders: Order[] = []
      let assignError: string | null = null

      let partialError: string | null = null
      for (let n = 0; n < carCount; n++) {
        // Birinchisi tekshiriladi; qolganlari shu qo'ng'iroqning o'zi — tasdiq kerak emas
        let order: Order
        try {
          order = await createPhoneOrder(user, { ...payload, confirmDuplicate: n > 0 || payload?.confirmDuplicate === true }, surge)
        } catch (e) {
          // Birinchisi bo'lmasa — oddiy xato; keyingilari bo'lmasa — yaratilganlarini yo'qotmaymiz
          if (n === 0) throw e
          partialError = `${carCount} tadan ${n} tasi yaratildi: ${e instanceof Error ? e.message : String(e)}`
          break
        }
        console.log(`[dispatch] telefon buyurtma ${n + 1}/${carCount} ${order.id} · ${order.passengerPhone} · ${order.price} so'm${order.priceIsEstimate ? ' (taxminiy)' : ''}`)
        broadcastOrder(order)

        // Aniq haydovchi faqat birinchi mashinaga; qolganlari yaqin haydovchilarga
        if (n === 0 && payload?.assignDriverId) {
          try {
            await assertCanTakeOrders(payload.assignDriverId, true)
            const assigned = await assignOrder(user, order.id, payload.assignDriverId)
            console.log(`[dispatch] ${order.id} → haydovchiga biriktirildi: ${assigned.driverName ?? assigned.driverId}`)
            broadcastOrder(assigned)
            orders.push(assigned)
            continue
          } catch (e) {
            // Biriktirib bo'lmasa — buyurtma yo'qolmasin, hammaga yuboramiz
            assignError = e instanceof Error ? e.message : String(e)
          }
        }
        await notifyDrivers(order)
        orders.push(order)
      }
      return { order: orders[0], orders, assignError, partialError }
    })

    handle('dispatch:assign', async ({ orderId, driverId }: { orderId: string; driverId: string }) => {
      requireStaff()
      if (typeof driverId === 'string') await assertCanTakeOrders(driverId, true)
      const order = await assignOrder(user, orderId, driverId)
      console.log(`[dispatch] ${order.id} → haydovchiga biriktirildi: ${order.driverName ?? order.driverId}`)
      io.to(DRIVERS).emit('order:taken', order.id)
      broadcastOrder(order)
      return order
    })

    handle('admin:snapshot', async () => {
      requireStaff()
      const [drivers, orders] = await Promise.all([listOnlineDrivers(), listActiveOrders()])
      return { drivers, orders, stats: await getStats(drivers.length) }
    })

    // ---------- Faqat admin ----------

    const requireAdmin = () => {
      if (user.role !== 'admin') throw new OrderError('Faqat admin uchun')
    }

    handle('admin:dispatchers', async () => {
      requireAdmin()
      return listDispatchers()
    })

    handle('admin:setDispatcher', async ({ email, enabled }: { email: string; enabled: boolean }) => {
      requireAdmin()
      if (typeof email !== 'string' || !email.includes('@')) throw new OrderError("Email noto'g'ri")
      const userId = await setDispatcher(email, Boolean(enabled))
      // Ochiq sahifasi bo'lsa — yangi rol bilan qayta ulanadi
      io.to(userRoom(userId)).emit('profile:updated')
      console.log(`[admin] ${email} → ${enabled ? 'dispetcher' : "yo'lovchi"}`)
      return listDispatchers()
    })

    handle('admin:drivers', async () => {
      requireAdmin()
      return listDrivers()
    })

    handle('admin:approve', async ({ driverId, approved }: { driverId: string; approved: boolean }) => {
      requireAdmin()
      await setDriverApproved(driverId, Boolean(approved))
      // Haydovchining ochiq ulanishlariga yangi holatni darhol qo'llash
      for (const s of socketsOf(driverId)) {
        ;(s.data.user as SocketUser).isApproved = Boolean(approved)
        if (!approved) {
          s.data.online = false
          s.leave(DRIVERS)
        }
      }
      io.to(userRoom(driverId)).emit('profile:updated')
      if (!approved) io.to(STAFF).emit('driver:offline', driverId)
      console.log(`[admin] haydovchi ${driverId} → ${approved ? 'tasdiqlandi' : 'tasdiq bekor qilindi'}`)
      return listDrivers()
    })

    handle('admin:block', async ({ userId, blocked }: { userId: string; blocked: boolean }) => {
      requireAdmin()
      if (typeof userId !== 'string') throw new OrderError('Foydalanuvchi tanlanmagan')
      if (userId === user.id) throw new OrderError('O‘zingizni bloklay olmaysiz')
      await setBlocked(userId, Boolean(blocked))
      if (blocked) {
        // Ochiq ulanishlarini darhol uzamiz — qayta ulana olmaydi
        for (const s of socketsOf(userId)) {
          s.emit('account:blocked', BLOCKED_MESSAGE)
          s.disconnect(true)
        }
        io.to(STAFF).emit('driver:offline', userId)
      }
      console.log(`[admin] ${userId} → ${blocked ? 'bloklandi' : 'blokdan chiqarildi'}`)
      return listDrivers()
    })

    handle('admin:orders', async (payload) => searchOrders(user, payload))

    // ---------- Balans va ball ----------

    handle('driver:wallet', async () => {
      if (!isDriver) throw new OrderError('Faqat haydovchi uchun')
      const details = await walletDetails(user.id)
      return { ...details, blockMessage: blockMessage(details.standing) }
    })

    handle('admin:wallet', async ({ driverId }: { driverId: string }) => {
      requireAdmin()
      if (typeof driverId !== 'string') throw new OrderError('Haydovchi tanlanmagan')
      const details = await walletDetails(driverId)
      return { ...details, blockMessage: blockMessage(details.standing) }
    })

    handle('admin:balance', async (payload: { driverId: string; amount: number }) => {
      requireAdmin()
      const before = payload?.driverId ? await getStanding(payload.driverId).catch(() => null) : null
      const standing = await changeBalance(user, payload)
      sendStanding(payload.driverId, standing)
      console.log(`[admin] ${payload.driverId} balans ${payload.amount > 0 ? '+' : ''}${payload.amount} → ${standing.balance}`)
      // Balans to'ldirilib, buyurtma olish mumkin bo'lib qoldi
      if (before && before.balance < 0 && standing.balance >= 0) io.to(userRoom(payload.driverId)).emit('notice', '✅ Balans to‘ldirildi — buyurtmalar yana keladi')
      return listDrivers()
    })

    handle('admin:score', async (payload: { driverId: string; delta: number }) => {
      requireAdmin()
      const standing = await changeScore(user, payload)
      sendStanding(payload.driverId, standing)
      console.log(`[admin] ${payload.driverId} ball ${payload.delta > 0 ? '+' : ''}${payload.delta} → ${standing.score}`)
      return listDrivers()
    })

    handle('settings:get', async () => {
      requireAdmin()
      return { surge: getSurgeSettings(), commissionPct: walletReady() ? getCommissionPct() : null }
    })

    handle('settings:update', async ({ surge, commissionPct }: { surge?: unknown; commissionPct?: unknown }) => {
      requireAdmin()
      if (surge !== undefined) {
        const next = await updateSurgeSettings(surge)
        console.log(`[admin] surge: ${next.enabled ? `yoqildi (max ×${next.max})` : "o'chirildi"}`)
      }
      if (commissionPct !== undefined) {
        if (!walletReady()) throw new OrderError('Avval 013_wallet_score.sql ni ishga tushiring')
        console.log(`[admin] komissiya: ${await updateCommission(commissionPct)}%`)
      }
      return { surge: getSurgeSettings(), commissionPct: walletReady() ? getCommissionPct() : null }
    })

    handle('tariffs:update', async ({ id, patch }: { id: Tariff; patch: unknown }) => {
      requireAdmin()
      const checked = validateTariffPatch(patch)
      if (!checked.ok) throw new OrderError(checked.error)
      const tariffs = await updateTariff(id, checked.value)
      // Barcha ulangan mijozlarga (yo'lovchi ekranlari) yangi narxlar
      io.emit('tariffs:updated', tariffs)
      console.log(`[admin] tarif ${id} yangilandi:`, checked.value)
      return tariffs
    })

    // Qayta ulanganda joriy holatni tiklash.
    // Muhim: bu barcha handler'lar ro'yxatdan o'tgandan KEYIN — aks holda shu await paytida
    // mijoz yuborgan hodisalar (masalan, driver:online) yo'qolib ketadi.
    try {
      const active = await getActiveOrderFor(user)
      socket.emit('order:active', active)
      if (active) {
        trackTrip(active)
        if (user.role === 'passenger') await sendLastDriverLocation(active)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[socket] boshlang‘ich holat xatosi:', message)
      socket.emit('server:error', `Serverda xato: ${message}`)
    }

    socket.on('disconnect', async () => {
      console.log(`[socket] uzildi: ${user.role} ${user.fullName ?? user.id}`)
      if (isDriver && socket.data.online && !(await driverHasOnlineSocket(user.id))) {
        await setOnline(user.id, false).catch(() => {})
        io.to(STAFF).emit('driver:offline', user.id)
      }
    })
  })
}
