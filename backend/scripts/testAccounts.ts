/**
 * Sinov hisoblari (e2e skriptlar uchun). Parollar kodda emas — backend/.env da (git'ga tushmaydi):
 *   E2E_DRIVER_EMAIL=driver1@test.uz      E2E_DRIVER_PASSWORD=...
 *   E2E_PASSENGER_EMAIL=pass1@test.uz     E2E_PASSENGER_PASSWORD=...
 *   E2E_DISPATCHER_EMAIL=disp1@test.uz    E2E_DISPATCHER_PASSWORD=...
 */
type Role = 'DRIVER' | 'PASSENGER' | 'DISPATCHER'

const DEFAULT_EMAIL: Record<Role, string> = {
  DRIVER: 'driver1@test.uz',
  PASSENGER: 'pass1@test.uz',
  DISPATCHER: 'disp1@test.uz',
}

export function testAccount(role: Role): { email: string; password: string } {
  const email = process.env[`E2E_${role}_EMAIL`] || DEFAULT_EMAIL[role]
  const password = process.env[`E2E_${role}_PASSWORD`]
  if (!password) {
    console.error(`⛔ backend/.env da E2E_${role}_PASSWORD berilmagan (${email} hisobi paroli).`)
    process.exit(2)
  }
  return { email, password }
}
