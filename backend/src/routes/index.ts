import { Router } from 'express'
import { getHealth } from '../controllers/health.controller.js'
import { authRouter } from './auth.routes.js'

export const router = Router()

router.get('/health', getHealth)
router.use('/auth', authRouter)
