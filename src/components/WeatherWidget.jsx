import { useEffect, useState } from 'react'

const AIRPORT = 'KHYI'

const CAT_STYLE = {
  VFR:  { color: '#4ade80', label: 'VFR' },
  MVFR: { color: '#60a5fa', label: 'MVFR' },
  IFR:  { color: '#f87171', label: 'IFR' },
  LIFR: { color: '#c084fc', label: 'LIFR' },
}

function windDir(deg) {
  if (deg == null) return '—'
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

function highestCeiling(clouds) {
  if (!clouds?.length) return null
  const broken = clouds.filter(c => ['BKN', 'OVC', 'OVX'].includes(c.cover))
  if (!broken.length) return null
  return Math.min(...broken.map(c => c.base))
}

export default function WeatherWidget({ compact = false }) {
  const [metar, setMetar] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastFetch, setLastFetch] = useState(null)

  async function fetchMetar() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `https://aviationweather.gov/api/data/metar?ids=${AIRPORT}&format=json&taf=false`,
        { headers: { Accept: 'application/json' } }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setMetar(data?.[0] ?? null)
      setLastFetch(new Date())
    } catch (err) {
      setError('Unable to fetch weather data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetar()
    const interval = setInterval(fetchMetar, 10 * 60 * 1000) // refresh every 10 min
    return () => clearInterval(interval)
  }, [])

  if (loading) return <div className="wx-widget wx-widget--loading">Fetching weather…</div>
  if (error || !metar) return (
    <div className="wx-widget wx-widget--error">
      {error ?? 'No METAR data available.'}
      <button className="btn-link" style={{ marginLeft: 8, fontSize: 12 }} onClick={fetchMetar}>Retry</button>
    </div>
  )

  const cat = CAT_STYLE[metar.fltcat] ?? CAT_STYLE.VFR
  const ceiling = highestCeiling(metar.clouds)

  if (compact) {
    return (
      <div className="wx-compact" onClick={fetchMetar} title="Click to refresh">
        <span className="wx-compact__cat" style={{ color: cat.color }}>{cat.label}</span>
        <span className="wx-compact__detail">{AIRPORT}</span>
        <span className="wx-compact__detail">{metar.visib ?? '—'}sm</span>
        {ceiling != null && <span className="wx-compact__detail">{ceiling}ft</span>}
        <span className="wx-compact__detail">{metar.wspd ?? 0}kt</span>
      </div>
    )
  }

  return (
    <div className="wx-widget">
      <div className="wx-widget__header">
        <div>
          <span className="wx-widget__airport">{AIRPORT}</span>
          <span className="wx-cat-badge" style={{ background: `${cat.color}20`, color: cat.color, borderColor: `${cat.color}50` }}>
            {cat.label}
          </span>
        </div>
        <button className="btn-link" style={{ fontSize: 11 }} onClick={fetchMetar}>↻ Refresh</button>
      </div>

      <div className="wx-grid">
        <div className="wx-cell">
          <p className="wx-cell__label">Wind</p>
          <p className="wx-cell__value">
            {metar.wdir != null ? `${windDir(metar.wdir)} ${metar.wdir}°` : 'Calm'}
            {metar.wspd ? ` @ ${metar.wspd}kt` : ''}
            {metar.wgst ? ` G${metar.wgst}` : ''}
          </p>
        </div>
        <div className="wx-cell">
          <p className="wx-cell__label">Visibility</p>
          <p className="wx-cell__value" style={{ color: (metar.visib ?? 10) < 3 ? '#f87171' : (metar.visib ?? 10) < 5 ? '#fbbf24' : 'var(--text)' }}>
            {metar.visib ?? '—'} sm
          </p>
        </div>
        <div className="wx-cell">
          <p className="wx-cell__label">Ceiling</p>
          <p className="wx-cell__value" style={{ color: ceiling == null ? 'var(--muted)' : ceiling < 500 ? '#c084fc' : ceiling < 1000 ? '#f87171' : ceiling < 3000 ? '#fbbf24' : 'var(--text)' }}>
            {ceiling != null ? `${ceiling} ft` : 'Clear'}
          </p>
        </div>
        <div className="wx-cell">
          <p className="wx-cell__label">Temp / Dew</p>
          <p className="wx-cell__value">{metar.temp ?? '—'}° / {metar.dewp ?? '—'}°C</p>
        </div>
        <div className="wx-cell">
          <p className="wx-cell__label">Altimeter</p>
          <p className="wx-cell__value">{metar.altim != null ? metar.altim.toFixed(2) + ' inHg' : '—'}</p>
        </div>
        {metar.wxString && (
          <div className="wx-cell">
            <p className="wx-cell__label">Weather</p>
            <p className="wx-cell__value">{metar.wxString}</p>
          </div>
        )}
      </div>

      <p className="wx-widget__raw">{metar.rawOb}</p>
      {lastFetch && (
        <p className="wx-widget__updated">Updated {lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
      )}
    </div>
  )
}
