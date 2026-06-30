import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import Modal from '../components/Modal'

const BLANK = {
  student_id: '', instructor_id: '', date: '', aircraft_id: '', route: '',
  total_time: '', dual_received: '', solo_time: '', pic_time: '', sic_time: '',
  cross_country_time: '', night_time: '', actual_instrument: '', simulated_instrument: '',
  approaches: '', day_landings: '', night_landings: '',
  flight_conditions: 'VFR', remarks: '',
}

function toCSV(headers, rows) {
  return [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
}

function downloadCSV(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function exportCSV(entries, aircraft, studentName) {
  const headers = [
    'Date','Aircraft','Route','Total Time','Dual Received','Solo','PIC','SIC',
    'Cross-Country','Night','Actual Inst','Sim Inst','Approaches','Day Ldg','Night Ldg',
    'Conditions','Instructor','Remarks',
  ]
  const acLabel = id => aircraft.find(a => a.id === id)?.tail_number ?? ''
  const rows = entries.map(e => [
    e.date, acLabel(e.aircraft_id), e.route ?? '',
    e.total_time ?? e.duration_hours ?? '',
    e.dual_received ?? '', e.solo_time ?? '', e.pic_time ?? '', e.sic_time ?? '',
    e.cross_country_time ?? '', e.night_time ?? '',
    e.actual_instrument ?? '', e.simulated_instrument ?? '',
    e.approaches ?? '', e.day_landings ?? '', e.night_landings ?? '',
    e.flight_conditions ?? 'VFR',
    e.instructor?.full_name ?? '', e.remarks ?? e.notes ?? '',
  ])
  downloadCSV(`logbook_${(studentName ?? 'export').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`, toCSV(headers, rows))
}

const TimeInput = ({ label, value, onChange, isInt = false }) => (
  <div className="form-group">
    <label style={{ fontSize: 11 }}>{label}</label>
    <input
      type="number" step={isInt ? '1' : '0.1'} min="0"
      value={value} onChange={e => onChange(e.target.value)}
      placeholder="0"
      style={{ fontSize: 13, padding: '6px 8px' }}
    />
  </div>
)

export default function Logbook() {
  const { profile } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [studentId, setStudentId] = useState('')
  const [students, setStudents] = useState([])
  const [instructors, setInstructors] = useState([])
  const [aircraft, setAircraft] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [expandedEntry, setExpandedEntry] = useState(null)

  const isAdmin = profile?.role === 'admin'
  const isInstructor = profile?.role === 'instructor'
  const canEdit = isAdmin || isInstructor

  async function loadStudents() {
    if (isAdmin) {
      const { data } = await supabase.from('profiles').select('id, full_name').eq('role', 'student').order('full_name')
      setStudents(data ?? [])
    } else if (isInstructor) {
      const { data } = await supabase.from('lessons').select('student:profiles!student_id(id, full_name)').eq('instructor_id', profile.id)
      const seen = new Set(); const unique = []
      for (const l of data ?? []) {
        if (l.student && !seen.has(l.student.id)) { seen.add(l.student.id); unique.push(l.student) }
      }
      setStudents(unique.sort((a, b) => a.full_name.localeCompare(b.full_name)))
    }
  }

  useEffect(() => {
    if (!profile) return
    loadStudents()
    if (canEdit) {
      supabase.from('profiles').select('id, full_name').eq('role', 'instructor').order('full_name')
        .then(({ data }) => setInstructors(data ?? []))
    }
    supabase.from('aircraft').select('id, tail_number, make, model').order('tail_number')
      .then(({ data }) => setAircraft(data ?? []))
  }, [profile])

  async function loadEntries(id) {
    if (!id) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('logbook_entries')
      .select('*, instructor:profiles!instructor_id(full_name)')
      .eq('student_id', id)
      .order('date', { ascending: false })
    setEntries(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (!profile) return
    const id = canEdit ? studentId : profile.id
    loadEntries(id)
  }, [studentId, profile])

  function sum(field) {
    return entries.reduce((s, e) => s + (e[field] ?? (field === 'total_time' ? (e.duration_hours ?? 0) : 0)), 0)
  }

  const totals = {
    total:    sum('total_time'),
    dual:     sum('dual_received'),
    solo:     sum('solo_time'),
    pic:      sum('pic_time'),
    night:    sum('night_time'),
    xc:       sum('cross_country_time'),
    inst:     sum('actual_instrument') + sum('simulated_instrument'),
    landings: sum('day_landings') + sum('night_landings'),
  }

  const currentStudentName = canEdit ? students.find(s => s.id === studentId)?.full_name : profile?.full_name

  function openCreate() {
    setForm({ ...BLANK, instructor_id: isInstructor ? profile.id : '', student_id: !canEdit ? profile.id : studentId, date: new Date().toISOString().slice(0, 10) })
    setFormError('')
    setModal({ mode: 'create' })
  }

  function openEdit(entry) {
    if (!canEdit) return
    setForm({
      student_id: entry.student_id ?? '',
      instructor_id: entry.instructor_id ?? '',
      date: entry.date ?? '',
      aircraft_id: entry.aircraft_id ?? '',
      route: entry.route ?? '',
      total_time: entry.total_time ?? entry.duration_hours ?? '',
      dual_received: entry.dual_received ?? '',
      solo_time: entry.solo_time ?? '',
      pic_time: entry.pic_time ?? '',
      sic_time: entry.sic_time ?? '',
      cross_country_time: entry.cross_country_time ?? '',
      night_time: entry.night_time ?? '',
      actual_instrument: entry.actual_instrument ?? '',
      simulated_instrument: entry.simulated_instrument ?? '',
      approaches: entry.approaches ?? '',
      day_landings: entry.day_landings ?? '',
      night_landings: entry.night_landings ?? '',
      flight_conditions: entry.flight_conditions ?? 'VFR',
      remarks: entry.remarks ?? entry.notes ?? '',
    })
    setFormError('')
    setModal({ mode: 'edit', entry })
  }

  function closeModal() { setModal(null); setFormError('') }
  function field(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function numOrNull(v) { return v !== '' && v != null ? parseFloat(v) : null }
  function intOrNull(v) { return v !== '' && v != null ? parseInt(v) : null }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    const payload = {
      student_id: form.student_id || null,
      instructor_id: form.instructor_id || null,
      date: form.date,
      aircraft_id: form.aircraft_id || null,
      route: form.route || null,
      total_time: numOrNull(form.total_time),
      duration_hours: numOrNull(form.total_time), // keep legacy column in sync
      dual_received: numOrNull(form.dual_received),
      solo_time: numOrNull(form.solo_time),
      pic_time: numOrNull(form.pic_time),
      sic_time: numOrNull(form.sic_time),
      cross_country_time: numOrNull(form.cross_country_time),
      night_time: numOrNull(form.night_time),
      actual_instrument: numOrNull(form.actual_instrument),
      simulated_instrument: numOrNull(form.simulated_instrument),
      approaches: intOrNull(form.approaches),
      day_landings: intOrNull(form.day_landings),
      night_landings: intOrNull(form.night_landings),
      flight_conditions: form.flight_conditions || null,
      remarks: form.remarks || null,
      notes: form.remarks || null,
    }
    let error
    if (modal.mode === 'create') {
      ;({ error } = await supabase.from('logbook_entries').insert(payload))
    } else {
      ;({ error } = await supabase.from('logbook_entries').update(payload).eq('id', modal.entry.id))
    }
    setSaving(false)
    if (error) { setFormError(error.message); return }
    closeModal()
    loadEntries(canEdit ? studentId : profile.id)
  }

  async function handleDelete() {
    if (!window.confirm('Delete this entry?')) return
    await supabase.from('logbook_entries').delete().eq('id', modal.entry.id)
    closeModal()
    loadEntries(canEdit ? studentId : profile.id)
  }

  function acLabel(id) {
    if (!id) return '—'
    const ac = aircraft.find(a => a.id === id)
    return ac ? ac.tail_number : '—'
  }

  const showTable = !canEdit || studentId

  return (
    <Layout>
      <div className="page-header">
        <h2 className="page-title">Logbook</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {showTable && entries.length > 0 && (
            <button className="btn-secondary" onClick={() => exportCSV(entries, aircraft, currentStudentName)}>Export CSV</button>
          )}
          {canEdit && (
            <select className="select-input" value={studentId} onChange={e => setStudentId(e.target.value)}>
              <option value="">Select a student</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          )}
          {(showTable || !canEdit) && (
            <button className="btn-primary-sm" onClick={openCreate}>+ Log Flight</button>
          )}
        </div>
      </div>

      {showTable && (
        <div className="stat-grid logbook-totals">
          {[
            { label: 'Total Time', value: totals.total.toFixed(1) },
            { label: 'Dual Received', value: totals.dual.toFixed(1) },
            { label: 'Solo', value: totals.solo.toFixed(1) },
            { label: 'PIC', value: totals.pic.toFixed(1) },
            { label: 'Night', value: totals.night.toFixed(1) },
            { label: 'Cross-Country', value: totals.xc.toFixed(1) },
            { label: 'Instrument', value: totals.inst.toFixed(1) },
            { label: 'Landings', value: totals.landings },
          ].map(t => (
            <div key={t.label} className="stat-card stat-card--sm">
              <p className="stat-card__label">{t.label}</p>
              <p className="stat-card__value">{t.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? <p className="empty-state">Loading…</p> : (
        <div className="table-wrap">
          <table className="data-table logbook-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Aircraft</th>
                <th>Route</th>
                <th>Total</th>
                <th>Dual</th>
                <th>Solo</th>
                <th>Night</th>
                <th>X-C</th>
                <th>Inst</th>
                <th>Ldg</th>
                <th>Cond</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={canEdit ? 12 : 11} className="empty-state">No entries yet.</td></tr>
              ) : entries.map(e => {
                const total = e.total_time ?? e.duration_hours ?? 0
                const ldg = (e.day_landings ?? 0) + (e.night_landings ?? 0)
                const inst = (e.actual_instrument ?? 0) + (e.simulated_instrument ?? 0)
                const isExpanded = expandedEntry === e.id
                return [
                  <tr
                    key={e.id}
                    className="logbook-row"
                    onClick={() => setExpandedEntry(isExpanded ? null : e.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{new Date(e.date + 'T12:00:00').toLocaleDateString()}</td>
                    <td>{acLabel(e.aircraft_id)}</td>
                    <td>{e.route ?? '—'}</td>
                    <td style={{ fontWeight: 700 }}>{total ? Number(total).toFixed(1) : '—'}</td>
                    <td>{e.dual_received ? Number(e.dual_received).toFixed(1) : '—'}</td>
                    <td>{e.solo_time ? Number(e.solo_time).toFixed(1) : '—'}</td>
                    <td>{e.night_time ? Number(e.night_time).toFixed(1) : '—'}</td>
                    <td>{e.cross_country_time ? Number(e.cross_country_time).toFixed(1) : '—'}</td>
                    <td>{inst ? inst.toFixed(1) : '—'}</td>
                    <td>{ldg || '—'}</td>
                    <td>
                      {e.flight_conditions && (
                        <span className={`badge ${e.flight_conditions === 'IFR' ? 'badge--red' : 'badge--green'}`} style={{ fontSize: 10 }}>
                          {e.flight_conditions}
                        </span>
                      )}
                    </td>
                    {canEdit && <td onClick={ev => { ev.stopPropagation(); openEdit(e) }}><button className="btn-link">Edit</button></td>}
                  </tr>,
                  isExpanded && (
                    <tr key={`${e.id}-exp`} className="logbook-expanded">
                      <td colSpan={canEdit ? 12 : 11}>
                        <div className="logbook-detail">
                          <div className="logbook-detail__row">
                            <span><strong>PIC:</strong> {e.pic_time ? Number(e.pic_time).toFixed(1) : '—'}</span>
                            <span><strong>SIC:</strong> {e.sic_time ? Number(e.sic_time).toFixed(1) : '—'}</span>
                            <span><strong>Actual IMC:</strong> {e.actual_instrument ? Number(e.actual_instrument).toFixed(1) : '—'}</span>
                            <span><strong>Sim IMC:</strong> {e.simulated_instrument ? Number(e.simulated_instrument).toFixed(1) : '—'}</span>
                            <span><strong>Approaches:</strong> {e.approaches ?? '—'}</span>
                            <span><strong>Day Ldg:</strong> {e.day_landings ?? '—'}</span>
                            <span><strong>Night Ldg:</strong> {e.night_landings ?? '—'}</span>
                            <span><strong>Instructor:</strong> {e.instructor?.full_name ?? '—'}</span>
                          </div>
                          {(e.remarks || e.notes) && <p className="logbook-detail__remarks">"{e.remarks ?? e.notes}"</p>}
                        </div>
                      </td>
                    </tr>
                  )
                ]
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal.mode === 'create' ? 'Log Flight' : 'Edit Entry'} onClose={closeModal} wide>
          <form onSubmit={handleSave} className="modal-form">
            {formError && <div className="form-error">{formError}</div>}

            {canEdit && (
              <div className="form-row">
                <div className="form-group">
                  <label>Student</label>
                  <select value={form.student_id} onChange={e => field('student_id', e.target.value)} required>
                    <option value="">Select student</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Instructor</label>
                  <select value={form.instructor_id} onChange={e => field('instructor_id', e.target.value)} disabled={isInstructor}>
                    <option value="">Select instructor</option>
                    {instructors.map(i => <option key={i.id} value={i.id}>{i.full_name}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={form.date} onChange={e => field('date', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Aircraft</label>
                <select value={form.aircraft_id} onChange={e => field('aircraft_id', e.target.value)}>
                  <option value="">No aircraft</option>
                  {aircraft.map(a => <option key={a.id} value={a.id}>{a.tail_number}{a.make ? ` — ${a.make} ${a.model ?? ''}` : ''}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Route</label>
                <input type="text" placeholder="KHYI – KAUS" value={form.route} onChange={e => field('route', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Conditions</label>
                <select value={form.flight_conditions} onChange={e => field('flight_conditions', e.target.value)}>
                  <option value="VFR">VFR</option>
                  <option value="IFR">IFR</option>
                  <option value="SVFR">SVFR</option>
                </select>
              </div>
            </div>

            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', margin: '12px 0 8px' }}>Flight Time (hours)</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              <TimeInput label="Total Time *" value={form.total_time} onChange={v => field('total_time', v)} />
              <TimeInput label="Dual Received" value={form.dual_received} onChange={v => field('dual_received', v)} />
              <TimeInput label="Solo" value={form.solo_time} onChange={v => field('solo_time', v)} />
              <TimeInput label="PIC" value={form.pic_time} onChange={v => field('pic_time', v)} />
              <TimeInput label="SIC" value={form.sic_time} onChange={v => field('sic_time', v)} />
              <TimeInput label="Cross-Country" value={form.cross_country_time} onChange={v => field('cross_country_time', v)} />
              <TimeInput label="Night" value={form.night_time} onChange={v => field('night_time', v)} />
              <TimeInput label="Actual IMC" value={form.actual_instrument} onChange={v => field('actual_instrument', v)} />
              <TimeInput label="Sim IMC" value={form.simulated_instrument} onChange={v => field('simulated_instrument', v)} />
            </div>

            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', margin: '12px 0 8px' }}>Landings & Approaches</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <TimeInput label="Day Landings" value={form.day_landings} onChange={v => field('day_landings', v)} isInt />
              <TimeInput label="Night Landings" value={form.night_landings} onChange={v => field('night_landings', v)} isInt />
              <TimeInput label="Approaches" value={form.approaches} onChange={v => field('approaches', v)} isInt />
            </div>

            <div className="form-group" style={{ marginTop: 12 }}>
              <label>Remarks</label>
              <textarea value={form.remarks} onChange={e => field('remarks', e.target.value)} rows={2} placeholder="Maneuvers practiced, notes…" />
            </div>

            <div className="modal-form__actions">
              {modal.mode === 'edit' && isAdmin && (
                <button type="button" className="btn-danger" onClick={handleDelete}>Delete</button>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary-sm" disabled={saving}>{saving ? 'Saving…' : modal.mode === 'create' ? 'Log Flight' : 'Save Changes'}</button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  )
}
