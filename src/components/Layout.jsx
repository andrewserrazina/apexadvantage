import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ApexLogo from './ApexLogo'

const navItems = [
  { to: '/dashboard',      label: 'Dashboard',    roles: ['admin', 'instructor', 'student'] },
  { to: '/students',       label: 'Students',     roles: ['admin'] },
  { to: '/instructors',    label: 'Instructors',  roles: ['admin'] },
  { to: '/syllabi',        label: 'Syllabi',      roles: ['admin', 'instructor', 'student'] },
  { to: '/schedule',       label: 'Schedule',     roles: ['admin', 'instructor', 'student'] },
  { to: '/logbook',        label: 'Logbook',      roles: ['admin', 'instructor', 'student'] },
  { to: '/billing',        label: 'Billing',      roles: ['admin', 'instructor', 'student'] },
  { to: '/ground-schedule', label: 'Ground School', roles: ['admin', 'instructor', 'student'] },
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
          <ApexLogo size={26} />
          <span className="topbar__name">APEX <em>Advantage</em></span>
        </div>
      </header>

      {/* Overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}

      <aside className={`sidebar${sidebarOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <ApexLogo size={34} />
          <div className="sidebar__brand-text">
            <span className="sidebar__name-apex">APEX</span>
            <span className="sidebar__name-sub">— ADVANTAGE —</span>
          </div>
          <button className="sidebar__close" onClick={closeSidebar} aria-label="Close menu">✕</button>
        </div>

        <nav className="sidebar__nav">
          {visibleNav.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={closeSidebar}
              className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
            >
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
