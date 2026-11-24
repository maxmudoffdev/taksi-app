import type { Request, Response } from 'express'
import { checkSupabase } from '../supabase.js'

export async function getHealth(_req: Request, res: Response) {
  const db = await checkSupabase()
  res.json({ status: 'ok', supabase: db.ok, supabaseError: db.error, time: new Date().toISOString() })
}
