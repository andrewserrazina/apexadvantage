import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/dashboard',   label: 'Dashboard',   icon: '⊞', roles: ['admin', 'instructor', 'student'] },
  { to: '/students',    label: 'Students',    icon: '✈', roles: ['admin'] },
  { to: '/instructors', label: 'Instructors', icon: '◉', roles: ['admin'] },
  { to: '/syllabi',     label: 'Syllabi',     icon: '◧', roles: ['admin', 'instructor', 'student'] },
  { to: '/schedule',    label: 'Schedule',    icon: '◷', roles: ['admin', 'instructor', 'student'] },
  { to: '/logbook',     label: 'Logbook',     icon: '◈', roles: ['admin', 'instructor', 'student'] },
  { to: '/billing',     label: 'Billing',     icon: '◎', roles: ['admin', 'instructor', 'student'] },
]

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const role = profile?.role ?? 'student'
  const visibleNav = navItems.filter(item => item.roles.includes(role))

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  function closeSidebar() { setSidebarOpen(false) }

  return (
    <div className="app-shell">
      {/* Mobile top bar */}
      <header className="topbar">
        <button className="topbar__hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Open menu">
          <span /><span /><span />
        </button>
        <div className="topbar__brand">
          <span className="topbar__logo">✦</span>
          <span className="topbar__name">Apex<em>Advantage</em></span>
        </div>
      </header>

      {/* Overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}

      <aside className={`sidebar${sidebarOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <span className="sidebar__logo">✦</span>
          <span className="sidebar__name">Apex<em>Advantage</em></span>
        </div>

        <nav className="sidebar__nav">
          {visibleNav.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={closeSidebar}
              className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
            >
              <span className="nav-item__icon">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="sidebar__avatar">{profile?.full_name?.[0] ?? '?'}</div>
            <div>
              <p className="sidebar__user-name">{profile?.full_name ?? 'User'}</p>
              <p className="sidebar__user-role">{role}</p>
            </div>
          </div>
          <button className="sidebar__signout" onClick={handleSignOut}>Sign out</button>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  )
}
