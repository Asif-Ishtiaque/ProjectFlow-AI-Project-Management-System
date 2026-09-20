import './styles/app.css'
import type { ReactNode } from 'react'
import { Sidebar, TopBar, Toasts } from './components/shell'
import { JourneyPanel } from './demo/JourneyPanel'
import { useRoute } from './router'
import { AppProvider, useApp } from './store/store'
import { Dashboard } from './screens/Dashboard'
import { Portfolio } from './screens/Portfolio'
import { CreateProject } from './screens/CreateProject'
import { MyWork } from './screens/MyWork'
import { Approvals } from './screens/Approvals'
import { NotificationsScreen } from './screens/NotificationsScreen'
import { Settings } from './screens/Settings'
import { Workspace } from './screens/workspace/Workspace'

interface Resolved {
  crumbs: { label: string; href?: string }[]
  node: ReactNode
}

function Shell() {
  const route = useRoute()
  const { db } = useApp()
  const [top, second, third] = route.segments

  let resolved: Resolved
  if (top === 'projects' && second === 'new') {
    resolved = { crumbs: [{ label: 'Projects', href: '#/projects' }, { label: 'New project' }], node: <CreateProject /> }
  } else if (top === 'projects' && second) {
    const project = db.projects.find((p) => p.id === second)
    resolved = {
      crumbs: [{ label: 'Projects', href: '#/projects' }, { label: project?.name ?? 'Project' }],
      node: <Workspace projectId={second} tab={third ?? 'overview'} />,
    }
  } else if (top === 'projects') {
    resolved = { crumbs: [{ label: 'Projects' }], node: <Portfolio /> }
  } else if (top === 'my-work') {
    resolved = { crumbs: [{ label: 'My Work' }], node: <MyWork /> }
  } else if (top === 'approvals') {
    resolved = { crumbs: [{ label: 'Approvals' }], node: <Approvals /> }
  } else if (top === 'notifications') {
    resolved = { crumbs: [{ label: 'Notifications' }], node: <NotificationsScreen /> }
  } else if (top === 'settings') {
    resolved = { crumbs: [{ label: 'Settings' }], node: <Settings /> }
  } else {
    resolved = { crumbs: [{ label: 'Dashboard' }], node: <Dashboard /> }
  }

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <TopBar crumbs={resolved.crumbs} />
        {resolved.node}
      </div>
      <Toasts />
      <JourneyPanel />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
