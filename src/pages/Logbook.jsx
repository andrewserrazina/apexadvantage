import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'

export default function Logbook() {
  const { profile } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [studentId, setStudentId] = useState('')
  const [students, setStudents] = useState([])

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (isAdmin) {
      supabase.from('profiles').select('id, full_name').eq('role', 'student').order('full_name')
        .then(({ data }) => setStudents(data ?? []))
    }
  }, [isAdmin])

  useEffect(() => {
    const id = isAdmin ? studentId : profile?.id
    if (!id) { setLoading(false); return }

    supabase
      .from('logbook_entries')
      .select('*, instructor:profiles!instructor_id(full_name)')
      .eq('student_id', id)
      .order('date', { ascending: false })
      .then(({ data }) => { setEntries(data ?? []); setLoading(false) })
  }, [studentId, profile, isAdmin])

  const totalHours = entries.reduce((sum, e) => sum + (e.duration_hours ?? 0), 0).toFixed(1)

  return (
    <Layout>
      <div className="page-header">
        <h2 className="page-title">Logbook</h2>
        {isAdmin && (
          <select className="select-input" value={studentId} onChange={e => setStudentId(e.target.value)}>
            <option value="">Select a student</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        )}
      </div>

      {(!isAdmin || studentId) && (
        <div className="stat-grid stat-grid--sm">
          <div className="stat-card">
            <p className="stat-card__label">Total Hours</p>
            <p className="stat-card__value">{totalHours}</p>
          </div>
          <div className="stat-card">
            <p className="stat-card__label">Entries</p>
            <p className="stat-card__value">{entries.length}</p>
          </div>
        </div>
      )}

      {loading ? <p className="empty-state">Loading…</p> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Aircraft</th>
                <th>Route</th>
                <th>Duration</th>
                <th>Instructor</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={6} className="empty-state">No entries yet.</td></tr>
              ) : entries.map(e => (
                <tr key={e.id}>
                  <td>{new Date(e.date).toLocaleDateString()}</td>
                  <td>{e.aircraft_id ?? '—'}</td>
                  <td>{e.route ?? '—'}</td>
                  <td>{e.duration_hours} hrs</td>
                  <td>{e.instructor?.full_name ?? '—'}</td>
                  <td className="td-notes">{e.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}
