import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function Dashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ students: 0, hoursThisMonth: 0, upcomingLessons: 0 })
  const [todayLessons, setTodayLessons] = useState([])
  const [recentEntries, setRecentEntries] = useState([])

  const isAdmin = profile?.role === 'admin'
  const isInstructor = profile?.role === 'instructor'

  useEffect(() => {
    if (!profile) return
    async function loadStats() {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()

      if (isAdmin) {
        const [{ count: students }, { data: hours }, { count: upcoming }, { data: today }, { data: recent }] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
          supabase.from('logbook_entries').select('duration_hours').gte('date', monthStart),
          supabase.from('lessons').select('*', { count: 'exact', head: true }).gte('starts_at', now.toISOString()),
          supabase.from('lessons').select('*, student:profiles!student_id(full_name), instructor:profiles!instructor_id(full_name)').gte('starts_at', todayStart).lt('starts_at', todayEnd).order('starts_at'),
          supabase.from('logbook_entries').select('*, student:profiles!student_id(full_name)').order('date', { ascending: false }).limit(5),
        ])
        const totalHours = hours?.reduce((sum, r) => sum + (r.duration_hours ?? 0), 0) ?? 0
        setStats({ students: students ?? 0, hoursThisMonth: totalHours.toFixed(1), upcomingLessons: upcoming ?? 0 })
        setTodayLessons(today ?? [])
        setRecentEntries(recent ?? [])
      } else if (isInstructor) {
        const [{ data: myStudentLessons }, { data: hours }, { count: upcoming }, { data: today }, { data: recent }] = await Promise.all([
          supabase.from('lessons').select('student_id').eq('instructor_id', profile.id),
          supabase.from('logbook_entries').select('duration_hours').eq('instructor_id', profile.id).gte('date', monthStart),
          supabase.from('lessons').select('*', { count: 'exact', head: true }).eq('instructor_id', profile.id).gte('starts_at', now.toISOString()),
          supabase.from('lessons').select('*, student:profiles!student_id(full_name)').eq('instructor_id', profile.id).gte('starts_at', todayStart).lt('starts_at', todayEnd).order('starts_at'),
          supabase.from('logbook_entries').select('*, student:profiles!student_id(full_name)').eq('instructor_id', profile.id).order('date', { ascending: false }).limit(5),
        ])
        const uniqueStudents = new Set(myStudentLessons?.map(l => l.student_id)).size
        const totalHours = hours?.reduce((sum, r) => sum + (r.duration_hours ?? 0), 0) ?? 0
        setStats({ students: uniqueStudents, hoursThisMonth: totalHours.toFixed(1), upcomingLessons: upcoming ?? 0 })
        setTodayLessons(today ?? [])
        setRecentEntries(recent ?? [])
      } else {
        // student
        const [{ data: hours }, { count: upcoming }, { data: today }, { data: recent }] = await Promise.all([
          supabase.from('logbook_entries').select('duration_hours').eq('student_id', profile.id).gte('date', monthStart),
          supabase.from('lessons').select('*', { count: 'exact', head: true }).eq('student_id', profile.id).gte('starts_at', now.toISOString()),
          supabase.from('lessons').select('*, instructor:profiles!instructor_id(full_name)').eq('student_id', profile.id).gte('starts_at', todayStart).lt('starts_at', todayEnd).order('starts_at'),
          supabase.from('logbook_entries').select('*').eq('student_id', profile.id).order('date', { ascending: false }).limit(5),
        ])
        const totalHours = hours?.reduce((sum, r) => sum + (r.duration_hours ?? 0), 0) ?? 0
        setStats({ students: null, hoursThisMonth: totalHours.toFixed(1), upcomingLessons: upcoming ?? 0 })
        setTodayLessons(today ?? [])
        setRecentEntries(recent ?? [])
      }
    }
    loadStats()
  }, [profile, isAdmin, isInstructor])

  const studentLabel = isAdmin ? 'Active Students' : isInstructor ? 'My Students' : null

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="page-sub">Welcome back, {profile?.full_name?.split(' ')[0] ?? 'there'}</p>
        </div>
      </div>

      <div className="stat-grid">
        {studentLabel && (
          <div className="stat-card">
            <p className="stat-card__label">{studentLabel}</p>
            <p className="stat-card__value">{stats.students}</p>
          </div>
        )}
        <div className="stat-card">
          <p className="stat-card__label">Hours This Month</p>
          <p className="stat-card__value">{stats.hoursThisMonth}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">{isAdmin || isInstructor ? 'Upcoming Lessons' : 'My Upcoming Lessons'}</p>
          <p className="stat-card__value">{stats.upcomingLessons}</p>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <h3 className="card__title">Recent Logbook Entries</h3>
          {recentEntries.length === 0
            ? <p className="empty-state">No recent activity yet.</p>
            : recentEntries.map(e => (
              <div key={e.id} className="activity-row">
                <div>
                  <p className="activity-row__primary">{e.route ?? 'Flight'} — {e.aircraft_id ?? '—'}</p>
                  {(isAdmin || isInstructor) && e.student?.full_name && (
                    <p className="activity-row__sub">{e.student.full_name}</p>
                  )}
                </div>
                <div className="activity-row__meta">
                  <span>{e.duration_hours} hrs</span>
                  <span>{new Date(e.date).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          }
        </section>
        <section className="card">
          <h3 className="card__title">Today's Schedule</h3>
          {todayLessons.length === 0
            ? <p className="empty-state">No lessons scheduled today.</p>
            : todayLessons.map(l => (
              <div key={l.id} className="activity-row">
                <div>
                  <p className="activity-row__primary">{l.lesson_type ?? 'Lesson'}</p>
                  <p className="activity-row__sub">
                    {l.student?.full_name ?? l.instructor?.full_name ?? '—'}
                    {l.aircraft_id ? ` · ${l.aircraft_id}` : ''}
                  </p>
                </div>
                <div className="activity-row__meta">
                  <span>{new Date(l.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))
          }
        </section>
      </div>
    </Layout>
  )
}
