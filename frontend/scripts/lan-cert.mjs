/**
 * Telefondan sinash uchun o'z-o'zidan imzolangan HTTPS sertifikat (kompyuterning Wi-Fi IP manzillari uchun).
 * `npm run dev:lan` avtomatik chaqiradi. IP o'zgarsa — sertifikat qayta yaratiladi.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'

const ips = Object.values(os.networkInterfaces())
  .flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal)
  .map((i) => i.address)

if (!ips.length) {
  console.error('⚠️  Wi-Fi tarmog‘i topilmadi. Kompyuter Wi-Fi’ga ulanganini tekshiring.')
  process.exit(1)
}

const dir = '.cert'
const stamp = `${dir}/ips.txt`
const want = [...ips].sort().join(',')
const have = fs.existsSync(stamp) ? fs.readFileSync(stamp, 'utf8') : ''

if (have !== want || !fs.existsSync(`${dir}/cert.pem`)) {
  fs.mkdirSync(dir, { recursive: true })
  const san = ['DNS:localhost', 'IP:127.0.0.1', ...ips.map((ip) => `IP:${ip}`)].join(',')
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '825',
    '-keyout', `${dir}/key.pem`, '-out', `${dir}/cert.pem`,
    '-subj', '/CN=taksi-dev', '-addext', `subjectAltName=${san}`,
  ], { stdio: 'ignore' })
  fs.writeFileSync(stamp, want)
}

console.log('\n📱 Telefondan oching (kompyuter bilan bitta Wi-Fi’da):')
for (const ip of ips) console.log(`   https://${ip}:5173`)
console.log('   Birinchi marta “xavfsiz emas” ogohlantirishi chiqadi → “Qo‘shimcha / Advanced” → “Davom etish”.\n')
