import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'

// FAA Part 61 PPL minimums (§61.109)
const PPL_REQS = [
  { key: 'total',       label: 'Total Flight Time',       min: 40,  unit: 'hrs', field: 'total_time' },
  { key: 'dual',        label: 'Dual Received',           min: 20,  unit: 'hrs', field: 'dual_received' },
  { key: 'solo',        label: 'Solo Time',               min: 10,  unit: 'hrs', field: 'solo_time' },
  { key: 'xc',         label: 'Cross-Country (Training)', min: 3,   unit: 'hrs', field: 'cross_country_time' },
  { key: 'night',       label: 'Night Training',          min: 3,   unit: 'hrs', field: 'night_time' },
  { key: 'instrument',  label: 'Instrument (Simulated)',  min: 3,   unit: 'hrs', field: 'simulated_instrument' },
]

function ProgressBar({ value, min, color = '#F4B400' }) {
  const pct = Math.min((value / min) * 100, 100)
  const done = pct >= 100
  return (
    <div className="prog-bar-wrap">
      <div
        className="prog-bar-fill"
        style={{ width: `${pct}%`, background: done ? '#4ade80' : color }}
      />
    </div>
  )
}

export default function Progress() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const isInstructor = profile?.role === 'instructor'
  const canViewOthers = isAdmin || isInstructor

  const [students, setStudents] = useState([])
  const [selectedId, setSelectedId] = useState(canViewOthers ? '' : profile?.id)
  const [logbook, setLogbook] = useState([])
  const [endorsements, setEndorsements] = useState([])
  const [stageChecks, setStageChecks] = useState([])
  const [studentProfile, setStudentProfile] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (canViewOthers) {
      supabase.from('profiles').select('id, full_name').eq('role', 'student').order('full_name')
        .then(({ data }) => setStudents(data ?? []))
    } else {
      setSelectedId(profile.id)
    }
  }, [profile])

  useEffect(() => {
    if (!selectedId) return
    loadStudentData(selectedId)
  }, [selectedId])

  async function loadStudentData(sid) {
    setLoading(true)
    const [
      { data: entries },
      { data: endos },
      { data: checks },
      { data: prof },
    ] = await Promise.all([
      supabase.from('logbook_entries').select('*').eq('student_id', sid),
      supabase.from('endorsements').select('*').eq('student_id', sid),
      supabase.from('stage_checks').select('*').eq('student_id', sid),
      supabase.from('profiles').select('*').eq('id', sid).single(),
    ])
    setLogbook(entries ?? [])
    setEndorsements(endos ?? [])
    setStageChecks(checks ?? [])
    setStudentProfile(prof)
    setLoading(false)
  }

  // Sum a logbook field across all entries
  function sumField(field) {
    return logbook.reduce((s, e) => s + (e[field] ?? 0), 0)
  }

  const totals = {
    total_time:          sumField('total_time') || sumField('duration_hours'),
    dual_received:       sumField('dual_received'),
    solo_time:           sumField('solo_time'),
    cross_country_time:  sumField('cross_country_time'),
    night_time:          sumField('night_time'),
    actual_instrument:   sumField('actual_instrument'),
    simulated_instrument:sumField('simulated_instrument'),
    approaches:          sumField('approaches'),
    day_landings:        sumField('day_landings'),
    night_landings:      sumField('night_landings'),
  }

  const pplProgress = PPL_REQS.map(req => ({
    ...req,
    value: totals[req.field] ?? 0,
    done: (totals[req.field] ?? 0) >= req.min,
  }))

  const pplPct = Math.round((pplProgress.filter(r => r.done).length / PPL_REQS.length) * 100)

  const stagesPassed = stageChecks.filter(s => s.result === 'pass').length
  const keyEndorsements = endorsements.map(e => e.endorsement_type)
  const hasSoloEndorsement = keyEndorsements.some(t => t.toLowerCase().includes('solo'))
  const hasCheckrideEndorsement = keyEndorsements.some(t => t.toLowerCase().includes('checkride') || t.toLowerCase().includes('practical'))

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h2 className="page-title">Training Progress</h2>
          <p className="page-sub">FAA Part 61 requirements & milestones</p>
        </div>
      </div>

      {canViewOthers && (
        <div style={{ marginBottom: 24 }}>
          <select className="select-input" value={selectedId} onChange={e => setSelectedId(e.target.value)} style={{ maxWidth: 280 }}>
            <option value="">Select a student</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
      )}

      {!selectedId ? (
        <p className="empty-state">Select a student to view their progress.</p>
      ) : loading ? (
        <p className="empty-state">Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Summary cards */}
          <div className="stat-grid stat-grid--sm">
            <div className="stat-card">
              <p className="stat-card__label">Total Hours</p>
              <p className="stat-card__value">{totals.total_time.toFixed(1)}</p>
            </div>
            <div className="stat-card">
              <p className="stat-card__label">Solo Hours</p>
              <p className="stat-card__value">{totals.solo_time.toFixed(1)}</p>
            </div>
            <div className="stat-card">
              <p className="stat-card__label">Stage Checks Passed</p>
              <p className="stat-card__value">{stagesPassed}</p>
            </div>
            <div className="stat-card">
              <p className="stat-card__label">Endorsements</p>
              <p className="stat-card__value">{endorsements.length}</p>
            </div>
          </div>

          {/* PPL Requirements */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 className="report-section-title" style={{ margin: 0 }}>PPL Requirements (Part 61)</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 80, height: 6, background: 'var(--navy-3)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pplPct}%`, height: '100%', background: pplPct === 100 ? '#4ade80' : '#F4B400', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: pplPct === 100 ? '#4ade80' : 'var(--text)' }}>{pplPct}%</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {pplProgress.map(req => (
                <div key={req.key} className="prog-row">
                  <div className="prog-row__label">
                    <span>{req.label}</span>
                    {req.done && <span className="badge badge--green" style={{ fontSize: 10 }}>✓</span>}
                  </div>
                  <ProgressBar value={req.value} min={req.min} />
                  <div className="prog-row__nums">
                    <span style={{ color: req.done ? '#4ade80' : 'var(--text)', fontWeight: 700 }}>
                      {req.value.toFixed(1)}
                    </span>
                    <span style={{ color: 'var(--muted)' }}>/ {req.min} {req.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Landings & Approaches */}
          <div>
            <h3 className="report-section-title">Landings & Approaches</h3>
            <div className="stat-grid stat-grid--sm">
              <div className="stat-card">
                <p className="stat-card__label">Day Landings</p>
                <p className="stat-card__value">{totals.day_landings}</p>
              </div>
              <div className="stat-card">
                <p className="stat-card__label">Night Landings</p>
                <p className="stat-card__value">{totals.night_landings}</p>
              </div>
              <div className="stat-card">
                <p className="stat-card__label">Instrument Approaches</p>
                <p className="stat-card__value">{totals.approaches}</p>
              </div>
              <div className="stat-card">
                <p className="stat-card__label">Actual IMC</p>
                <p className="stat-card__value">{totals.actual_instrument.toFixed(1)}</p>
              </div>
            </div>
          </div>

          {/* Milestones */}
          <div>
            <h3 className="report-section-title">Key Milestones</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Solo Endorsement', done: hasSoloEndorsement },
                { label: 'Solo Flight Completed', done: totals.solo_time > 0 },
                { label: 'Cross-Country Solo (150+ nm)', done: keyEndorsements.some(t => t.toLowerCase().includes('cross')) },
                { label: 'Night Training Complete (3 hrs)', done: totals.night_time >= 3 },
                { label: 'Instrument Training Complete (3 hrs)', done: totals.simulated_instrument >= 3 },
                { label: 'Pre-Checkride Endorsement', done: hasCheckrideEndorsement },
                { label: 'Written Test Passed', done: stageChecks.some(s => s.stage_name?.toLowerCase().includes('written') || s.stage_name?.toLowerCase().includes('knowledge')) },
              ].map(m => (
                <div key={m.label} className="milestone-row">
                  <span className={`milestone-check${m.done ? ' milestone-check--done' : ''}`}>
                    {m.done ? '✓' : '○'}
                  </span>
                  <span style={{ color: m.done ? 'var(--text)' : 'var(--muted)', fontSize: 14 }}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stage Checks */}
          {stageChecks.length > 0 && (
            <div>
              <h3 className="report-section-title">Stage Check History</h3>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Stage</th><th>Date</th><th>Result</th><th>Notes</th></tr></thead>
                  <tbody>
                    {stageChecks.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600 }}>{s.stage_name}</td>
                        <td>{new Date(s.date).toLocaleDateString()}</td>
                        <td>
                          <span className={s.result === 'pass' ? 'badge badge--green' : s.result === 'fail' ? 'badge badge--red' : 'badge badge--yellow'}>
                            {s.result}
                          </span>
                        </td>
                        <td className="td-notes">{s.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}
    </Layout>
  )
}
