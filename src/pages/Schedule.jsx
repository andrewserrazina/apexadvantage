import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import Modal from '../components/Modal'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const LESSON_TYPES = ['Discovery Flight', 'Private Pilot Training', 'Instrument Training', 'Commercial Training', 'Flight Review', 'Check Ride Prep', 'Other']

const BLANK_FORM = { student_id: '', instructor_id: '', date: '', start_time: '', end_time: '', aircraft_id: '', lesson_type: 'Private Pilot Training' }

export default function Schedule() {
  const { profile } = useAuth()
  const [lessons, setLessons] = useState([])
  const [current, setCurrent] = useState(new Date())
  const [students, setStudents] = useState([])
  const [instructors, setInstructors] = useState([])
  const [modal, setModal] = useState(null) // null | { mode: 'create' | 'edit', lesson? }
  const [form, setForm] = useState(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const isAdmin = profile?.role === 'admin'
  const isInstructor = profile?.role === 'instructor'
  const canEdit = isAdmin || isInstructor

  const year = current.getFullYear()
  const month = current.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  async function loadLessons() {
    const start = new Date(year, month, 1).toISOString()
    const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
    let q = supabase
      .from('lessons')
      .select('*, student:profiles!student_id(full_name), instructor:profiles!instructor_id(full_name)')
      .gte('starts_at', start)
      .lte('starts_at', end)
    if (isInstructor) q = q.eq('instructor_id', profile.id)
    else if (!isAdmin) q = q.eq('student_id', profile.id)
    const { data } = await q
    setLessons(data ?? [])
  }

  useEffect(() => { loadLessons() }, [year, month, profile])

  useEffect(() => {
    if (!canEdit) return
    supabase.from('profiles').select('id, full_name').eq('role', 'student').order('full_name')
      .then(({ data }) => setStudents(data ?? []))
    supabase.from('profiles').select('id, full_name').eq('role', 'instructor').order('full_name')
      .then(({ data }) => setInstructors(data ?? []))
  }, [canEdit])

  function lessonsOnDay(day) {
    return lessons.filter(l => {
      const d = new Date(l.starts_at)
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year
    })
  }

  function prevMonth() { setCurrent(new Date(year, month - 1, 1)) }
  function nextMonth() { setCurrent(new Date(year, month + 1, 1)) }

  function openCreate(day) {
    if (!canEdit) return
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setForm({
      ...BLANK_FORM,
      date: dateStr,
      instructor_id: isInstructor ? profile.id : '',
    })
    setFormError('')
    setModal({ mode: 'create' })
  }

  function openEdit(lesson, e) {
    e.stopPropagation()
    if (!canEdit) return
    const start = new Date(lesson.starts_at)
    const end = new Date(lesson.ends_at)
    setForm({
      student_id: lesson.student_id ?? '',
      instructor_id: lesson.instructor_id ?? '',
      date: start.toISOString().slice(0, 10),
      start_time: start.toTimeString().slice(0, 5),
      end_time: end.toTimeString().slice(0, 5),
      aircraft_id: lesson.aircraft_id ?? '',
      lesson_type: lesson.lesson_type ?? 'Private Pilot Training',
    })
    setFormError('')
    setModal({ mode: 'edit', lesson })
  }

  function closeModal() { setModal(null); setFormError('') }

  function field(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function buildIso(date, time) {
    return new Date(`${date}T${time}:00`).toISOString()
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    const payload = {
      student_id: form.student_id || null,
      instructor_id: form.instructor_id || null,
      aircraft_id: form.aircraft_id || null,
      lesson_type: form.lesson_type || null,
      starts_at: buildIso(form.date, form.start_time),
      ends_at: buildIso(form.date, form.end_time),
    }
    let error
    if (modal.mode === 'create') {
      ;({ error } = await supabase.from('lessons').insert(payload))
    } else {
      ;({ error } = await supabase.from('lessons').update(payload).eq('id', modal.lesson.id))
    }
    setSaving(false)
    if (error) { setFormError(error.message); return }
    closeModal()
    loadLessons()
  }

  async function handleDelete() {
    if (!window.confirm('Delete this lesson?')) return
    await supabase.from('lessons').delete().eq('id', modal.lesson.id)
    closeModal()
    loadLessons()
  }

  return (
    <Layout>
      <div className="page-header">
        <h2 className="page-title">Schedule</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {canEdit && (
            <button className="btn-primary-sm" onClick={() => openCreate(new Date().getDate())}>+ Book Lesson</button>
          )}
          <div className="cal-nav">
            <button className="cal-nav__btn" onClick={prevMonth}>‹</button>
            <span className="cal-nav__label">{MONTHS[month]} {year}</span>
            <button className="cal-nav__btn" onClick={nextMonth}>›</button>
          </div>
        </div>
      </div>

      <div className="calendar">
        <div className="calendar__header">
          {DAYS.map(d => <div key={d} className="calendar__day-label">{d}</div>)}
        </div>
        <div className="calendar__grid">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} className="calendar__cell calendar__cell--empty" />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dayLessons = lessonsOnDay(day)
            const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year
            return (
              <div
                key={day}
                className={`calendar__cell${isToday ? ' calendar__cell--today' : ''}${canEdit ? ' calendar__cell--clickable' : ''}`}
                onClick={() => openCreate(day)}
              >
                <span className="calendar__cell-num">{day}</span>
                {dayLessons.map(l => (
                  <div key={l.id} className="cal-event" onClick={e => openEdit(l, e)}>
                    <span>{new Date(l.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span>{l.student?.full_name ?? '—'}</span>
                    {l.lesson_type && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>{l.lesson_type}</span>}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {modal && (
        <Modal title={modal.mode === 'create' ? 'Book Lesson' : 'Edit Lesson'} onClose={closeModal}>
          <form onSubmit={handleSave} className="modal-form">
            {formError && <div className="form-error">{formError}</div>}
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
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={form.date} onChange={e => field('date', e.target.value)} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Start Time</label>
                <input type="time" value={form.start_time} onChange={e => field('start_time', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>End Time</label>
                <input type="time" value={form.end_time} onChange={e => field('end_time', e.target.value)} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Aircraft</label>
                <input type="text" placeholder="e.g. N12345" value={form.aircraft_id} onChange={e => field('aircraft_id', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Lesson Type</label>
                <select value={form.lesson_type} onChange={e => field('lesson_type', e.target.value)}>
                  {LESSON_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-form__actions">
              {modal.mode === 'edit' && isAdmin && (
                <button type="button" className="btn-danger" onClick={handleDelete}>Delete</button>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary-sm" disabled={saving}>{saving ? 'Saving…' : modal.mode === 'create' ? 'Book Lesson' : 'Save Changes'}</button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  )
}
