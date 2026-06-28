import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'

export default function Billing() {
  const { profile } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState([])
  const [studentId, setStudentId] = useState('')

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
      .from('invoices')
      .select('*')
      .eq('student_id', id)
      .order('issued_at', { ascending: false })
      .then(({ data }) => { setInvoices(data ?? []); setLoading(false) })
  }, [studentId, profile, isAdmin])

  const statusClass = s => ({ paid: 'badge badge--green', unpaid: 'badge badge--red', pending: 'badge badge--yellow' }[s] ?? 'badge')

  return (
    <Layout>
      <div className="page-header">
        <h2 className="page-title">Billing</h2>
        {isAdmin && (
          <select className="select-input" value={studentId} onChange={e => setStudentId(e.target.value)}>
            <option value="">Select a student</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        )}
      </div>

      {loading ? <p className="empty-state">Loading…</p> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Issued</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td colSpan={5} className="empty-state">No invoices yet.</td></tr>
              ) : invoices.map(inv => (
                <tr key={inv.id}>
                  <td>#{inv.id.slice(0, 8).toUpperCase()}</td>
                  <td>{new Date(inv.issued_at).toLocaleDateString()}</td>
                  <td>{inv.description}</td>
                  <td>${Number(inv.amount_cents / 100).toFixed(2)}</td>
                  <td><span className={statusClass(inv.status)}>{inv.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}
