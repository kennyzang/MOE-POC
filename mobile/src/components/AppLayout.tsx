import NavHeader from './NavHeader'
import RoleTabBar from './RoleTabBar'

interface AppLayoutProps {
  title: string
  showBack?: boolean
  showLogout?: boolean
  children: React.ReactNode
}

export default function AppLayout({ title, showBack, showLogout, children }: AppLayoutProps) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <NavHeader title={title} showBack={showBack} showLogout={showLogout} />
      <div className="page-content">{children}</div>
      <RoleTabBar />
    </div>
  )
}
