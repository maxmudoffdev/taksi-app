import { supabase } from './supabase'
import type { AppUser, UserRole } from '../types'

export type SignUpInput = {
  email: string
  password: string
  fullName: string
  phone: string
  role: Exclude<UserRole, 'admin' | 'dispatcher'>
  /** Faqat haydovchi uchun */
  car?: { model: string; color: string; plate: string }
}

export async function signUp({ email, password, fullName, phone, role, car }: SignUpInput) {
  const carMeta = role === 'driver' && car ? { car_model: car.model, car_color: car.color, car_plate: car.plate } : {}
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone, role, ...carMeta } },
  })
  if (error) throw error
  return { needsEmailConfirm: !data.session }
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

/** "Parolni unutdim": emailga tiklash havolasi yuboriladi */
export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function fetchProfile(userId: string): Promise<AppUser | null> {
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data as AppUser | null
}

export const dashboardPath: Record<UserRole, string> = {
  passenger: '/passenger',
  driver: '/driver',
  admin: '/admin',
  dispatcher: '/dispatcher',
}

const errorMessages: Record<string, string> = {
  'Email not confirmed': "Email tasdiqlanmagan. Pochtangizdagi havolani bosing (yoki Supabase'da \"Confirm email\"ni o'chiring).",
  'Invalid login credentials': "Email yoki parol noto'g'ri.",
  'User already registered': "Bu email bilan allaqachon ro'yxatdan o'tilgan.",
  'Email rate limit exceeded': "Email yuborish limiti tugadi. Supabase'da \"Confirm email\"ni o'chiring yoki keyinroq urining.",
  'Database error saving new user': "Profil yaratilmadi (bu telefon raqam yoki davlat raqami band bo'lishi mumkin).",
  'New password should be different from the old password.': "Yangi parol eskisidan farq qilishi kerak.",
  'Auth session missing!': "Havola eskirgan yoki allaqachon ishlatilgan. Qaytadan \"Parolni unutdim\" ni bosing.",
}

export function authErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return errorMessages[msg] ?? msg
}
