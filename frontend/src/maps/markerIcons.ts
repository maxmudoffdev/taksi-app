import L from 'leaflet'

/** A/B nuqta: oyoqchali zamonaviy pin */
function pin(label: string, bg: string) {
  return L.divIcon({
    className: '',
    iconSize: [36, 46],
    iconAnchor: [18, 44],
    html: `<div style="position:relative;width:36px;height:46px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.28))">
      <div style="width:36px;height:36px;border-radius:50%;background:${bg};border:3px solid #fff;display:flex;align-items:center;justify-content:center;font:800 14px Inter,system-ui;color:#fff">${label}</div>
      <div style="position:absolute;left:16px;top:34px;width:4px;height:10px;border-radius:2px;background:${bg}"></div>
    </div>`,
  })
}

export const pickupIcon = pin('A', '#18181b')
export const dropoffIcon = pin('B', '#ef4444')

/** Buyurtma nuqtasi (admin xaritasi): qidirilmoqda — sariq, faol — yashil */
export function orderDotIcon(searching: boolean) {
  const c = searching ? '#f59e0b' : '#10b981'
  return L.divIcon({
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<div style="width:22px;height:22px;border-radius:50%;background:${c}33;display:flex;align-items:center;justify-content:center">
      <div style="width:12px;height:12px;border-radius:50%;background:${c};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>
    </div>`,
  })
}
