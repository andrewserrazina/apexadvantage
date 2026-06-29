import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import Modal from '../components/Modal'

const STATUSES = [
  { value: 'available', label: 'Available' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'unavailable', label: 'Unavailable' },
]

const SQUAWK_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'deferred', label: 'Deferred' },
  { value: 'resolved', label: 'Resolved' },
]

const BLANK = { tail_number: '', make: '', model: '', year: '', status: 'available', total_hours: '', last_inspection: '', notes: '' }

function statusBadge(s) {
  if (s === 'available') return 'badge badge--green'
  if (s === 'maintenance') return 'badge badge--yellow'
  return 'badge badge--red'
}

function squawkBadge(s) {
  if (s === 'resolved') return 'badge badge--green'
  if (s === 'deferred') return 'badge badge--yellow'
  return 'badge badge--red'
}

export default function Aircraft() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const isStaff = isAdmin || profile?.role === 'instructor'

  const [aircraft, setAircraft] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Squawk state
  const [squawkModal, setSquawkModal] = useState(null) // { aircraft }
  const [squawks, setSquawks] = useState([])
  const [squawkForm, setSquawkForm] = useState({ description: '', notes: '', status: 'open' })
  const [squawkSaving, setSquawkSaving] = useState(false)
  const [addingSquawk, setAddingSquawk] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('aircraft').select('*').order('tail_number')
    setAircraft(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function openSquawks(ac) {
    setSquawkModal({ aircraft: ac })
    setAddingSquawk(false)
    setSquawkForm({ description: '', notes: '', status: 'open' })
    const { data } = await supabase
      .from('squawks')
      .select('*, reporter:reported_by(full_name)')
      .eq('aircraft_id', ac.id)
      .order('created_at', { ascending: false })
    setSquawks(data ?? [])
  }

  async function handleAddSquawk(e) {
    e.preventDefault()
    setSquawkSaving(true)
    const { error } = await supabase.from('squawks').insert({
      aircraft_id: squawkModal.aircraft.id,
      description: squawkForm.description,
      notes: squawkForm.notes || null,
      status: squawkForm.status,
      reported_by: profile.id,
    })
    if (!error) {
      setSquawkForm({ description: '', notes: '', status: 'open' })
      setAddingSquawk(false)
      const { data } = await supabase.from('squawks').select('*, reporter:reported_by(full_name)').eq('aircraft_id', squawkModal.aircraft.id).order('created_at', { ascending: false })
      setSquawks(data ?? [])
    }
    setSquawkSaving(false)
  }

  async function updateSquawkStatus(squawkId, status) {
    await supabase.from('squawks').update({ status, ...(status === 'resolved' ? { resolved_at: new Date().toISOString() } : {}) }).eq('id', squawkId)
    const { data } = await supabase.from('squawks').select('*, reporter:reported_by(full_name)').eq('aircraft_id', squawkModal.aircraft.id).order('created_at', { ascending: false })
    setSquawks(data ?? [])
  }

  function openCreate() {
    setForm(BLANK)
    setFormError('')
    setModal({ mode: 'create' })
  }

  function openEdit(ac) {
    setForm({
      tail_number: ac.tail_number ?? '',
      make: ac.make ?? '',
      model: ac.model ?? '',
      year: ac.year ?? '',
      status: ac.status ?? 'available',
      total_hours: ac.total_hours ?? '',
      last_inspection: ac.last_inspection ?? '',
      notes: ac.notes ?? '',
    })
    setFormError('')
    setModal({ mode: 'edit', ac })
  }

  function closeModal() { setModal(null); setFormError('') }
  function field(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    const payload = {
      tail_number: form.tail_number.trim().toUpperCase(),
      make: form.make || null,
      model: form.model || null,
      year: form.year ? parseInt(form.year) : null,
      status: form.status,
      total_hours: form.total_hours ? parseFloat(form.total_hours) : 0,
      last_inspection: form.last_inspection || null,
      notes: form.notes || null,
    }
    let error
    if (modal.mode === 'create') {
      ;({ error } = await supabase.from('aircraft').insert(payload))
    } else {
      ;({ error } = await supabase.from('aircraft').update(payload).eq('id', modal.ac.id))
    }
    setSaving(false)
    if (error) { setFormError(error.message); return }
    closeModal()
    load()
  }

  async function handleDelete() {
    if (!window.confirm(`Remove ${modal.ac.tail_number} from fleet?`)) return
    await supabase.from('aircraft').delete().eq('id', modal.ac.id)
    closeModal()
    load()
  }

  const openSquawkCount = (acId) => {
    // We don't have squawks loaded for all aircraft — just show a dot if there are open ones
    // This would be enhanced with a join
    return null
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h2 className="page-title">Fleet</h2>
          <p className="page-sub">Aircraft management</p>
        </div>
        {isAdmin && (
          <button className="btn-primary-sm" onClick={openCreate}>+ Add Aircraft</button>
        )}
      </div>

      <div className="stat-grid stat-grid--sm">
        <div className="stat-card">
          <p className="stat-card__label">Total Aircraft</p>
          <p className="stat-card__value">{aircraft.length}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Available</p>
          <p className="stat-card__value">{aircraft.filter(a => a.status === 'available').length}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">In Maintenance</p>
          <p className="stat-card__value">{aircraft.filter(a => a.status === 'maintenance').length}</p>
        </div>
      </div>

      {loading ? <p className="empty-state">Loading…</p> : aircraft.length === 0 ? (
        <p className="empty-state">No aircraft in fleet yet.</p>
      ) : (
        <div className="aircraft-grid">
          {aircraft.map(ac => (
            <div key={ac.id} className="aircraft-card">
              <div className="aircraft-card__head">
                <span className="aircraft-card__tail">{ac.tail_number}</span>
                <span className={statusBadge(ac.status)}>{ac.status}</span>
              </div>
              <p className="aircraft-card__model">{[ac.year, ac.make, ac.model].filter(Boolean).join(' ') || 'Unknown aircraft'}</p>
              <div className="aircraft-card__stats">
                <div>
                  <p className="aircraft-card__stat-label">Total Hours</p>
                  <p className="aircraft-card__stat-value">{ac.total_hours ?? '—'}</p>
                </div>
                <div>
                  <p className="aircraft-card__stat-label">Last Inspection</p>
                  <p className="aircraft-card__stat-value">{ac.last_inspection ? new Date(ac.last_inspection).toLocaleDateString() : '—'}</p>
                </div>
              </div>
              {ac.notes && <p className="aircraft-card__notes">{ac.notes}</p>}
              <div className="aircraft-card__actions">
                <button className="btn-link" onClick={() => openSquawks(ac)}>
                  Squawk Log
                </button>
                {isAdmin && (
                  <button className="btn-link" onClick={() => openEdit(ac)}>Edit</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Aircraft create/edit modal */}
      {modal && (
        <Modal title={modal.mode === 'create' ? 'Add Aircraft' : `Edit ${modal.ac?.tail_number}`} onClose={closeModal}>
          <form onSubmit={handleSave} className="modal-form">
            {formError && <div className="form-error">{formError}</div>}
            <div className="form-row">
              <div className="form-group">
                <label>Tail Number</label>
                <input type="text" value={form.tail_number} onChange={e => field('tail_number', e.target.value)} required placeholder="N12345" />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={e => field('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Make</label>
                <input type="text" value={form.make} onChange={e => field('make', e.target.value)} placeholder="Cessna" />
              </div>
              <div className="form-group">
                <label>Model</label>
                <input type="text" value={form.model} onChange={e => field('model', e.target.value)} placeholder="172S" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Year</label>
                <input type="number" value={form.year} onChange={e => field('year', e.target.value)} placeholder="2018" min="1900" max="2030" />
              </div>
              <div className="form-group">
                <label>Total Hours</label>
                <input type="number" step="0.1" min="0" value={form.total_hours} onChange={e => field('total_hours', e.target.value)} placeholder="1200.0" />
              </div>
            </div>
            <div className="form-group">
              <label>Last Inspection</label>
              <input type="date" value={form.last_inspection} onChange={e => field('last_inspection', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={form.notes} onChange={e => field('notes', e.target.value)} rows={2} placeholder="Optional notes…" />
            </div>
            <div className="modal-form__actions">
              {modal.mode === 'edit' && (
                <button type="button" className="btn-danger" onClick={handleDelete}>Remove</button>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary-sm" disabled={saving}>{saving ? 'Saving…' : modal.mode === 'create' ? 'Add Aircraft' : 'Save'}</button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Squawk log modal */}
      {squawkModal && (
        <Modal title={`Squawk Log — ${squawkModal.aircraft.tail_number}`} onClose={() => setSquawkModal(null)}>
          <div className="modal-form">
            {squawks.length === 0 && !addingSquawk && (
              <p className="empty-state" style={{ marginBottom: 16 }}>No squawks logged.</p>
            )}

            {squawks.map(sq => (
              <div key={sq.id} className="squawk-item">
                <div className="squawk-item__head">
                  <span className={squawkBadge(sq.status)}>{sq.status}</span>
                  <span className="squawk-item__date">{new Date(sq.created_at).toLocaleDateString()}</span>
                  {sq.reporter?.full_name && <span className="squawk-item__reporter">by {sq.reporter.full_name}</span>}
                </div>
                <p className="squawk-item__desc">{sq.description}</p>
                {sq.notes && <p className="squawk-item__notes">{sq.notes}</p>}
                {isStaff && sq.status !== 'resolved' && (
                  <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    {sq.status === 'open' && (
                      <button className="btn-link" style={{ fontSize: 12 }} onClick={() => updateSquawkStatus(sq.id, 'deferred')}>Defer</button>
                    )}
                    <button className="btn-link" style={{ fontSize: 12, color: '#4ade80' }} onClick={() => updateSquawkStatus(sq.id, 'resolved')}>Resolve</button>
                  </div>
                )}
              </div>
            ))}

            {addingSquawk ? (
              <form onSubmit={handleAddSquawk} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group">
                  <label>Description</label>
                  <textarea value={squawkForm.description} onChange={e => setSquawkForm(f => ({ ...f, description: e.target.value }))} rows={2} required placeholder="Describe the issue…" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Initial Status</label>
                    <select value={squawkForm.status} onChange={e => setSquawkForm(f => ({ ...f, status: e.target.value }))}>
                      {SQUAWK_STATUSES.filter(s => s.value !== 'resolved').map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Notes (optional)</label>
                    <input type="text" value={squawkForm.notes} onChange={e => setSquawkForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional context…" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-secondary" onClick={() => setAddingSquawk(false)}>Cancel</button>
                  <button type="submit" className="btn-primary-sm" disabled={squawkSaving}>{squawkSaving ? 'Logging…' : 'Log Squawk'}</button>
                </div>
              </form>
            ) : (
              <button className="btn-secondary" style={{ marginTop: 16, width: '100%' }} onClick={() => setAddingSquawk(true)}>
                + Log Squawk
              </button>
            )}
          </div>
        </Modal>
      )}
    </Layout>
  )
}
