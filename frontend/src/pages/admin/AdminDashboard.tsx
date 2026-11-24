import { Car, Coins, Headset, LayoutDashboard, ListOrdered, PhoneCall } from 'lucide-react'
import { useEffect, useState } from 'react'
import StaffLayout, { type NavItem } from '../../components/layout/StaffLayout'
import Card, { SectionTitle } from '../../components/ui/Card'
import { useAdminStore } from '../../store/adminStore'
import ActiveOrders from './components/ActiveOrders'
import DispatchersPanel from './components/DispatchersPanel'
import DriversTable from './components/DriversTable'
import LiveMap from './components/LiveMap'
import OrdersHistory from './components/OrdersHistory'
import StatsBar from './components/StatsBar'
import TariffEditor from './components/TariffEditor'

type Tab = 'monitor' | 'orders' | 'drivers' | 'dispatchers' | 'tariffs'
const TITLES: Record<Tab, string> = {
  monitor: 'Monitoring',
  orders: 'Buyurtmalar',
  drivers: 'Haydovchilar',
  dispatchers: 'Dispetcherlar',
  tariffs: 'Tariflar',
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('monitor')
  const { drivers, orders, stats, error, bind, cancelOrder } = useAdminStore()
  const driverList = Object.values(drivers)

  useEffect(() => bind(), [bind])

  const item = (key: Tab, icon: React.ReactNode, badge?: number): NavItem => ({
    key,
    label: TITLES[key],
    icon,
    active: tab === key,
    onClick: () => setTab(key),
    badge,
  })
  const nav: NavItem[] = [
    item('monitor', <LayoutDashboard />, stats?.searchingOrders || undefined),
    item('orders', <ListOrdered />),
    item('drivers', <Car />),
    item('dispatchers', <Headset />),
    item('tariffs', <Coins />),
    { key: 'dispatch', label: 'Dispetcher ekrani', icon: <PhoneCall />, to: '/dispatcher' },
  ]

  return (
    <StaffLayout nav={nav} title={TITLES[tab]}>
      {error && <p className="mb-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>}

      {tab === 'monitor' && (
        <div className="space-y-5">
          <StatsBar stats={stats} onlineDrivers={driverList.length} />
          <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
            <div className="h-[62vh] min-h-[420px] overflow-hidden rounded-3xl border border-line/70 shadow-card">
              <LiveMap drivers={driverList} orders={orders} />
            </div>
            <Card className="flex max-h-[62vh] min-h-[420px] flex-col p-0">
              <div className="border-b border-line px-4 py-3.5">
                <SectionTitle>Faol buyurtmalar · {orders.length}</SectionTitle>
              </div>
              <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
                <ActiveOrders orders={orders} onCancel={cancelOrder} />
              </div>
            </Card>
          </div>
        </div>
      )}
      {tab === 'orders' && <OrdersHistory />}
      {tab === 'drivers' && (
        <Card className="p-5">
          <DriversTable />
        </Card>
      )}
      {tab === 'dispatchers' && (
        <Card className="max-w-2xl p-5">
          <DispatchersPanel />
        </Card>
      )}
      {tab === 'tariffs' && <TariffEditor />}
    </StaffLayout>
  )
}
