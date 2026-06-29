import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import ApexLogo from '../components/ApexLogo'

const DURATIONS = [60, 90, 120, 150, 180]

const BLANK_SESSION = {
  title: '',
  description: '',
  location: '',
  scheduled_at: '',
  duration_minutes: 90,
  max_students: 20,
}

const BLANK_REG = { full_name: '', email: '' }

function fmt(dt) {
  return new Date(dt).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export default function GroundSchedule() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [sessions, setSessions] = useState([])
  const [pastSessions, setPastSessions] = useState([])
  const [showPast, setShowPast] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [modal, setModal] = useState(null) // 'create' | 'edit' | 'register' | 'registrants'
  const [form, setForm] = useState(BLANK_SESSION)
  const [regForm, setRegForm] = useState(BLANK_REG)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [regSuccess, setRegSuccess] = useState(false)
  const [registrants, setRegistrants] = useState([])
  const [activeSession, setActiveSession] = useState(null)

  async function load() {
    const now = new Date().toISOString()
    const [{ data: upcoming }, { data: past }] = await Promise.all([
      supabase.from('ground_sessions').select('*, ground_registrations(id)').gte('scheduled_at', now).order('scheduled_at'),
      supabase.from('ground_sessions').select('*, ground_registrations(id)').lt('scheduled_at', now).order('scheduled_at', { ascending: false }),
    ])
    setSessions(upcoming ?? [])
    setPastSessions(past ?? [])
    setLoading(false)
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.origin + '/ground-schedule')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => { load() }, [])

  function field(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function regField(k, v) { setRegForm(f => ({ ...f, [k]: v })) }

  function openCreate() {
    setForm(BLANK_SESSION)
    setFormError('')
    setModal('create')
  }

  function openEdit(s) {
    setActiveSession(s)
    setForm({
      title: s.title,
      description: s.description ?? '',
      location: s.location ?? '',
      scheduled_at: new Date(s.scheduled_at).toISOString().slice(0, 16),
      duration_minutes: s.duration_minutes,
      max_students: s.max_students,
    })
    setFormError('')
    setModal('edit')
  }

  function openRegister(s) {
    setActiveSession(s)
    setRegForm(BLANK_REG)
    setRegSuccess(false)
    setFormError('')
    setModal('register')
  }

  async function openRegistrants(s) {
    setActiveSession(s)
    const { data } = await supabase
      .from('ground_registrations')
      .select('*')
      .eq('session_id', s.id)
      .order('registered_at')
    setRegistrants(data ?? [])
    setModal('registrants')
  }

  function closeModal() { setModal(null); setActiveSession(null); setFormError('') }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    const { error } = await supabase.from('ground_sessions').insert({
      title: form.title,
      description: form.description || null,
      location: form.location || null,
      scheduled_at: form.scheduled_at,
      duration_minutes: parseInt(form.duration_minutes),
      max_students: parseInt(form.max_students),
    })
    setSaving(false)
    if (error) { setFormError(error.message); return }
    closeModal()
    load()
  }

  async function handleEdit(e) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    const { error } = await supabase.from('ground_sessions').update({
      title: form.title,
      description: form.description || null,
      location: form.location || null,
      scheduled_at: form.scheduled_at,
      duration_minutes: parseInt(form.duration_minutes),
      max_students: parseInt(form.max_students),
    }).eq('id', activeSession.id)
    setSaving(false)
    if (error) { setFormError(error.message); return }
    closeModal()
    load()
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this session?')) return
    await supabase.from('ground_sessions').delete().eq('id', id)
    load()
  }

  async function handleRegister(e) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    const { error } = await supabase.from('ground_registrations').insert({
      session_id: activeSession.id,
      full_name: regForm.full_name,
      email: regForm.email,
    })
    setSaving(false)
    if (error) {
      setFormError(error.message.includes('unique') ? 'This email is already registered for this session.' : error.message)
      return
    }
    setRegSuccess(true)
    load()
  }

  const spotsLeft = (s) => s.max_students - (s.ground_registrations?.length ?? 0)

  return (
    <div className="public-page">
      {/* Header */}
      <header className="public-header">
        <div className="public-header__inner">
          <Link to="/" className="public-header__brand">
            <ApexLogo size={30} />
            <div className="public-header__brand-text">
              <span className="public-header__name-apex">APEX</span>
              <span className="public-header__name-sub">— AVIATION —</span>
            </div>
          </Link>
          <div className="public-header__actions">
            <button className="btn-secondary" onClick={copyLink} style={{ minWidth: 110 }}>
              {copied ? '✓ Copied!' : '🔗 Share Link'}
            </button>
            {profile ? (
              <Link to="/dashboard" className="btn-secondary">Back to App</Link>
            ) : (
              <Link to="/login" className="btn-secondary">Sign In</Link>
            )}
            {isAdmin && (
              <button className="btn-primary-sm" onClick={openCreate}>+ Add Session</button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="public-hero">
        <p className="public-hero__eyebrow">Something Extraordinary</p>
        <h1 className="public-hero__title">IS TAKING<br /><em>FLIGHT.</em></h1>
        <div className="public-hero__divider" />
        <p className="public-hero__sub">
          Professional ground school for Private Pilot, Instrument Rating, and Commercial certificates.
          Austin, Texas · $25 per session · Pay at the door.
        </p>
      </div>

      {/* Sessions */}
      <div className="public-content">
        {loading ? (
          <p className="empty-state">Loading sessions…</p>
        ) : sessions.length === 0 && !showPast ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p className="empty-state" style={{ marginBottom: 16 }}>No upcoming sessions scheduled. Check back soon!</p>
            {pastSessions.length > 0 && (
              <button className="btn-secondary" onClick={() => setShowPast(true)}>View Past Sessions</button>
            )}
          </div>
        ) : (
          <>
          <div className="gs-grid">
            {sessions.map(s => {
              const spots = spotsLeft(s)
              const full = spots <= 0
              return (
                <div key={s.id} className={`gs-card${full ? ' gs-card--full' : ''}`}>
                  <div className="gs-card__head">
                    <div>
                      <h3 className="gs-card__title">{s.title}</h3>
                      <p className="gs-card__time">{fmt(s.scheduled_at)}</p>
                    </div>
                    <div className="gs-card__badge">{full ? 'Full' : `${spots} spot${spots !== 1 ? 's' : ''} left`}</div>
                  </div>
                  {s.description && <p className="gs-card__desc">{s.description}</p>}
                  <div className="gs-card__meta">
                    {s.location && <span>📍 {s.location}</span>}
                    <span>⏱ {s.duration_minutes} min</span>
                    <span>💵 $25</span>
                  </div>
                  <div className="gs-card__actions">
                    {isAdmin ? (
                      <>
                        <button className="btn-link" onClick={() => openRegistrants(s)}>
                          {s.ground_registrations?.length ?? 0} registered
                        </button>
                        <button className="btn-link" onClick={() => openEdit(s)}>Edit</button>
                        <button className="btn-link" style={{ color: '#f87171' }} onClick={() => handleDelete(s.id)}>Delete</button>
                      </>
                    ) : (
                      <button
                        className="btn-primary-sm"
                        disabled={full}
                        onClick={() => openRegister(s)}
                      >
                        {full ? 'Class Full' : 'Sign Up'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Past sessions */}
          {pastSessions.length > 0 && (
            <div style={{ marginTop: 48 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--muted)' }}>Past Sessions</h2>
                <button className="btn-secondary" onClick={() => setShowPast(p => !p)}>
                  {showPast ? 'Hide Past' : 'Show Past'}
                </button>
              </div>
              {showPast && (
                <div className="gs-grid">
                  {pastSessions.map(s => (
                    <div key={s.id} className="gs-card gs-card--full">
                      <div className="gs-card__head">
                        <div>
                          <h3 className="gs-card__title">{s.title}</h3>
                          <p className="gs-card__time">{fmt(s.scheduled_at)}</p>
                        </div>
                        <div className="gs-card__badge">{s.ground_registrations?.length ?? 0} attended</div>
                      </div>
                      {s.description && <p className="gs-card__desc">{s.description}</p>}
                      <div className="gs-card__meta">
                        {s.location && <span>📍 {s.location}</span>}
                        <span>⏱ {s.duration_minutes} min</span>
                      </div>
                      {isAdmin && (
                        <div className="gs-card__actions">
                          <button className="btn-link" onClick={() => openRegistrants(s)}>{s.ground_registrations?.length ?? 0} registered</button>
                          <button className="btn-link" style={{ color: '#f87171' }} onClick={() => handleDelete(s.id)}>Delete</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          </>
        )}
      </div>

      {/* Create/Edit Session Modal */}
      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? 'Add Ground Session' : 'Edit Session'} onClose={closeModal}>
          <form onSubmit={modal === 'create' ? handleCreate : handleEdit} className="modal-form">
            {formError && <div className="form-error">{formError}</div>}
            <div className="form-group">
              <label>Session Title</label>
              <input type="text" value={form.title} onChange={e => field('title', e.target.value)} required placeholder="e.g. Private Pilot – Aerodynamics" />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={form.description} onChange={e => field('description', e.target.value)} rows={2} placeholder="Optional brief description" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Date & Time</label>
                <input type="datetime-local" value={form.scheduled_at} onChange={e => field('scheduled_at', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Duration</label>
                <select value={form.duration_minutes} onChange={e => field('duration_minutes', e.target.value)}>
                  {DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Location</label>
                <input type="text" value={form.location} onChange={e => field('location', e.target.value)} placeholder="e.g. Room 101 / Zoom" />
              </div>
              <div className="form-group">
                <label>Max Students</label>
                <input type="number" value={form.max_students} onChange={e => field('max_students', e.target.value)} min={1} max={100} required />
              </div>
            </div>
            <div className="modal-form__actions">
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary-sm" disabled={saving}>
                  {saving ? 'Saving…' : modal === 'create' ? 'Create Session' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Register Modal */}
      {modal === 'register' && (
        <Modal title={`Sign Up — ${activeSession?.title}`} onClose={closeModal}>
          {regSuccess ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <h3 style={{ color: 'var(--gold)', marginBottom: 8 }}>You're registered!</h3>
              <p style={{ color: 'var(--muted)', marginBottom: 4 }}>{fmt(activeSession.scheduled_at)}</p>
              {activeSession.location && <p style={{ color: 'var(--muted)', marginBottom: 16 }}>{activeSession.location}</p>}
              <p style={{ color: 'var(--text)', marginBottom: 24 }}>
                Please bring <strong style={{ color: 'var(--gold)' }}>$25 cash or card</strong> to the session.
              </p>
              <button className="btn-primary-sm" onClick={closeModal}>Done</button>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="modal-form">
              {formError && <div className="form-error">{formError}</div>}
              <p style={{ color: 'var(--muted)', marginBottom: 16, fontSize: 14 }}>
                {fmt(activeSession.scheduled_at)}{activeSession.location ? ` · ${activeSession.location}` : ''}
              </p>
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" value={regForm.full_name} onChange={e => regField('full_name', e.target.value)} required placeholder="Jane Smith" />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" value={regForm.email} onChange={e => regField('email', e.target.value)} required placeholder="jane@example.com" />
              </div>
              <div style={{ background: 'var(--navy-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                <p style={{ color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>💵 $25 due at the door</p>
                <p style={{ color: 'var(--muted)', fontSize: 13 }}>Payment is collected in-person. Cash or card accepted.</p>
              </div>
              <div className="modal-form__actions">
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn-primary-sm" disabled={saving}>{saving ? 'Registering…' : 'Register'}</button>
                </div>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* Registrants Modal */}
      {modal === 'registrants' && (
        <Modal title={`Registrants — ${activeSession?.title}`} onClose={closeModal}>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>{fmt(activeSession.scheduled_at)}</p>
          {registrants.length === 0 ? (
            <p className="empty-state">No registrations yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Name</th><th>Email</th><th>Registered</th></tr></thead>
                <tbody>
                  {registrants.map(r => (
                    <tr key={r.id}>
                      <td><strong>{r.full_name}</strong></td>
                      <td>{r.email}</td>
                      <td style={{ color: 'var(--muted)', fontSize: 13 }}>{new Date(r.registered_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="modal-form__actions" style={{ marginTop: 16 }}>
            <div style={{ marginLeft: 'auto' }}>
              <button className="btn-secondary" onClick={closeModal}>Close</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
