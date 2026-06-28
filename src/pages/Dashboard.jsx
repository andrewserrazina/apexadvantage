import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function Dashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ students: 0, hoursThisMonth: 0, upcomingLessons: 0 })

  useEffect(() => {
    async function loadStats() {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [{ count: students }, { data: hours }, { count: upcoming }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('logbook_entries').select('duration_hours').gte('date', monthStart),
        supabase.from('lessons').select('*', { count: 'exact', head: true }).gte('starts_at', now.toISOString()),
      ])

      const totalHours = hours?.reduce((sum, r) => sum + (r.duration_hours ?? 0), 0) ?? 0
      setStats({ students: students ?? 0, hoursThisMonth: totalHours.toFixed(1), upcomingLessons: upcoming ?? 0 })
    }
    loadStats()
  }, [])

  return (
    <Layout>
      <div className="page-header">
        <h2 className="page-title">Dashboard</h2>
        <p className="page-sub">Welcome back, {profile?.full_name?.split(' ')[0] ?? 'there'}</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <p className="stat-card__label">Active Students</p>
          <p className="stat-card__value">{stats.students}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Hours This Month</p>
          <p className="stat-card__value">{stats.hoursThisMonth}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Upcoming Lessons</p>
          <p className="stat-card__value">{stats.upcomingLessons}</p>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <h3 className="card__title">Recent Activity</h3>
          <p className="empty-state">No recent activity yet.</p>
        </section>
        <section className="card">
          <h3 className="card__title">Today's Schedule</h3>
          <p className="empty-state">No lessons scheduled today.</p>
        </section>
      </div>
    </Layout>
  )
}
