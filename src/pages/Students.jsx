import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function Students() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('*, logbook_entries(duration_hours)')
        .eq('role', 'student')
        .order('full_name')
      setStudents(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = students.filter(s =>
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  )

  function totalHours(student) {
    return (student.logbook_entries ?? []).reduce((sum, e) => sum + (e.duration_hours ?? 0), 0).toFixed(1)
  }

  return (
    <Layout>
      <div className="page-header">
        <h2 className="page-title">Students</h2>
        <input
          className="search-input"
          type="search"
          placeholder="Search students…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? <p className="empty-state">Loading…</p> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Certificate</th>
                <th>Medical Expiry</th>
                <th>Total Hours</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="empty-state">No students found.</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.full_name}</strong></td>
                  <td>{s.email}</td>
                  <td><span className="badge">{s.certificate_status ?? 'None'}</span></td>
                  <td>{s.medical_expiry ?? '—'}</td>
                  <td>{totalHours(s)} hrs</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}
