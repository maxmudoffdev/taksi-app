import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'
import { fetchProfile } from '../services/auth'
import { supabase } from '../services/supabase'
import type { AppUser } from '../types'

type AuthState = {
  session: Session | null
  profile: AppUser | null
  loading: boolean
  init: () => () => void
  refreshProfile: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  loading: true,

  // Sessiyani tiklaydi (supabase-js uni localStorage'da saqlaydi) va o'zgarishlarni kuzatadi
  init: () => {
    const load = async (session: Session | null) => {
      set({ session, loading: true })
      let profile: AppUser | null = null
      if (session) {
        try {
          profile = await fetchProfile(session.user.id)
        } catch (e) {
          console.error('[Auth] profilni yuklashda xato', e)
        }
      }
      set({ profile, loading: false })
    }

    supabase.auth.getSession().then(({ data }) => load(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // Supabase callback ichida await qilmaslik tavsiya etiladi
        setTimeout(() => load(session), 0)
      } else {
        set({ session })
      }
    })
    return () => data.subscription.unsubscribe()
  },

  refreshProfile: async () => {
    const id = get().session?.user.id
    if (id) set({ profile: await fetchProfile(id) })
  },
}))
