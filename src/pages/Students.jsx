import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import Modal from '../components/Modal'

const CERT_OPTIONS = ['None', 'Student Pilot', 'Private Pilot', 'Instrument Rating', 'Commercial Pilot', 'ATP']

const BLANK = { full_name: '', email: '', certificate_status: 'None', medical_expiry: '' }

export default function Students() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | { mode: 'edit', student }
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  async function load() {
    const { data } = await supabase
      .from('profiles')
      .select('*, logbook_entries(duration_hours)')
      .eq('role', 'student')
      .order('full_name')
    setStudents(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = students.filter(s =>
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  )

  function totalHours(student) {
    return (student.logbook_entries ?? []).reduce((sum, e) => sum + (e.duration_hours ?? 0), 0).toFixed(1)
  }

  function openEdit(student) {
    setForm({
      full_name: student.full_name ?? '',
      email: student.email ?? '',
      certificate_status: student.certificate_status ?? 'None',
      medical_expiry: student.medical_expiry ?? '',
    })
    setFormError('')
    setModal({ mode: 'edit', student })
  }

  function closeModal() { setModal(null); setFormError('') }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name,
        certificate_status: form.certificate_status || null,
        medical_expiry: form.medical_expiry || null,
      })
      .eq('id', modal.student.id)
    setSaving(false)
    if (error) { setFormError(error.message); return }
    closeModal()
    load()
  }

  function field(key, value) { setForm(f => ({ ...f, [key]: value })) }

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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="empty-state">No students found.</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.full_name}</strong></td>
                  <td>{s.email}</td>
                  <td><span className="badge">{s.certificate_status ?? 'None'}</span></td>
                  <td>{s.medical_expiry ?? '—'}</td>
                  <td>{totalHours(s)} hrs</td>
                  <td>
                    <button className="btn-link" onClick={() => openEdit(s)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal?.mode === 'edit' && (
        <Modal title="Edit Student" onClose={closeModal}>
          <form onSubmit={handleSave} className="modal-form">
            {formError && <div className="form-error">{formError}</div>}
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" value={form.full_name} onChange={e => field('full_name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} disabled className="input-disabled" />
            </div>
            <div className="form-group">
              <label>Certificate Status</label>
              <select value={form.certificate_status} onChange={e => field('certificate_status', e.target.value)}>
                {CERT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Medical Expiry</label>
              <input type="date" value={form.medical_expiry} onChange={e => field('medical_expiry', e.target.value)} />
            </div>
            <div className="modal-form__actions">
              <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
              <button type="submit" className="btn-primary-sm" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  )
}
