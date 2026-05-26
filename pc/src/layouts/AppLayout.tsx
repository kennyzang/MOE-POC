import { Layout } from 'antd'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import ChatWidget from '@/components/ChatWidget'
import { useUIStore } from '@/stores/uiStore'

const { Content } = Layout

const AppLayout = () => {
  const collapsed = useUIStore(s => s.sidebarCollapsed)

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout
        style={{
          marginLeft: collapsed ? 64 : 240,
          transition: 'margin-left 0.2s',
        }}
      >
        <Navbar />
        <Content
          style={{
            margin: '8px 16px 16px',
            padding: 24,
            minHeight: 'calc(100vh - 80px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
      <ChatWidget />
    </Layout>
  )
}

export default AppLayout
