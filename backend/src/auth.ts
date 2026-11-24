import type { UserRole } from '../../shared/types'
import { db } from './supabase.js'

export interface SocketUser {
  id: string
  role: UserRole
  isApproved: boolean
  fullName: string | null
}

export const BLOCKED_MESSAGE = 'Hisobingiz bloklangan. Admin bilan bog‘laning.'

/** Supabase access token'ni tekshirib, foydalanuvchi profilini qaytaradi */
export async function verifyToken(token: string): Promise<SocketUser> {
  const { data, error } = await db().auth.getUser(token)
  if (error || !data.user) throw new Error("Token yaroqsiz yoki muddati o'tgan")

  const { data: profile, error: pErr } = await db()
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .maybeSingle()
  if (pErr) {
    console.error('[auth] profil o‘qilmadi:', pErr.message)
    throw new Error('Serverda xato. Birozdan keyin qayta urining.')
  }
  if (!profile) throw new Error('Profil topilmadi')
  if (profile.is_blocked) throw new Error(BLOCKED_MESSAGE)

  return { id: profile.id, role: profile.role, isApproved: profile.is_approved, fullName: profile.full_name }
}
