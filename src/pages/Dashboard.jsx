import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function Dashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ students: 0, hoursThisMonth: 0, upcomingLessons: 0 })
  const [todayLessons, setTodayLessons] = useState([])
  const [recentEntries, setRecentEntries] = useState([])
  const [enrolledSyllabi, setEnrolledSyllabi] = useState([])
  const [upcomingGroundSessions, setUpcomingGroundSessions] = useState([])

  const isAdmin = profile?.role === 'admin'
  const isInstructor = profile?.role === 'instructor'
  const isStudent = profile?.role === 'student'

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

    async function loadStudentProgress() {
      if (!isStudent) return
      const { data: enrollments } = await supabase
        .from('student_syllabi')
        .select('*, syllabus:syllabi(id, title)')
        .eq('student_id', profile.id)
      if (!enrollments?.length) return

      const enriched = await Promise.all(enrollments.map(async en => {
        const { count: total } = await supabase
          .from('syllabus_lessons')
          .select('*', { count: 'exact', head: true })
          .eq('syllabus_id', en.syllabus_id)
        const { count: done } = await supabase
          .from('lesson_completions')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', profile.id)
          .eq('syllabus_id', en.syllabus_id)
        return { ...en, total: total ?? 0, done: done ?? 0 }
      }))
      setEnrolledSyllabi(enriched)

      // Upcoming ground sessions (student registered for)
      const { data: regs } = await supabase
        .from('ground_registrations')
        .select('session_id')
        .eq('email', profile.email)
      if (regs?.length) {
        const ids = regs.map(r => r.session_id)
        const { data: sessions } = await supabase
          .from('ground_sessions')
          .select('*')
          .in('id', ids)
          .gte('session_date', new Date().toISOString().slice(0, 10))
          .order('session_date')
          .limit(3)
        setUpcomingGroundSessions(sessions ?? [])
      }
    }

    loadStats()
    loadStudentProgress()
  }, [profile, isAdmin, isInstructor, isStudent])

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

      {/* Student progress section */}
      {isStudent && enrolledSyllabi.length > 0 && (
        <section className="card" style={{ marginBottom: 24 }}>
          <h3 className="card__title">My Progress</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {enrolledSyllabi.map(en => {
              const pct = en.total > 0 ? Math.round((en.done / en.total) * 100) : 0
              return (
                <div key={en.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{en.syllabus?.title ?? 'Syllabus'}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{en.done}/{en.total} lessons · {pct}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
                    </p>
                  </div>
                  <div className="activity-row__meta">
                    <span>{new Date(l.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))
            }
          </section>

          {isStudent && upcomingGroundSessions.length > 0 && (
            <section className="card">
              <h3 className="card__title">Upcoming Ground School</h3>
              {upcomingGroundSessions.map(s => (
                <div key={s.id} className="activity-row">
                  <div>
                    <p className="activity-row__primary">{s.title}</p>
                    <p className="activity-row__sub">{s.location ?? 'Location TBD'}</p>
                  </div>
                  <div className="activity-row__meta">
                    <span>{new Date(s.session_date).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </Layout>
  )
}
