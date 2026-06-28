import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function Schedule() {
  const [lessons, setLessons] = useState([])
  const [current, setCurrent] = useState(new Date())

  const year = current.getFullYear()
  const month = current.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  useEffect(() => {
    const start = new Date(year, month, 1).toISOString()
    const end = new Date(year, month + 1, 0).toISOString()
    supabase
      .from('lessons')
      .select('*, student:profiles!student_id(full_name), instructor:profiles!instructor_id(full_name)')
      .gte('starts_at', start)
      .lte('starts_at', end)
      .then(({ data }) => setLessons(data ?? []))
  }, [year, month])

  function lessonsOnDay(day) {
    return lessons.filter(l => {
      const d = new Date(l.starts_at)
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year
    })
  }

  function prevMonth() { setCurrent(new Date(year, month - 1, 1)) }
  function nextMonth() { setCurrent(new Date(year, month + 1, 1)) }

  return (
    <Layout>
      <div className="page-header">
        <h2 className="page-title">Schedule</h2>
        <div className="cal-nav">
          <button className="cal-nav__btn" onClick={prevMonth}>‹</button>
          <span className="cal-nav__label">{MONTHS[month]} {year}</span>
          <button className="cal-nav__btn" onClick={nextMonth}>›</button>
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
              <div key={day} className={`calendar__cell${isToday ? ' calendar__cell--today' : ''}`}>
                <span className="calendar__cell-num">{day}</span>
                {dayLessons.map(l => (
                  <div key={l.id} className="cal-event">
                    <span>{new Date(l.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span>{l.student?.full_name}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </Layout>
  )
}
