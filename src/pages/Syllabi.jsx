import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import Modal from '../components/Modal'

const CATEGORIES = ['Private Pilot', 'Instrument Rating', 'Commercial Pilot', 'ATP', 'Flight Review', 'Discovery Flight', 'Other']

export default function Syllabi() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const canEdit = isAdmin

  const [syllabi, setSyllabi] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  // modal modes: 'syllabus-create' | 'syllabus-edit' | 'lessons' | 'enroll' | 'progress'
  const [form, setForm] = useState({ name: '', description: '', category: 'Private Pilot' })
  const [lessons, setLessons] = useState([]) // lesson list for current syllabus
  const [lessonForm, setLessonForm] = useState({ title: '', description: '', duration_hours: '' })
  const [enrollForm, setEnrollForm] = useState({ student_id: '', instructor_id: '' })
  const [instructors, setInstructors] = useState([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [progress, setProgress] = useState(null) // { enrollment, completions, lessons }

  async function load() {
    const { data } = await supabase
      .from('syllabi')
      .select('*, syllabus_lessons(id)')
      .order('category')
    setSyllabi(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    supabase.from('profiles').select('id, full_name').eq('role', 'student').order('full_name').then(({ data }) => setStudents(data ?? []))
    supabase.from('profiles').select('id, full_name').eq('role', 'instructor').order('full_name').then(({ data }) => setInstructors(data ?? []))
  }, [])

  function field(key, val) { setForm(f => ({ ...f, [key]: val })) }
  function closeModal() { setModal(null); setFormError(''); setProgress(null) }

  // ── Syllabus CRUD ──
  function openCreate() {
    setForm({ name: '', description: '', category: 'Private Pilot' })
    setFormError('')
    setModal({ mode: 'syllabus-create' })
  }

  function openEdit(syllabus) {
    setForm({ name: syllabus.name, description: syllabus.description ?? '', category: syllabus.category ?? 'Private Pilot' })
    setFormError('')
    setModal({ mode: 'syllabus-edit', syllabus })
  }

  async function handleSyllabusSave(e) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    const payload = { name: form.name, description: form.description || null, category: form.category }
    let error
    if (modal.mode === 'syllabus-create') {
      ;({ error } = await supabase.from('syllabi').insert(payload))
    } else {
      ;({ error } = await supabase.from('syllabi').update(payload).eq('id', modal.syllabus.id))
    }
    setSaving(false)
    if (error) { setFormError(error.message); return }
    closeModal()
    load()
  }

  async function handleDeleteSyllabus() {
    if (!window.confirm('Delete this syllabus and all its lessons?')) return
    await supabase.from('syllabi').delete().eq('id', modal.syllabus.id)
    closeModal()
    load()
  }

  // ── Lesson builder ──
  async function openLessons(syllabus) {
    const { data } = await supabase.from('syllabus_lessons').select('*').eq('syllabus_id', syllabus.id).order('sort_order')
    setLessons(data ?? [])
    setLessonForm({ title: '', description: '', duration_hours: '' })
    setFormError('')
    setModal({ mode: 'lessons', syllabus })
  }

  async function addLesson(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('syllabus_lessons').insert({
      syllabus_id: modal.syllabus.id,
      title: lessonForm.title,
      description: lessonForm.description || null,
      duration_hours: parseFloat(lessonForm.duration_hours) || null,
      sort_order: lessons.length,
    })
    setSaving(false)
    if (error) { setFormError(error.message); return }
    setLessonForm({ title: '', description: '', duration_hours: '' })
    const { data } = await supabase.from('syllabus_lessons').select('*').eq('syllabus_id', modal.syllabus.id).order('sort_order')
    setLessons(data ?? [])
    load()
  }

  async function deleteLesson(id) {
    await supabase.from('syllabus_lessons').delete().eq('id', id)
    setLessons(l => l.filter(x => x.id !== id))
    load()
  }

  // ── Enrollment ──
  async function openEnroll(syllabus) {
    setEnrollForm({ student_id: '', instructor_id: '' })
    setFormError('')
    setModal({ mode: 'enroll', syllabus })
  }

  async function handleEnroll(e) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    const { error } = await supabase.from('student_syllabi').insert({
      student_id: enrollForm.student_id,
      syllabus_id: modal.syllabus.id,
      instructor_id: enrollForm.instructor_id || null,
    })
    setSaving(false)
    if (error) { setFormError(error.message); return }
    closeModal()
  }

  // ── Progress view ──
  async function openProgress(syllabus) {
    const { data: enrollments } = await supabase
      .from('student_syllabi')
      .select('*, student:profiles!student_id(full_name), instructor:profiles!instructor_id(full_name)')
      .eq('syllabus_id', syllabus.id)
    const { data: syllabusLessons } = await supabase.from('syllabus_lessons').select('*').eq('syllabus_id', syllabus.id).order('sort_order')
    const { data: completions } = await supabase.from('lesson_completions').select('*').in('student_syllabus_id', (enrollments ?? []).map(e => e.id))
    setProgress({ enrollments: enrollments ?? [], lessons: syllabusLessons ?? [], completions: completions ?? [] })
    setModal({ mode: 'progress', syllabus })
  }

  async function toggleCompletion(enrollmentId, lessonId, isComplete) {
    if (isComplete) {
      await supabase.from('lesson_completions').delete()
        .eq('student_syllabus_id', enrollmentId).eq('syllabus_lesson_id', lessonId)
    } else {
      await supabase.from('lesson_completions').insert({ student_syllabus_id: enrollmentId, syllabus_lesson_id: lessonId })
    }
    // Refresh completions
    const { data } = await supabase.from('lesson_completions').select('*').in('student_syllabus_id', progress.enrollments.map(e => e.id))
    setProgress(p => ({ ...p, completions: data ?? [] }))
  }

  const grouped = syllabi.reduce((acc, s) => {
    const cat = s.category ?? 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {})

  return (
    <Layout>
      <div className="page-header">
        <h2 className="page-title">Syllabi</h2>
        {canEdit && <button className="btn-primary-sm" onClick={openCreate}>+ New Syllabus</button>}
      </div>

      {loading ? <p className="empty-state">Loading…</p> : syllabi.length === 0 ? (
        <p className="empty-state">No syllabi yet. Create one to get started.</p>
      ) : Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{cat}</h3>
          <div className="syllabus-grid">
            {items.map(s => (
              <div key={s.id} className="syllabus-card">
                <div className="syllabus-card__head">
                  <p className="syllabus-card__name">{s.name}</p>
                  <span className="badge">{s.syllabus_lessons?.length ?? 0} lessons</span>
                </div>
                {s.description && <p className="syllabus-card__desc">{s.description}</p>}
                <div className="syllabus-card__actions">
                  <button className="btn-link" onClick={() => openLessons(s)}>Lessons</button>
                  <button className="btn-link" onClick={() => openProgress(s)}>Progress</button>
                  {canEdit && <>
                    <button className="btn-link" onClick={() => openEnroll(s)}>Enroll</button>
                    <button className="btn-link" onClick={() => openEdit(s)}>Edit</button>
                  </>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Syllabus create/edit */}
      {(modal?.mode === 'syllabus-create' || modal?.mode === 'syllabus-edit') && (
        <Modal title={modal.mode === 'syllabus-create' ? 'New Syllabus' : 'Edit Syllabus'} onClose={closeModal}>
          <form onSubmit={handleSyllabusSave} className="modal-form">
            {formError && <div className="form-error">{formError}</div>}
            <div className="form-group">
              <label>Name</label>
              <input type="text" value={form.name} onChange={e => field('name', e.target.value)} required placeholder="e.g. Private Pilot Course" />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={e => field('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={form.description} onChange={e => field('description', e.target.value)} rows={3} placeholder="Optional overview…" />
            </div>
            <div className="modal-form__actions">
              {modal.mode === 'syllabus-edit' && (
                <button type="button" className="btn-danger" onClick={handleDeleteSyllabus}>Delete</button>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary-sm" disabled={saving}>{saving ? 'Saving…' : modal.mode === 'syllabus-create' ? 'Create' : 'Save'}</button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Lesson builder */}
      {modal?.mode === 'lessons' && (
        <Modal title={`Lessons — ${modal.syllabus.name}`} onClose={closeModal}>
          <div style={{ marginBottom: 16 }}>
            {lessons.length === 0
              ? <p className="empty-state" style={{ padding: '12px 0' }}>No lessons yet.</p>
              : lessons.map((l, i) => (
                <div key={l.id} className="activity-row">
                  <div>
                    <p className="activity-row__primary">{i + 1}. {l.title}</p>
                    {l.description && <p className="activity-row__sub">{l.description}</p>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {l.duration_hours && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{l.duration_hours}h</span>}
                    {canEdit && <button className="btn-link" style={{ color: '#f87171' }} onClick={() => deleteLesson(l.id)}>✕</button>}
                  </div>
                </div>
              ))
            }
          </div>
          {canEdit && (
            <form onSubmit={addLesson} className="modal-form" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              {formError && <div className="form-error">{formError}</div>}
              <div className="form-row">
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Lesson Title</label>
                  <input type="text" value={lessonForm.title} onChange={e => setLessonForm(f => ({ ...f, title: e.target.value }))} required placeholder="e.g. Pre-flight Inspection" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Description</label>
                  <input type="text" value={lessonForm.description} onChange={e => setLessonForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
                </div>
                <div className="form-group">
                  <label>Duration (hrs)</label>
                  <input type="number" step="0.1" min="0" value={lessonForm.duration_hours} onChange={e => setLessonForm(f => ({ ...f, duration_hours: e.target.value }))} placeholder="1.0" />
                </div>
              </div>
              <div className="modal-form__actions">
                <div style={{ marginLeft: 'auto' }}>
                  <button type="submit" className="btn-primary-sm" disabled={saving}>{saving ? 'Adding…' : '+ Add Lesson'}</button>
                </div>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* Enroll student */}
      {modal?.mode === 'enroll' && (
        <Modal title={`Enroll Student — ${modal.syllabus.name}`} onClose={closeModal}>
          <form onSubmit={handleEnroll} className="modal-form">
            {formError && <div className="form-error">{formError}</div>}
            <div className="form-group">
              <label>Student</label>
              <select value={enrollForm.student_id} onChange={e => setEnrollForm(f => ({ ...f, student_id: e.target.value }))} required>
                <option value="">Select student</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Instructor (optional)</label>
              <select value={enrollForm.instructor_id} onChange={e => setEnrollForm(f => ({ ...f, instructor_id: e.target.value }))}>
                <option value="">Select instructor</option>
                {instructors.map(i => <option key={i.id} value={i.id}>{i.full_name}</option>)}
              </select>
            </div>
            <div className="modal-form__actions">
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary-sm" disabled={saving}>{saving ? 'Enrolling…' : 'Enroll'}</button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Progress tracker */}
      {modal?.mode === 'progress' && progress && (
        <Modal title={`Progress — ${modal.syllabus.name}`} onClose={closeModal}>
          {progress.enrollments.length === 0
            ? <p className="empty-state">No students enrolled yet.</p>
            : progress.enrollments.map(enrollment => {
              const completedIds = new Set(
                progress.completions.filter(c => c.student_syllabus_id === enrollment.id).map(c => c.syllabus_lesson_id)
              )
              const pct = progress.lessons.length > 0 ? Math.round((completedIds.size / progress.lessons.length) * 100) : 0
              return (
                <div key={enrollment.id} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <p style={{ fontWeight: 600, color: 'var(--white)' }}>{enrollment.student?.full_name}</p>
                      {enrollment.instructor && <p style={{ fontSize: 12, color: 'var(--muted)' }}>Instructor: {enrollment.instructor.full_name}</p>}
                    </div>
                    <span className="badge badge--yellow">{pct}%</span>
                  </div>
                  <div className="progress-bar"><div className="progress-bar__fill" style={{ width: `${pct}%` }} /></div>
                  <div style={{ marginTop: 8 }}>
                    {progress.lessons.map((lesson, i) => {
                      const done = completedIds.has(lesson.id)
                      return (
                        <div key={lesson.id} className="activity-row">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button
                              onClick={() => canEdit && toggleCompletion(enrollment.id, lesson.id, done)}
                              style={{ background: done ? 'var(--gold)' : 'transparent', border: `2px solid ${done ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 4, width: 18, height: 18, cursor: canEdit ? 'pointer' : 'default', flexShrink: 0 }}
                            >{done ? '✓' : ''}</button>
                            <span style={{ fontSize: 13, color: done ? 'var(--muted)' : 'var(--text)', textDecoration: done ? 'line-through' : 'none' }}>
                              {i + 1}. {lesson.title}
                            </span>
                          </div>
                          {lesson.duration_hours && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{lesson.duration_hours}h</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          }
        </Modal>
      )}
    </Layout>
  )
}
