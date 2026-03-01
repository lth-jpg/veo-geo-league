'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trophy, Flag, MessageSquare, Zap, ChevronDown, Search,
  Send, Archive, RefreshCw, Star, X, Plus, Check,
  TrendingUp, Users, Calendar, Shield, AlertTriangle,
  ArrowUp, ArrowDown, Pencil, Award, BarChart2,
} from 'lucide-react'

type Player = { id: number; name: string; countryFlag: string }
type Standing = {
  id: number; name: string; countryFlag: string
  monthlyAverage: number; top15Sum: number
  gamesPlayed: number; bestScore: number
  redCardCount: number; isMvp: boolean
  formStreak: 'hot' | 'cold' | null
}
type RedCardEntry = { id: number; givenBy: Player; reason?: string | null }
type Score = {
  id: number; playerId: number; round1: number; round2: number; round3: number
  total: number; date: string; isDoubleDay: boolean
  positionChange?: number | null
  player: Player
  redCards: RedCardEntry[]
  comments: Comment[]
  _count: { redCards: number }
}
type LeagueConfig = {
  effectiveDate: string
  isDoubleDay: boolean
  activeDays: string[]
  scoreCount: number
  daysRemaining: number | null
  totalActiveDays: number
}
type Comment = { id: number; scoreId: number; authorName: string; text: string; createdAt: string }
type ChatMessage = { id: number; authorName: string; text: string; createdAt: string; player?: Player }
type ArchiveMonth = { year: number; month: number; label: string }
type BreakingNewsItem = {
  id: number; type: string; message: string
  playerId: number; player: Player
  expiresAt: string; createdAt: string
}
type MonthlyWinEntry = {
  id: number; name: string; countryFlag: string; winCount: number
  months: { year: number; month: number; avgScore: number; label: string }[]
}
type TitleRacePlayer = {
  id: number; name: string; countryFlag: string; averages: (number | null)[]
}
type TitleRaceData = {
  days: string[]; players: TitleRacePlayer[]; scoreCount: number
}

// ─── BREAKING NEWS BANNER ───
function BreakingNewsBanner({
  items, onDismiss,
}: {
  items: BreakingNewsItem[]
  onDismiss: (id: number) => void
}) {
  if (items.length === 0) return null
  const latest = items[0]
  const isTakeover = latest.type === 'takeover'
  const neonColor = isTakeover ? '#30FF51' : '#FF3030'

  return (
    <div
      className="relative overflow-hidden z-50"
      style={{ background: '#000', borderBottom: `2px solid ${neonColor}` }}
    >
      {/* Glow line */}
      <div style={{ height: 2, background: neonColor, boxShadow: `0 0 12px 4px ${neonColor}`, opacity: 0.8 }} />
      <div className="flex items-center h-9">
        {/* BREAKING label */}
        <div
          className="flex-shrink-0 px-3 h-full flex items-center font-display font-900 text-sm tracking-widest"
          style={{ background: neonColor, color: '#000' }}
        >
          {isTakeover ? '👑 BREAKING' : '🤡 SHAME'}
        </div>

        {/* Scrolling ticker */}
        <div className="flex-1 overflow-hidden relative">
          <motion.div
            className="flex items-center gap-16 whitespace-nowrap"
            style={{ color: neonColor, fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          >
            {/* Duplicate for seamless loop */}
            {[0, 1].map(k => (
              <span key={k} className="pl-8">
                {latest.message}
                {items.length > 1 && items.slice(1).map(n => (
                  <span key={n.id} className="ml-16 opacity-70">{n.message}</span>
                ))}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Dismiss */}
        <button
          onClick={() => onDismiss(latest.id)}
          className="flex-shrink-0 px-3 h-full flex items-center text-xs font-mono transition-opacity hover:opacity-70"
          style={{ color: neonColor }}
        >
          <X size={14} />
        </button>
      </div>
      <div style={{ height: 2, background: neonColor, boxShadow: `0 0 12px 4px ${neonColor}`, opacity: 0.4 }} />
    </div>
  )
}

// ─── FORM BADGE ───
function FormBadge({ streak }: { streak: 'hot' | 'cold' | null }) {
  if (!streak) return null
  if (streak === 'hot') {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded border border-orange-400/40 text-orange-400 bg-orange-400/10">
        🔥 ON FIRE
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded border border-blue-400/40 text-blue-400 bg-blue-400/10">
      ❄️ IN THE MUD
    </span>
  )
}

// ─── POSITION CHANGE BADGE ───
function PositionChangeBadge({ change }: { change: number | null | undefined }) {
  if (change == null || change === 0) return null
  const up = change > 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
        up ? 'text-veo-green bg-veo-green/10 border border-veo-green/30' : 'text-veo-red bg-veo-red/10 border border-veo-red/30'
      }`}
    >
      {up ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
      {up ? '+' : ''}{change}
    </span>
  )
}

// ─── SCORE TAG (CLUTCH / SNIPER) ───
function ScoreTag({ total }: { total: number }) {
  if (total < 14800) return null
  const tag = total >= 15000 ? 'PERFECT' : total >= 14950 ? 'SNIPER' : 'CLUTCH'
  return (
    <span className="inline-flex items-center font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border border-veo-green/50 text-veo-green bg-veo-green/10 tracking-wider">
      {tag}
    </span>
  )
}

// ─── TITLE RACE CHART (pure SVG, no dependencies) ───
const CHART_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#a3e635',
]

function TitleRaceChart({ data }: { data: TitleRaceData }) {
  const { days, players } = data
  const W = 800, H = 320
  const PAD = { top: 20, right: 16, bottom: 48, left: 62 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  // Y axis: 0 to max average (rounded up to nearest 1000)
  const allVals = players.flatMap(p => p.averages.filter((v): v is number => v !== null))
  const maxVal = allVals.length > 0 ? Math.max(...allVals) : 15000
  const yMax = Math.ceil(maxVal / 1000) * 1000 || 15000

  const xOf = (dayIdx: number) => days.length === 1 ? PAD.left + chartW / 2 : PAD.left + (dayIdx / (days.length - 1)) * chartW
  const yOf = (val: number) => PAD.top + chartH - (val / yMax) * chartH

  // Y grid lines every 2000
  const yGridStep = yMax <= 6000 ? 1000 : 2000
  const yGridLines: number[] = []
  for (let v = 0; v <= yMax; v += yGridStep) yGridLines.push(v)

  // Format day labels as "Feb 3"
  const fmtDay = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="w-full overflow-x-auto">
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3">
        {players.map((p, i) => {
          const lastVal = p.averages.findLast(v => v !== null)
          return (
            <div key={p.id} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}/>
              <span className="font-mono text-[11px] text-veo-text">{p.countryFlag} {p.name}</span>
              {lastVal != null && <span className="font-mono text-[10px] text-veo-dim">({lastVal.toFixed(0)})</span>}
            </div>
          )
        })}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: Math.max(320, days.length * 40) }}>
        {/* Grid lines */}
        {yGridLines.map(v => (
          <g key={v}>
            <line x1={PAD.left} x2={PAD.left + chartW} y1={yOf(v)} y2={yOf(v)} stroke="#2a2a2a" strokeWidth={1}/>
            <text x={PAD.left - 6} y={yOf(v) + 4} textAnchor="end" fontSize={10} fill="#666" fontFamily="monospace">
              {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
            </text>
          </g>
        ))}

        {/* X axis day labels */}
        {days.map((day, i) => (
          <text key={day} x={xOf(i)} y={H - 4} textAnchor="middle" fontSize={10} fill="#666" fontFamily="monospace">
            {fmtDay(day)}
          </text>
        ))}

        {/* Player lines */}
        {players.map((p, pi) => {
          const color = CHART_COLORS[pi % CHART_COLORS.length]
          // Build polyline points, skipping nulls
          const segments: { x: number; y: number }[][] = []
          let current: { x: number; y: number }[] = []
          for (let i = 0; i < days.length; i++) {
            const v = p.averages[i]
            if (v !== null) {
              current.push({ x: xOf(i), y: yOf(v) })
            } else {
              if (current.length > 0) { segments.push(current); current = [] }
            }
          }
          if (current.length > 0) segments.push(current)

          return (
            <g key={p.id}>
              {segments.map((seg, si) => (
                <polyline
                  key={si}
                  points={seg.map(pt => `${pt.x},${pt.y}`).join(' ')}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
              {/* Dots at each data point */}
              {days.map((_, i) => {
                const v = p.averages[i]
                if (v === null) return null
                return <circle key={i} cx={xOf(i)} cy={yOf(v)} r={4} fill={color} stroke="#111" strokeWidth={1.5}/>
              })}
            </g>
          )
        })}

        {/* Axes */}
        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + chartH} stroke="#444" strokeWidth={1}/>
        <line x1={PAD.left} x2={PAD.left + chartW} y1={PAD.top + chartH} y2={PAD.top + chartH} stroke="#444" strokeWidth={1}/>
      </svg>
    </div>
  )
}

export default function VeoGeoApp() {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'submit' | 'archive' | 'history' | 'wins' | 'titlerace'>('leaderboard')
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [standings, setStandings] = useState<Standing[]>([])
  const [todayScores, setTodayScores] = useState<Score[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [archiveMonths, setArchiveMonths] = useState<ArchiveMonth[]>([])
  const [archiveStandings, setArchiveStandings] = useState<Standing[]>([])
  const [selectedArchive, setSelectedArchive] = useState<ArchiveMonth | null>(null)
  const [redCardStatus, setRedCardStatus] = useState<{ usedToday: boolean; card?: unknown }>({ usedToday: false })
  const [expandedScore, setExpandedScore] = useState<number | null>(null)
  const [commentText, setCommentText] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [notification, setNotification] = useState<{ msg: string; type: 'green' | 'red' } | null>(null)
  const [redCardModal, setRedCardModal] = useState<{ score: Score } | null>(null)
  const [redCardReason, setRedCardReason] = useState('')
  const [onboardMode, setOnboardMode] = useState<'select' | 'new'>('select')
  const [newName, setNewName] = useState('')
  const [newFlag, setNewFlag] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [r1, setR1] = useState('')
  const [r2, setR2] = useState('')
  const [r3, setR3] = useState('')
  const [breakingNews, setBreakingNews] = useState<BreakingNewsItem[]>([])
  const [dismissedNews, setDismissedNews] = useState<Set<number>>(new Set())
  const chatEndRef = useRef<HTMLDivElement>(null)

  // ── Pin gate for Leo ──────────────────────────────────────────────────────
  const [pinModal, setPinModal] = useState<{ player: Player } | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)

  // ── Edit profile modal ────────────────────────────────────────────────────
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editFlag, setEditFlag] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // ── League config (public) ────────────────────────────────────────────────
  const [leagueConfig, setLeagueConfig] = useState<LeagueConfig>({ effectiveDate: '', isDoubleDay: false, activeDays: [], scoreCount: 15, daysRemaining: null, totalActiveDays: 0 })

  // ── History tab ───────────────────────────────────────────────────────────
  const [historyScores, setHistoryScores] = useState<Score[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)

  // ── Wins / Hall of Fame tab ───────────────────────────────────────────────
  const [monthlyWins, setMonthlyWins] = useState<MonthlyWinEntry[]>([])
  const [winsLoaded, setWinsLoaded] = useState(false)

  // ── Title Race tab ────────────────────────────────────────────────────────
  const [titleRace, setTitleRace] = useState<TitleRaceData | null>(null)
  const [titleRaceLoaded, setTitleRaceLoaded] = useState(false)

  // ── Admin Slack panel ─────────────────────────────────────────────────────
  const [adminSection, setAdminSection] = useState<'players' | 'morning' | 'summary' | 'config'>('players')
  const [slackPreview, setSlackPreview] = useState<{ morning: string[] | null; summary: string[] | null }>({ morning: null, summary: null })
  const [slackLoading, setSlackLoading] = useState<{ morning: boolean; summary: boolean }>({ morning: false, summary: false })
  const [slackSending, setSlackSending] = useState<{ morning: boolean; summary: boolean }>({ morning: false, summary: false })
  const [slackNote, setSlackNote] = useState<{ morning: string; summary: string }>({ morning: '', summary: '' })
  const [doublePointsToggle, setDoublePointsToggle] = useState(false)

  // ── Admin config panel ────────────────────────────────────────────────────
  const [adminConfig, setAdminConfig] = useState<{ activeDays: string[]; scoreCount: number; doubleDayDate: string | null }>({ activeDays: [], scoreCount: 15, doubleDayDate: null })
  const [configSaving, setConfigSaving] = useState(false)
  const [simulatedDate, setSimulatedDate] = useState<string>('')
  const [simDateSaving, setSimDateSaving] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  // Load dismissed news IDs + remembered player from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('dismissedNews')
      if (stored) setDismissedNews(new Set(JSON.parse(stored) as number[]))
    } catch { /* ignore */ }
  }, [])

  // Once players load, auto-restore the remembered player
  useEffect(() => {
    if (players.length === 0 || currentPlayer) return
    try {
      const savedId = localStorage.getItem('currentPlayerId')
      if (!savedId) return
      const found = players.find(p => p.id === parseInt(savedId))
      if (found) setCurrentPlayer(found)
    } catch { /* ignore */ }
  }, [players, currentPlayer])

  const notify = (msg: string, type: 'green' | 'red' = 'green') => {
    setNotification({ msg, type })
    setTimeout(() => setNotification(null), 3500)
  }

  const fetchPlayers = useCallback(async () => {
    try {
      const res = await fetch('/api/players')
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) setPlayers(data)
    } catch { /* ignore */ }
  }, [])

  const fetchLeaderboard = useCallback(async (year?: number, month?: number) => {
    try {
      const params = year !== undefined ? `?year=${year}&month=${month}` : ''
      const res = await fetch(`/api/leaderboard${params}`)
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data.standings)) {
        if (year !== undefined) setArchiveStandings(data.standings)
        else setStandings(data.standings)
      }
    } catch { /* ignore */ }
  }, [])

  const fetchTodayScores = useCallback(async () => {
    try {
      const res = await fetch('/api/scores')
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) setTodayScores(data)
    } catch { /* ignore */ }
  }, [])

  const fetchChat = useCallback(async () => {
    try {
      const res = await fetch('/api/chat')
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) setChatMessages(data)
    } catch { /* ignore */ }
  }, [])

  const fetchArchive = useCallback(async () => {
    try {
      const res = await fetch('/api/archive')
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) setArchiveMonths(data)
    } catch { /* ignore */ }
  }, [])

  const fetchRedCardStatus = useCallback(async () => {
    if (!currentPlayer) return
    const res = await fetch(`/api/redcards?givenById=${currentPlayer.id}`)
    setRedCardStatus(await res.json())
  }, [currentPlayer])

  const fetchBreakingNews = useCallback(async () => {
    try {
      const res = await fetch('/api/breaking-news')
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) setBreakingNews(data)
    } catch { /* ignore */ }
  }, [])

  const fetchLeagueConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config')
      if (!res.ok) return
      const data = await res.json()
      setLeagueConfig(data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchPlayers(); fetchLeaderboard(); fetchTodayScores(); fetchChat(); fetchArchive(); fetchBreakingNews(); fetchLeagueConfig()
  }, [fetchPlayers, fetchLeaderboard, fetchTodayScores, fetchChat, fetchArchive, fetchBreakingNews, fetchLeagueConfig])

  useEffect(() => {
    if (currentPlayer) fetchRedCardStatus()
  }, [currentPlayer, fetchRedCardStatus])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  useEffect(() => {
    const interval = setInterval(() => {
      fetchLeaderboard(); fetchTodayScores(); fetchChat(); fetchBreakingNews(); fetchLeagueConfig()
      if (currentPlayer) fetchRedCardStatus()
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchLeaderboard, fetchTodayScores, fetchChat, fetchBreakingNews, fetchRedCardStatus, fetchLeagueConfig, currentPlayer])

  const dismissNews = (id: number) => {
    const arr = Array.from(dismissedNews)
    arr.push(id)
    const updated = new Set(arr)
    setDismissedNews(updated)
    try { localStorage.setItem('dismissedNews', JSON.stringify(arr)) } catch { /* ignore */ }
  }

  const activeNews = breakingNews.filter(n => !dismissedNews.has(n.id))

  const selectPlayer = (p: Player) => {
    setCurrentPlayer(p)
    try { localStorage.setItem('currentPlayerId', String(p.id)) } catch { /* ignore */ }
    notify(`Welcome back, ${p.countryFlag} ${p.name}!`)
  }

  const handlePlayerClick = (p: Player) => {
    if (p.name.toLowerCase() === 'leo') {
      setPinModal({ player: p })
      setPinInput('')
      setPinError(false)
    } else {
      selectPlayer(p)
    }
  }

  const submitPin = () => {
    if (pinInput === '0874' && pinModal) {
      selectPlayer(pinModal.player)
      setPinModal(null)
      setPinInput('')
      setPinError(false)
    } else {
      setPinError(true)
      setPinInput('')
    }
  }

  const fetchHistoryScores = useCallback(async () => {
    try {
      const res = await fetch('/api/scores?month=true')
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) { setHistoryScores(data); setHistoryLoaded(true) }
    } catch { /* ignore */ }
  }, [])

  const fetchMonthlyWins = useCallback(async () => {
    try {
      const res = await fetch('/api/monthly-wins')
      if (!res.ok) return
      const data = await res.json()
      if (data.wins) { setMonthlyWins(data.wins); setWinsLoaded(true) }
    } catch { /* ignore */ }
  }, [])

  const fetchTitleRace = useCallback(async () => {
    try {
      const res = await fetch('/api/title-race')
      if (!res.ok) return
      const data = await res.json()
      setTitleRace(data); setTitleRaceLoaded(true)
    } catch { /* ignore */ }
  }, [])

  const fetchAdminConfig = useCallback(async () => {
    if (!currentPlayer) return
    try {
      const res = await fetch(`/api/admin/config?adminName=${encodeURIComponent(currentPlayer.name)}`)
      if (!res.ok) return
      const data = await res.json()
      setAdminConfig({ activeDays: data.activeDays ?? [], scoreCount: data.scoreCount ?? 15, doubleDayDate: data.doubleDayDate ?? null })
      setSimulatedDate(data.simulatedDate ?? '')
    } catch { /* ignore */ }
  }, [currentPlayer])

  const saveAdminConfig = async () => {
    if (!currentPlayer) return
    setConfigSaving(true)
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminName: currentPlayer.name, activeDays: adminConfig.activeDays, scoreCount: adminConfig.scoreCount }),
      })
      if (res.ok) {
        notify('League config saved!')
        await fetchLeagueConfig()
      } else {
        notify('Failed to save config', 'red')
      }
    } catch { notify('Failed to save config', 'red') } finally {
      setConfigSaving(false)
    }
  }

  const saveSimulatedDate = async (dateValue: string | null) => {
    if (!currentPlayer) return
    setSimDateSaving(true)
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminName: currentPlayer.name, simulatedDate: dateValue ?? null }),
      })
      if (res.ok) {
        setSimulatedDate(dateValue || '')
        notify(dateValue ? `Simulated date set to ${dateValue}` : 'Simulated date cleared')
        await Promise.all([fetchAdminConfig(), fetchLeagueConfig()])
      } else {
        let msg = 'Failed to update simulated date'
        try { const err = await res.json(); if (err?.error) msg = err.error } catch { /* ignore */ }
        notify(msg, 'red')
      }
    } catch (e) { notify(`Error: ${e}`, 'red') } finally {
      setSimDateSaving(false)
    }
  }

  const fetchSlackPreview = async (type: 'morning' | 'summary') => {
    if (!currentPlayer) return
    setSlackLoading(prev => ({ ...prev, [type]: true }))
    setSlackPreview(prev => ({ ...prev, [type]: null }))
    try {
      const res = await fetch('/api/admin/slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, action: 'preview', adminName: currentPlayer.name, customNote: slackNote[type] || undefined }),
      })
      const data = await res.json()
      if (data.previewLines) setSlackPreview(prev => ({ ...prev, [type]: data.previewLines }))
    } catch { /* ignore */ } finally {
      setSlackLoading(prev => ({ ...prev, [type]: false }))
    }
  }

  const sendSlack = async (type: 'morning' | 'summary') => {
    if (!currentPlayer) return
    setSlackSending(prev => ({ ...prev, [type]: true }))
    try {
      const res = await fetch('/api/admin/slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type, action: 'send', adminName: currentPlayer.name,
          customNote: slackNote[type] || undefined,
          doublePoints: type === 'morning' ? doublePointsToggle : undefined,
        }),
      })
      if (res.ok) {
        notify(`${type === 'morning' ? 'Morning briefing' : 'Daily summary'} sent to Slack!`)
        setSlackPreview(prev => ({ ...prev, [type]: null }))
        setSlackNote(prev => ({ ...prev, [type]: '' }))
        if (type === 'morning' && doublePointsToggle) {
          setDoublePointsToggle(false)
          await fetchLeagueConfig() // refresh so banner shows
        }
      } else {
        notify('Failed to send to Slack', 'red')
      }
    } catch { notify('Failed to send to Slack', 'red') } finally {
      setSlackSending(prev => ({ ...prev, [type]: false }))
    }
  }

  const createPlayer = async () => {
    if (!newName.trim() || !newFlag.trim()) return
    const res = await fetch('/api/players', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), countryFlag: newFlag.trim() }),
    })
    if (res.ok) {
      const p = await res.json()
      await fetchPlayers(); selectPlayer(p); setNewName(''); setNewFlag('')
    } else { notify('Player already exists!', 'red') }
  }

  const submitScore = async () => {
    if (!currentPlayer) return
    const res = await fetch('/api/scores', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: currentPlayer.id, round1: r1, round2: r2, round3: r3 }),
    })
    if (res.ok) {
      await fetchTodayScores(); await fetchLeaderboard(); await fetchBreakingNews()
      const t = (parseInt(r1)||0)+(parseInt(r2)||0)+(parseInt(r3)||0)
      notify(`Score submitted: ${t.toLocaleString()} pts!`)
      setR1(''); setR2(''); setR3('')
    } else { notify('Error submitting score', 'red') }
  }

  const postChatSystem = async (text: string) => {
    await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorName: 'League', text }),
    })
    await fetchChat()
  }

  const giveRedCard = async (score: Score) => {
    if (!currentPlayer || redCardStatus.usedToday) return
    if (score.playerId === currentPlayer.id) { notify("Can't card yourself!", 'red'); return }
    const res = await fetch('/api/redcards', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        givenById: currentPlayer.id,
        receivedById: score.playerId,
        scoreId: score.id,
        reason: redCardReason.trim() || null,
      }),
    })
    if (res.ok) {
      setRedCardModal(null)
      setRedCardReason('')
      notify(`🟥 RED CARD issued to ${score.player.name}!`, 'red')
      const reason = redCardReason.trim()
      const msg = reason
        ? `🟥 ${currentPlayer.countryFlag} ${currentPlayer.name} carded ${score.player.countryFlag} ${score.player.name} — "${reason}"`
        : `🟥 ${currentPlayer.countryFlag} ${currentPlayer.name} gave a red card to ${score.player.countryFlag} ${score.player.name}!`
      await postChatSystem(msg)
      await fetchTodayScores(); await fetchLeaderboard(); await fetchRedCardStatus()
    } else {
      const err = await res.json(); notify(err.error || 'Error', 'red')
    }
  }

  const postComment = async (scoreId: number) => {
    if (!currentPlayer || !commentText.trim()) return
    const res = await fetch('/api/comments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scoreId, authorName: currentPlayer.name, text: commentText.trim() }),
    })
    if (res.ok) { setCommentText(''); await fetchTodayScores() }
  }

  const sendChat = async () => {
    if (!currentPlayer || !chatInput.trim()) return
    await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: currentPlayer.id, authorName: currentPlayer.name, text: chatInput.trim() }),
    })
    setChatInput(''); await fetchChat()
  }

  const deleteChat = async (msgId: number) => {
    if (!isLeoAdmin || !currentPlayer) return
    const res = await fetch(`/api/chat?id=${msgId}&adminName=${encodeURIComponent(currentPlayer.name)}`, { method: 'DELETE' })
    if (res.ok) { await fetchChat() }
    else { const err = await res.json(); notify(err.error || 'Error deleting message', 'red') }
  }

  const isLeoAdmin = currentPlayer?.name.toLowerCase() === 'leo'

  const openEditProfile = () => {
    if (!currentPlayer) return
    setEditName(currentPlayer.name)
    setEditFlag(currentPlayer.countryFlag)
    setEditProfileOpen(true)
  }

  const saveProfile = async () => {
    if (!currentPlayer || !editName.trim() || !editFlag.trim()) return
    setEditSaving(true)
    try {
      const res = await fetch('/api/players', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentPlayer.id, name: editName.trim(), countryFlag: editFlag.trim() }),
      })
      if (res.ok) {
        const updated = await res.json()
        setCurrentPlayer(updated)
        await fetchPlayers()
        setEditProfileOpen(false)
        notify(`Profile updated!`)
      } else {
        const err = await res.json()
        notify(err.error || 'Failed to update profile', 'red')
      }
    } catch { notify('Failed to update profile', 'red') } finally {
      setEditSaving(false)
    }
  }

  const deletePlayer = async (playerId: number, playerName: string) => {
    if (!isLeoAdmin) return
    const res = await fetch(`/api/players?id=${playerId}&adminName=${encodeURIComponent(currentPlayer!.name)}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      notify(`${playerName} removed from the league.`, 'red')
      await fetchPlayers(); await fetchLeaderboard(); await fetchTodayScores()
    } else {
      const err = await res.json(); notify(err.error || 'Error removing player', 'red')
    }
  }

  const deleteScore = async (scoreId: number, playerName: string) => {
    if (!isLeoAdmin || !currentPlayer) return
    const res = await fetch(`/api/scores?id=${scoreId}&adminName=${encodeURIComponent(currentPlayer.name)}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      notify(`${playerName}'s score removed.`, 'red')
      await Promise.all([fetchLeaderboard(), fetchTodayScores(), fetchHistoryScores()])
      if (titleRaceLoaded) fetchTitleRace()
    } else {
      const err = await res.json(); notify(err.error || 'Error removing score', 'red')
    }
  }

  const resetGame = async () => {
    if (!isLeoAdmin || !currentPlayer) return
    setResetLoading(true)
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminName: currentPlayer.name, confirm: 'RESET' }),
      })
      if (res.ok) {
        setResetConfirmOpen(false)
        setResetConfirmText('')
        notify('League reset. All scores cleared.', 'red')
        await Promise.all([fetchLeaderboard(), fetchTodayScores(), fetchChat(), fetchBreakingNews()])
        setHistoryScores([]); setHistoryLoaded(false)
        setMonthlyWins([]); setWinsLoaded(false)
        setTitleRace(null); setTitleRaceLoaded(false)
      } else {
        const err = await res.json(); notify(err.error || 'Reset failed', 'red')
      }
    } catch { notify('Reset failed', 'red') } finally {
      setResetLoading(false)
    }
  }

  const total = (parseInt(r1)||0)+(parseInt(r2)||0)+(parseInt(r3)||0)
  const filteredPlayers = players.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.countryFlag.includes(searchQuery)
  )

  // Build playerId → formStreak map from standings for use in the feed
  const formStreakMap = new Map<number, 'hot' | 'cold' | null>()
  standings.forEach(s => formStreakMap.set(s.id, s.formStreak))

  return (
    <div className="min-h-screen bg-black">

      {/* ─── BREAKING NEWS BANNER ─── */}
      <BreakingNewsBanner items={activeNews} onDismiss={dismissNews} />

      {/* ─── RED CARD CONFIRMATION MODAL ─── */}
      <AnimatePresence>
        {redCardModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto"
            style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)' }}
            onClick={() => { setRedCardModal(null); setRedCardReason('') }}
          >
            <div className="flex min-h-full items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm bento-card p-6 veo-red-glow"
              style={{ overflow: 'visible' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="text-7xl mb-3 animate-pulse">🟥</div>
                <h2 className="font-display text-4xl font-900 text-veo-red tracking-wider uppercase">Red Card</h2>
                <p className="font-mono text-xs text-veo-dim mt-2">One card per day. No takebacks.</p>
              </div>

              <div className="p-4 rounded-xl bg-black border border-veo-red/30 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{redCardModal.score.player.countryFlag}</span>
                  <div className="flex-1">
                    <div className="font-display text-xl font-700 text-white">{redCardModal.score.player.name}</div>
                    <div className="font-mono text-[10px] text-veo-dim">Today&apos;s score</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-3xl font-900 text-veo-red">{redCardModal.score.total.toLocaleString()}</div>
                    <div className="font-mono text-[9px] text-veo-dim">/ 15,000</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[redCardModal.score.round1, redCardModal.score.round2, redCardModal.score.round3].map((r, i) => (
                    <div key={i} className="text-center p-2 rounded-lg bg-veo-surface border border-veo-border">
                      <div className="font-display text-sm font-700 text-white">{r.toLocaleString()}</div>
                      <div className="font-mono text-[8px] text-veo-dim">ROUND {i+1}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reason input */}
              <div className="mb-4">
                <label className="block font-mono text-[10px] text-veo-dim mb-1 uppercase tracking-wider">Reason (optional)</label>
                <input
                  value={redCardReason}
                  onChange={e => setRedCardReason(e.target.value)}
                  placeholder="Why are you carding them?..."
                  className="veo-input w-full px-3 py-2 rounded-lg text-xs"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setRedCardModal(null); setRedCardReason('') }}
                  className="flex-1 py-3 rounded-xl border border-veo-border text-veo-dim font-mono text-sm hover:border-veo-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => giveRedCard(redCardModal.score)}
                  className="flex-1 py-3 rounded-xl bg-veo-red text-white font-display text-xl font-900 tracking-wider hover:bg-red-600 transition-all"
                >
                  🟥 CARD THEM
                </button>
              </div>
            </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── RESET CONFIRM MODAL ─── */}
      <AnimatePresence>
        {resetConfirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto"
            style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}
            onClick={() => { setResetConfirmOpen(false); setResetConfirmText('') }}
          >
            <div className="flex min-h-full items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="w-full max-w-sm bento-card p-6"
                style={{ border: '1px solid rgba(255,48,48,0.5)' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="text-center mb-6">
                  <div className="text-6xl mb-3">⚠️</div>
                  <h2 className="font-display text-3xl font-900 text-veo-red tracking-wider uppercase">Reset League</h2>
                  <p className="font-mono text-xs text-veo-dim mt-2 leading-relaxed">
                    This will permanently delete <span className="text-white">all scores, red cards, comments, chat, and monthly wins</span>. Players and config are kept.
                  </p>
                </div>
                <div className="mb-4">
                  <label className="block font-mono text-[10px] text-veo-dim mb-1.5 uppercase tracking-wider">
                    Type <span className="text-veo-red font-bold">RESET</span> to confirm
                  </label>
                  <input
                    value={resetConfirmText}
                    onChange={e => setResetConfirmText(e.target.value)}
                    placeholder="RESET"
                    className="veo-input w-full px-3 py-2 rounded-lg text-sm font-mono text-center tracking-widest"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setResetConfirmOpen(false); setResetConfirmText('') }}
                    className="flex-1 py-3 rounded-xl border border-veo-border text-veo-dim font-mono text-sm hover:border-veo-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={resetGame}
                    disabled={resetConfirmText !== 'RESET' || resetLoading}
                    className="flex-1 py-3 rounded-xl border border-veo-red bg-veo-red/10 text-veo-red font-display text-lg font-900 tracking-wider hover:bg-veo-red/20 transition-all disabled:opacity-40"
                  >
                    {resetLoading ? 'Resetting…' : '🗑 RESET'}
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── LEO PIN MODAL ─── */}
      <AnimatePresence>
        {pinModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(10px)' }}
            onClick={() => setPinModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-xs bento-card p-6"
              style={{ borderColor: 'rgba(255,48,48,0.4)', boxShadow: '0 0 40px rgba(255,48,48,0.2)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center mb-5">
                <div className="text-5xl mb-3">🔒</div>
                <h2 className="font-display text-2xl font-900 text-veo-red tracking-wider uppercase">Admin Access</h2>
                <p className="font-mono text-[10px] text-veo-dim mt-1">Enter pin to log in as {pinModal.player.countryFlag} {pinModal.player.name}</p>
              </div>

              {/* Pin dots display */}
              <div className="flex justify-center gap-3 mb-5">
                {[0,1,2,3].map(i => (
                  <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${
                    pinInput.length > i
                      ? 'bg-veo-red border-veo-red'
                      : 'bg-transparent border-veo-border'
                  }`} />
                ))}
              </div>

              {pinError && (
                <p className="font-mono text-[10px] text-veo-red text-center mb-3 animate-pulse">Incorrect pin. Try again.</p>
              )}

              {/* Number pad */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((key, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (key === '⌫') {
                        setPinInput(p => p.slice(0,-1))
                        setPinError(false)
                      } else if (key === '') {
                        // spacer
                      } else if (typeof key === 'number' && pinInput.length < 4) {
                        const next = pinInput + String(key)
                        setPinInput(next)
                        setPinError(false)
                        if (next.length === 4) {
                          // auto-submit
                          setTimeout(() => {
                            if (next === '0874' && pinModal) {
                              selectPlayer(pinModal.player)
                              setPinModal(null)
                              setPinInput('')
                              setPinError(false)
                            } else {
                              setPinError(true)
                              setPinInput('')
                            }
                          }, 120)
                        }
                      }
                    }}
                    disabled={key === ''}
                    className={`h-12 rounded-xl border font-display text-lg font-700 transition-all ${
                      key === ''
                        ? 'invisible'
                        : key === '⌫'
                        ? 'border-veo-border text-veo-dim hover:border-veo-muted hover:text-veo-text'
                        : 'border-veo-border text-veo-text hover:border-veo-green/40 hover:bg-veo-green/5 active:scale-95'
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setPinModal(null)}
                className="w-full font-mono text-[10px] text-veo-dim hover:text-veo-text transition-colors mt-1"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── EDIT PROFILE MODAL ─── */}
      <AnimatePresence>
        {editProfileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(10px)' }}
            onClick={() => setEditProfileOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm bento-card p-6"
              style={{ borderColor: 'rgba(48,255,81,0.25)', boxShadow: '0 0 40px rgba(48,255,81,0.1)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center mb-5">
                <div className="text-4xl mb-2">{editFlag || '?'}</div>
                <h2 className="font-display text-2xl font-900 text-veo-green tracking-wider uppercase">Edit Profile</h2>
                <p className="font-mono text-[10px] text-veo-dim mt-1">Change your name or emoji</p>
              </div>

              {/* Emoji quick-pick */}
              <div className="mb-4">
                <p className="font-mono text-[9px] text-veo-dim mb-1.5 uppercase tracking-wider">Quick pick</p>
                <div className="flex flex-wrap gap-1.5">
                  {['🇺🇸','🇬🇧','🇩🇪','🇫🇷','🇪🇸','🇵🇹','🇮🇹','🇳🇱','🇧🇪','🇸🇪','🇳🇴','🇩🇰','🇵🇱','🇧🇷','🇦🇷','🇲🇽','🇯🇵','🇰🇷','🇨🇳','🇦🇺','🇨🇦','🇿🇦','🇳🇬','🎯','⚽','🔥','👾','🐉','🦅','💀'].map(e => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEditFlag(e)}
                      className={`text-xl w-9 h-9 flex items-center justify-center rounded-lg border transition-all ${
                        editFlag === e
                          ? 'border-veo-green bg-veo-green/20'
                          : 'border-veo-border hover:border-veo-muted bg-black'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 items-end mb-4">
                <div className="flex-shrink-0 w-20">
                  <label className="block font-mono text-[10px] text-veo-dim mb-1 uppercase tracking-wider">Emoji</label>
                  <input
                    value={editFlag}
                    onChange={e => setEditFlag(e.target.value)}
                    placeholder="?"
                    className="veo-input w-full px-3 py-2 rounded-lg text-2xl text-center"
                  />
                </div>
                <div className="flex-1">
                  <label className="block font-mono text-[10px] text-veo-dim mb-1 uppercase tracking-wider">Name</label>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveProfile()}
                    placeholder="Your name..."
                    className="veo-input w-full px-3 py-2 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setEditProfileOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-veo-border text-veo-dim font-mono text-sm hover:border-veo-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveProfile}
                  disabled={editSaving || !editName.trim() || !editFlag.trim()}
                  className="flex-1 py-3 rounded-xl bg-veo-green text-black font-display text-lg font-900 tracking-wider hover:bg-veo-green/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {editSaving ? 'Saving...' : '✓ Save'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── DOUBLE POINTS BANNER ─── */}
      {leagueConfig.isDoubleDay && (
        <div
          className="relative overflow-hidden z-40"
          style={{ background: '#000', borderBottom: '2px solid #FFD700' }}
        >
          <div style={{ height: 2, background: '#FFD700', boxShadow: '0 0 14px 4px #FFD700', opacity: 0.9 }} />
          <div className="flex items-center h-9">
            <div
              className="flex-shrink-0 px-3 h-full flex items-center font-display font-900 text-sm tracking-widest"
              style={{ background: '#FFD700', color: '#000' }}
            >
              ⚡ DOUBLE POINTS
            </div>
            <div className="flex-1 overflow-hidden relative">
              <motion.div
                className="flex items-center gap-16 whitespace-nowrap"
                style={{ color: '#FFD700', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}
                animate={{ x: ['0%', '-50%'] }}
                transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
              >
                {[0, 1].map(k => (
                  <span key={k} className="pl-8">
                    Today&apos;s scores count TWICE toward the monthly standings — go big!
                  </span>
                ))}
              </motion.div>
            </div>
          </div>
          <div style={{ height: 2, background: '#FFD700', boxShadow: '0 0 14px 4px #FFD700', opacity: 0.4 }} />
        </div>
      )}

      {/* Notification toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20, x: 20 }}
            className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg border font-mono text-sm ${
              notification.type === 'green'
                ? 'bg-veo-surface border-veo-green text-veo-green'
                : 'bg-veo-surface border-veo-red text-veo-red'
            }`}
          >
            {notification.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b border-veo-border bg-veo-surface/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-veo-green flex items-center justify-center">
              <Flag size={16} className="text-black" />
            </div>
            <div>
              <h1 className="font-display text-xl font-900 tracking-wider text-white leading-none">VEO GEO LEAGUE</h1>
              <p className="font-mono text-[9px] text-veo-dim tracking-widest uppercase">Honor System · No Mercy</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currentPlayer && (
              <div className={`px-2.5 py-1.5 rounded-lg border font-mono text-[10px] flex items-center gap-1.5 ${
                redCardStatus.usedToday
                  ? 'border-veo-border text-veo-dim bg-black'
                  : 'border-veo-red/50 text-veo-red bg-veo-red/5 animate-pulse-green'
              }`}
              style={!redCardStatus.usedToday ? { animationName: 'none', boxShadow: '0 0 10px rgba(255,48,48,0.2)' } : {}}>
                🟥 {redCardStatus.usedToday ? 'USED' : 'READY'}
              </div>
            )}
            {currentPlayer ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black border border-veo-green/30">
                <span className="text-lg">{currentPlayer.countryFlag}</span>
                <span className="font-mono text-xs text-veo-green font-bold">{currentPlayer.name}</span>
                {isLeoAdmin && (
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-veo-red/40 text-veo-red bg-veo-red/10 leading-none">ADMIN</span>
                )}
                <button onClick={openEditProfile} title="Edit name / emoji" className="text-veo-dim hover:text-veo-green ml-1 transition-colors"><Pencil size={11} /></button>
                <button onClick={() => { setCurrentPlayer(null); try { localStorage.removeItem('currentPlayerId') } catch { /* ignore */ } }} className="text-veo-dim hover:text-veo-red"><X size={12} /></button>
              </div>
            ) : (
              <div className="text-veo-dim font-mono text-xs">← Select player</div>
            )}
            <button
              onClick={() => { fetchLeaderboard(); fetchTodayScores(); fetchChat(); fetchBreakingNews(); if(currentPlayer) fetchRedCardStatus() }}
              className="p-2 rounded-lg border border-veo-border hover:border-veo-green/30 text-veo-dim hover:text-veo-green transition-colors"
            ><RefreshCw size={14} /></button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Onboarding */}
        {!currentPlayer && (
          <div className="mb-6 bento-card p-5 veo-green-glow">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={16} className="text-veo-green" />
              <span className="font-display text-lg font-700 tracking-wide text-white">PLAYER SIGN-IN</span>
              <span className="ml-auto font-mono text-xs text-veo-dim">honor system</span>
            </div>
            <div className="flex gap-2 mb-4">
              {['select','new'].map(mode => (
                <button key={mode} onClick={() => setOnboardMode(mode as 'select'|'new')}
                  className={`flex-1 py-2 rounded-lg border font-mono text-xs transition-colors ${
                    onboardMode === mode ? 'border-veo-green bg-veo-green/10 text-veo-green' : 'border-veo-border text-veo-dim hover:border-veo-muted'
                  }`}>
                  {mode === 'select' ? 'SELECT PLAYER' : 'NEW PLAYER'}
                </button>
              ))}
            </div>
            {onboardMode === 'select' ? (
              <div>
                <div className="relative mb-3">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-veo-dim" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search players..."
                    className="veo-input w-full pl-8 pr-4 py-2 rounded-lg text-sm" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                  {filteredPlayers.map(p => (
                    <button key={p.id} onClick={() => handlePlayerClick(p)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-veo-border hover:border-veo-green/50 hover:bg-veo-green/5 transition-all text-left">
                      <span className="text-xl">{p.countryFlag}</span>
                      <span className="font-mono text-xs text-veo-text truncate">{p.name}</span>
                    </button>
                  ))}
                  {filteredPlayers.length === 0 && <p className="col-span-full text-veo-dim font-mono text-xs text-center py-4">No players found</p>}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="font-mono text-[10px] text-veo-dim">Pick any emoji to represent you — flag, vibe, whatever fits.</p>

                {/* Emoji quick-pick grid */}
                <div>
                  <p className="font-mono text-[9px] text-veo-dim mb-1.5 uppercase tracking-wider">Quick pick</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['🇺🇸','🇬🇧','🇩🇪','🇫🇷','🇪🇸','🇵🇹','🇮🇹','🇳🇱','🇧🇪','🇸🇪','🇳🇴','🇩🇰','🇵🇱','🇧🇷','🇦🇷','🇲🇽','🇯🇵','🇰🇷','🇨🇳','🇦🇺','🇨🇦','🇿🇦','🇳🇬','🎯','⚽','🔥','👾','🐉','🦅','💀'].map(e => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setNewFlag(e)}
                        className={`text-xl w-9 h-9 flex items-center justify-center rounded-lg border transition-all ${
                          newFlag === e
                            ? 'border-veo-green bg-veo-green/20'
                            : 'border-veo-border hover:border-veo-muted bg-black'
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 items-end">
                  <div className="flex-shrink-0 w-20">
                    <label className="block font-mono text-[10px] text-veo-dim mb-1 uppercase tracking-wider">Selected</label>
                    <input
                      value={newFlag}
                      onChange={e => setNewFlag(e.target.value)}
                      placeholder="?"
                      className="veo-input w-full px-3 py-2 rounded-lg text-2xl text-center"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block font-mono text-[10px] text-veo-dim mb-1 uppercase tracking-wider">Name</label>
                    <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key==='Enter'&&createPlayer()}
                      placeholder="Enter your name..." className="veo-input w-full px-3 py-2 rounded-lg text-sm" />
                  </div>
                  <button onClick={createPlayer} disabled={!newName.trim()||!newFlag.trim()}
                    className="px-4 py-2 rounded-lg bg-veo-green text-black font-mono text-xs font-bold hover:bg-veo-green/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1">
                    <Plus size={14} /> JOIN
                  </button>
                </div>
                <p className="font-mono text-[9px] text-veo-dim">Not in the list? Paste any emoji into the selected box above.</p>
              </div>
            )}
          </div>
        )}

        {/* ─── RED CARD PANEL ─── */}
        {currentPlayer && todayScores.length > 0 && (
          <div className={`mb-6 bento-card p-4 transition-all ${redCardStatus.usedToday ? '' : 'veo-red-glow'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-veo-red" />
                <span className="font-display text-lg font-700 tracking-wide text-white uppercase">Daily Red Card</span>
                <span className={`font-mono text-[10px] px-2 py-0.5 rounded border ${
                  redCardStatus.usedToday
                    ? 'border-veo-border text-veo-dim bg-black'
                    : 'border-veo-red/40 text-veo-red bg-veo-red/10'
                }`}>
                  {redCardStatus.usedToday ? '✓ USED TODAY' : '🟥 1 AVAILABLE'}
                </span>
              </div>
              <p className="font-mono text-[10px] text-veo-dim hidden sm:block">
                {redCardStatus.usedToday ? 'Resets at midnight' : 'Tap a score to issue'}
              </p>
            </div>

            {redCardStatus.usedToday ? (
              <div className="p-3 rounded-xl bg-black border border-veo-border text-center">
                <p className="font-mono text-xs text-veo-dim">You&apos;ve used your red card today. Come back tomorrow. 😈</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {todayScores.filter(s => s.playerId !== currentPlayer.id).map(score => (
                  <button
                    key={score.id}
                    onClick={() => setRedCardModal({ score })}
                    className="group p-3 rounded-xl border border-veo-border hover:border-veo-red/60 hover:bg-veo-red/5 transition-all text-left relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-veo-red/0 to-veo-red/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
                    <div className="relative">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-lg">{score.player.countryFlag}</span>
                        <span className="font-mono text-xs text-veo-text truncate">{score.player.name}</span>
                      </div>
                      <div className="font-display text-xl font-900 text-white group-hover:text-veo-red transition-colors">
                        {score.total.toLocaleString()}
                      </div>
                      <div className="font-mono text-[8px] text-veo-dim group-hover:text-veo-red/70 transition-colors mt-0.5">
                        ISSUE RED CARD 🟥
                      </div>
                    </div>
                  </button>
                ))}
                {todayScores.filter(s => s.playerId !== currentPlayer.id).length === 0 && (
                  <p className="col-span-full font-mono text-xs text-veo-dim text-center py-2">No other players have submitted today</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 mb-6 p-1 bg-veo-surface rounded-xl border border-veo-border w-fit">
          {[
            { id: 'leaderboard', icon: <Trophy size={14}/>, label: 'STANDINGS' },
            { id: 'history', icon: <Calendar size={14}/>, label: 'HISTORY' },
            { id: 'submit', icon: <Zap size={14}/>, label: 'SUBMIT' },
            { id: 'archive', icon: <Archive size={14}/>, label: 'ARCHIVE' },
            { id: 'wins', icon: <Award size={14}/>, label: 'HALL OF FAME' },
            { id: 'titlerace', icon: <BarChart2 size={14}/>, label: 'TITLE RACE' },
          ].map(tab => (
            <button key={tab.id} onClick={() => {
              setActiveTab(tab.id as typeof activeTab)
              if (tab.id === 'history' && !historyLoaded) fetchHistoryScores()
              if (tab.id === 'wins' && !winsLoaded) fetchMonthlyWins()
              if (tab.id === 'titlerace' && !titleRaceLoaded) fetchTitleRace()
            }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs tracking-wider transition-all ${
                activeTab === tab.id ? 'bg-veo-green text-black font-bold' : 'text-veo-dim hover:text-veo-text'
              }`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ─── LEADERBOARD ─── */}
        {activeTab === 'leaderboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr] gap-4">

            {/* ── TRASH TALK (left column) ── */}
            <div className="bento-card flex flex-col" style={{height:'clamp(400px,70vh,720px)'}}>
              <div className="flex items-center gap-2 p-3 border-b border-veo-border flex-shrink-0">
                <MessageSquare size={13} className="text-veo-green"/>
                <span className="font-display text-sm font-700 tracking-wide text-white uppercase">Trash Talk</span>
                <span className="ml-auto font-mono text-[9px] text-veo-dim">LIVE</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-8 text-veo-dim font-mono text-xs">No messages yet</div>
                ) : chatMessages.map(msg => {
                  const isSystem = msg.authorName === 'League'
                  return (
                    <div key={msg.id} className={`group animate-fade-in ${isSystem ? '' : ''}`}>
                      {isSystem ? (
                        <div className="flex items-center gap-1.5 py-1">
                          <div className="flex-1 font-mono text-[10px] text-veo-red/80 italic leading-snug">{msg.text}</div>
                          {isLeoAdmin && (
                            <button onClick={() => deleteChat(msg.id)} className="opacity-0 group-hover:opacity-100 p-0.5 text-veo-dim hover:text-veo-red transition-all flex-shrink-0"><X size={9}/></button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-start gap-1.5">
                          <div className="flex-shrink-0 text-base leading-none mt-0.5">{msg.player?.countryFlag ?? '💬'}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-1.5 mb-0.5">
                              <span className="font-mono text-[9px] text-veo-green font-bold truncate">{msg.authorName}</span>
                              <span className="font-mono text-[8px] text-veo-dim flex-shrink-0">
                                {new Date(msg.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                              </span>
                            </div>
                            <div className="p-1.5 rounded-lg bg-black border border-veo-border font-mono text-[10px] text-veo-text leading-snug break-words">{msg.text}</div>
                          </div>
                          {isLeoAdmin && (
                            <button onClick={() => deleteChat(msg.id)} className="opacity-0 group-hover:opacity-100 p-0.5 text-veo-dim hover:text-veo-red transition-all flex-shrink-0 mt-0.5"><X size={9}/></button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                <div ref={chatEndRef}/>
              </div>
              <div className="p-2 border-t border-veo-border flex-shrink-0">
                {!currentPlayer ? (
                  <p className="text-center font-mono text-[10px] text-veo-dim py-1">Sign in to chat</p>
                ) : (
                  <div className="flex gap-1.5">
                    <input value={chatInput} onChange={e=>setChatInput(e.target.value)}
                      onKeyDown={e=>e.key==='Enter'&&sendChat()}
                      placeholder="Say something..."
                      className="veo-input flex-1 px-2.5 py-1.5 rounded-lg text-[11px]"/>
                    <button onClick={sendChat} disabled={!chatInput.trim()}
                      className="px-2.5 py-1.5 rounded-lg bg-veo-green/20 border border-veo-green/30 text-veo-green hover:bg-veo-green/30 disabled:opacity-30 transition-all">
                      <Send size={11}/>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── STANDINGS (center column) ── */}
            <div className="space-y-3">
              <div className="bento-card p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-veo-green" />
                    <span className="font-display text-lg font-700 tracking-wide text-white uppercase">Monthly Standings</span>
                  </div>
                  <div className="font-mono text-[10px] text-veo-dim">TOP 15 DAYS ÷ 15</div>
                </div>
                {standings.length === 0 ? (
                  <div className="text-center py-12 text-veo-dim font-mono text-sm">No scores yet this month. Be the first!</div>
                ) : (
                  <div className="space-y-2">
                    {standings.map((s, i) => (
                      <div key={s.id} className={`p-3 rounded-xl border transition-all ${
                        i === 0 ? 'border-veo-green/40 bg-veo-green/5 veo-green-glow' : 'border-veo-border bg-black/30 hover:border-veo-muted'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 text-center font-display text-xl font-900 ${
                            i===0?'rank-1':i===1?'rank-2':i===2?'rank-3':'text-veo-dim'}`}>#{i+1}</div>
                          <span className="text-2xl">{s.countryFlag}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-display text-base font-700 text-white tracking-wide">{s.name}</span>
                              {s.isMvp && <span title="Monthly MVP">🏆</span>}
                              <FormBadge streak={s.formStreak} />
                              {s.redCardCount > 0 && (
                                <span className="font-mono text-[10px] text-veo-red bg-veo-red/10 px-1.5 py-0.5 rounded border border-veo-red/20">
                                  🟥 ×{s.redCardCount}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 h-1.5 rounded-full bg-veo-muted overflow-hidden">
                              <div className="h-full rounded-full score-bar" style={{
                                width: `${Math.min((s.monthlyAverage/15000)*100,100)}%`,
                                background: i===0 ? 'linear-gradient(90deg,#30FF51,#00cc33)' : 'linear-gradient(90deg,#3a4a5a,#2a3a4a)',
                              }}/>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`font-display text-xl font-900 ${i===0?'text-veo-green':'text-white'}`}>
                              {s.monthlyAverage.toFixed(0)}
                            </div>
                            <div className="font-mono text-[9px] text-veo-dim">{s.gamesPlayed} games</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {/* ─── MATCH DAY LIVE FEED ─── */}
              <div className="bento-card p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar size={14} className="text-veo-green" />
                  <span className="font-display text-base font-700 tracking-wide text-white uppercase">Match Day Live</span>
                  {leagueConfig && (
                    <span className="font-mono text-[9px] text-veo-dim">
                      {new Date(leagueConfig.effectiveDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  {todayScores.length > 0 && (
                    <span className="ml-auto font-mono text-[9px] text-veo-green animate-pulse">● LIVE</span>
                  )}
                </div>
                {todayScores.length === 0 ? (
                  <p className="text-veo-dim font-mono text-xs text-center py-6">No scores today yet</p>
                ) : (
                  <div className="space-y-2">
                    {todayScores.map((score, i) => {
                      const isClutch = score.total >= 14800
                      const feedStreak = formStreakMap.get(score.playerId) ?? null
                      return (
                        <motion.div
                          key={score.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                        >
                          <div
                            className={`p-3 rounded-xl border cursor-pointer transition-all ${
                              isClutch
                                ? 'border-veo-green/50 bg-veo-green/5 veo-green-glow'
                                : expandedScore===score.id
                                  ? 'border-veo-green/30 bg-veo-green/5'
                                  : 'border-veo-border hover:border-veo-muted'
                            }`}
                            onClick={() => setExpandedScore(expandedScore===score.id?null:score.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-wrap">
                                {i===0 && <span title="Today MVP">🏅</span>}
                                <span>{score.player.countryFlag}</span>
                                <span className="font-mono text-xs text-veo-text">{score.player.name}</span>
                                <FormBadge streak={feedStreak} />
                                <ScoreTag total={score.total} />
                                <PositionChangeBadge change={score.positionChange} />
                                {score.isDoubleDay && (
                                  <span className="inline-flex items-center font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border border-yellow-400/50 text-yellow-400 bg-yellow-400/10 tracking-wider">⚡ ×2</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {score._count.redCards > 0 && (
                                  <span className="text-[10px] font-mono text-veo-red">🟥×{score._count.redCards}</span>
                                )}
                                <span className={`font-display text-base font-700 ${isClutch?'text-veo-green':i===0?'text-veo-green':'text-white'}`}>
                                  {score.total.toLocaleString()}
                                </span>
                              </div>
                            </div>

                            {/* Red cards with reasons */}
                            {score.redCards.length > 0 && (
                              <div className="mt-1.5 space-y-0.5">
                                {score.redCards.map(rc => (
                                  <div key={rc.id} className="font-mono text-[9px] text-veo-dim">
                                    {rc.givenBy.countryFlag} {rc.givenBy.name} 🟥
                                    {rc.reason && <span className="text-veo-red/80">: &quot;{rc.reason}&quot;</span>}
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex gap-1 mt-1.5">
                              {[score.round1,score.round2,score.round3].map((r,ri) => (
                                <div key={ri} className="flex-1 h-1 rounded-full bg-veo-muted overflow-hidden">
                                  <div className="h-full rounded-full" style={{
                                    width:`${(r/5000)*100}%`,
                                    background:r>=4500?'#30FF51':r>=3000?'#60a0c0':'#3a4a5a'
                                  }}/>
                                </div>
                              ))}
                            </div>
                          </div>
                          {expandedScore===score.id && (
                            <div className="ml-2 mt-1 p-3 rounded-xl bg-veo-surface border border-veo-border animate-slide-in">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="flex gap-2 font-mono text-[10px] text-veo-dim flex-1">
                                  <span>R1: {score.round1.toLocaleString()}</span>
                                  <span>R2: {score.round2.toLocaleString()}</span>
                                  <span>R3: {score.round3.toLocaleString()}</span>
                                </div>
                                {isLeoAdmin && (
                                  <button
                                    onClick={e => { e.stopPropagation(); deleteScore(score.id, score.player.name) }}
                                    className="flex items-center gap-1 px-2 py-1 rounded border border-veo-red/40 text-veo-red font-mono text-[9px] hover:bg-veo-red/10 transition-colors"
                                    title="Delete this score"
                                  >
                                    🗑 DELETE
                                  </button>
                                )}
                              </div>
                              {score.comments.length > 0 && (
                                <div className="space-y-1.5 mb-2">
                                  {score.comments.map(c => (
                                    <div key={c.id} className="p-2 bg-black rounded-lg border border-veo-border">
                                      <span className="font-mono text-[9px] text-veo-green">{c.authorName}: </span>
                                      <span className="font-mono text-[10px] text-veo-text">{c.text}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {currentPlayer && (
                                <div className="flex gap-1">
                                  <input value={commentText} onChange={e=>setCommentText(e.target.value)}
                                    onKeyDown={e=>e.key==='Enter'&&postComment(score.id)}
                                    placeholder="Post-match comment..." className="veo-input flex-1 px-2 py-1.5 rounded-lg text-[10px]"/>
                                  <button onClick={()=>postComment(score.id)}
                                    className="px-2 py-1.5 rounded-lg bg-veo-green/20 border border-veo-green/30 text-veo-green hover:bg-veo-green/30 transition-colors">
                                    <Send size={10}/>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ─── SCHEDULE / DAYS REMAINING ─── */}
              <div className="bento-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={14} className="text-veo-green" />
                  <span className="font-display text-base font-700 tracking-wide text-white uppercase">League Schedule</span>
                </div>
                {leagueConfig.totalActiveDays > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-[10px] text-veo-dim">{leagueConfig.totalActiveDays} scoring days this month</span>
                      <span className="font-mono text-[10px] text-veo-green font-bold">{leagueConfig.daysRemaining ?? 0} remaining</span>
                    </div>
                    <div className="h-2 rounded-full bg-veo-muted overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(((leagueConfig.totalActiveDays - (leagueConfig.daysRemaining ?? 0)) / leagueConfig.totalActiveDays) * 100, 100)}%`,
                          background: 'linear-gradient(90deg,#30FF51,#00cc33)',
                        }}
                      />
                    </div>
                    <div className="font-mono text-[9px] text-veo-dim">
                      {leagueConfig.totalActiveDays - (leagueConfig.daysRemaining ?? 0)} played · Top {leagueConfig.scoreCount} scores count
                    </div>
                  </div>
                ) : (
                  <p className="font-mono text-[10px] text-veo-dim">Schedule not set — ask Leo to configure it</p>
                )}
              </div>

              <div className="bento-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users size={14} className="text-veo-green" />
                  <span className="font-display text-base font-700 tracking-wide text-white uppercase">League Stats</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-black rounded-lg border border-veo-border text-center">
                    <div className="font-display text-2xl font-900 text-veo-green">{players.length}</div>
                    <div className="font-mono text-[9px] text-veo-dim uppercase">Players</div>
                  </div>
                  <div className="p-2 bg-black rounded-lg border border-veo-border text-center">
                    <div className="font-display text-2xl font-900 text-white">{todayScores.length}</div>
                    <div className="font-mono text-[9px] text-veo-dim uppercase">Today</div>
                  </div>
                  {standings[0] && (
                    <div className="col-span-2 p-2 bg-black rounded-lg border border-veo-green/20 text-center">
                      <div className="font-mono text-[9px] text-veo-dim uppercase mb-1">Current Leader</div>
                      <div className="font-display text-base font-700 text-veo-green">
                        {standings[0].countryFlag} {standings[0].name}
                        {standings[0].formStreak === 'hot' && <span className="ml-1">🔥</span>}
                      </div>
                      <div className="font-mono text-[10px] text-veo-dim">avg {standings[0].monthlyAverage.toFixed(0)}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* ─── LEO ADMIN PANEL ─── */}
              {isLeoAdmin && (
                <div className="bento-card p-4" style={{ borderColor: 'rgba(255,48,48,0.35)', boxShadow: '0 0 30px rgba(255,48,48,0.08)' }}>
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-4">
                    <Shield size={14} className="text-veo-red" />
                    <span className="font-display text-base font-700 tracking-wide text-veo-red uppercase">Admin Panel</span>
                    <span className="ml-auto font-mono text-[9px] text-veo-dim">Leo only</span>
                  </div>

                  {/* Section tabs */}
                  <div className="flex gap-1 mb-4 flex-wrap">
                    {(['players', 'morning', 'summary', 'config'] as const).map(sec => (
                      <button
                        key={sec}
                        onClick={() => {
                          setAdminSection(sec)
                          if (sec === 'config') fetchAdminConfig()
                        }}
                        className={`flex-1 py-1.5 rounded-lg border font-mono text-[9px] uppercase tracking-wider transition-all ${
                          adminSection === sec
                            ? 'border-veo-red/60 bg-veo-red/10 text-veo-red'
                            : 'border-veo-border text-veo-dim hover:border-veo-muted'
                        }`}
                      >
                        {sec === 'players' ? '👥' : sec === 'morning' ? '🌅' : sec === 'summary' ? '📊' : '⚙️'}
                        {' '}{sec === 'players' ? 'Players' : sec === 'morning' ? 'Morning' : sec === 'summary' ? 'Summary' : 'Config'}
                      </button>
                    ))}
                  </div>

                  {/* ── Players section ── */}
                  {adminSection === 'players' && (
                    <div className="space-y-4">
                      <div>
                        <p className="font-mono text-[10px] text-veo-dim mb-3">Remove any player from the league.</p>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {players.filter(p => p.id !== currentPlayer!.id).map(p => (
                            <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-veo-border bg-black">
                              <span className="text-lg">{p.countryFlag}</span>
                              <span className="font-mono text-xs text-veo-text flex-1 truncate">{p.name}</span>
                              <button
                                onClick={() => deletePlayer(p.id, p.name)}
                                className="px-2 py-1 rounded border border-veo-red/40 text-veo-red font-mono text-[9px] hover:bg-veo-red/10 transition-colors"
                              >
                                REMOVE
                              </button>
                            </div>
                          ))}
                          {players.filter(p => p.id !== currentPlayer!.id).length === 0 && (
                            <p className="font-mono text-[10px] text-veo-dim text-center py-2">No other players</p>
                          )}
                        </div>
                      </div>

                      {/* ── Danger Zone ── */}
                      <div className="rounded-lg border border-veo-red/30 p-3 bg-veo-red/5">
                        <p className="font-mono text-[9px] text-veo-red uppercase tracking-wider mb-2">⚠ Danger Zone</p>
                        <p className="font-mono text-[10px] text-veo-dim mb-3">Wipe all scores, red cards, chat and wins. Players and config kept.</p>
                        <button
                          onClick={() => setResetConfirmOpen(true)}
                          className="w-full py-2 rounded-lg border border-veo-red/50 text-veo-red font-mono text-[10px] font-bold uppercase tracking-wider hover:bg-veo-red/10 transition-colors"
                        >
                          🗑 Reset Entire League
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Morning / Summary Slack sections ── */}
                  {(adminSection === 'morning' || adminSection === 'summary') && (() => {
                    const type = adminSection
                    const preview = slackPreview[type]
                    const loading = slackLoading[type]
                    const sending = slackSending[type]
                    const note = slackNote[type]
                    const label = type === 'morning' ? 'Morning Briefing' : 'Daily Summary'
                    return (
                      <div className="space-y-3">
                        <p className="font-mono text-[10px] text-veo-dim">
                          {type === 'morning'
                            ? 'Preview and send the morning briefing to Slack.'
                            : 'Preview and send the daily wrap-up to Slack.'}
                        </p>

                        {/* Double points toggle (morning only) */}
                        {type === 'morning' && (
                          <button
                            onClick={() => setDoublePointsToggle(v => !v)}
                            className={`w-full py-2 rounded-lg border font-mono text-[10px] font-bold uppercase tracking-wider transition-all ${
                              doublePointsToggle
                                ? 'border-yellow-400/60 bg-yellow-400/10 text-yellow-400'
                                : 'border-veo-border text-veo-dim hover:border-veo-muted'
                            }`}
                          >
                            {doublePointsToggle ? '⚡ Double Points ON — click to disable' : '⚡ Enable Double Points Day'}
                          </button>
                        )}

                        {/* Custom note input */}
                        <div>
                          <label className="block font-mono text-[9px] text-veo-dim uppercase tracking-wider mb-1">
                            Custom note (optional)
                          </label>
                          <input
                            type="text"
                            value={note}
                            onChange={e => setSlackNote(prev => ({ ...prev, [type]: e.target.value }))}
                            placeholder="Add a note prepended to the message..."
                            className="veo-input w-full px-3 py-2 rounded-lg text-xs"
                          />
                        </div>

                        {/* Preview button */}
                        <button
                          onClick={() => {
                            // Pass doublePoints to preview so it shows in preview
                            if (type === 'morning') {
                              setSlackLoading(prev => ({ ...prev, morning: true }))
                              setSlackPreview(prev => ({ ...prev, morning: null }))
                              fetch('/api/admin/slack', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ type: 'morning', action: 'preview', adminName: currentPlayer!.name, customNote: note || undefined, doublePoints: doublePointsToggle }),
                              }).then(r => r.json()).then(d => {
                                if (d.previewLines) setSlackPreview(prev => ({ ...prev, morning: d.previewLines }))
                              }).finally(() => setSlackLoading(prev => ({ ...prev, morning: false })))
                            } else {
                              fetchSlackPreview(type)
                            }
                          }}
                          disabled={loading}
                          className="w-full py-2 rounded-lg border border-veo-border text-veo-dim font-mono text-[10px] hover:border-veo-muted hover:text-veo-text transition-all disabled:opacity-50"
                        >
                          {loading ? '⏳ Generating preview...' : `👁 Preview ${label}`}
                        </button>

                        {/* Preview box */}
                        {preview && (
                          <div className="rounded-xl border border-veo-border bg-black p-3 max-h-64 overflow-y-auto">
                            <div className="flex items-center gap-1.5 mb-2">
                              <div className="w-2 h-2 rounded-full bg-veo-green" />
                              <span className="font-mono text-[9px] text-veo-dim uppercase tracking-wider">Slack Preview</span>
                            </div>
                            <div className="space-y-0.5">
                              {preview.map((line, i) => (
                                <p key={i} className={`font-mono text-[10px] leading-relaxed ${
                                  line.startsWith('─') ? 'text-veo-border' :
                                  line.startsWith('⛳') ? 'text-veo-green font-bold text-xs' :
                                  line.startsWith('⚡') ? 'text-yellow-400 font-bold' :
                                  line.startsWith('📌') ? 'text-yellow-400' :
                                  line.startsWith('  ') ? 'text-veo-text' :
                                  line === '' ? 'h-1' :
                                  'text-veo-muted'
                                }`}>
                                  {line || '\u00A0'}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Send button */}
                        <button
                          onClick={() => sendSlack(type)}
                          disabled={sending}
                          className={`w-full py-2.5 rounded-lg border font-mono text-[11px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${
                            preview
                              ? 'border-veo-red/60 text-veo-red hover:bg-veo-red/10'
                              : 'border-veo-border text-veo-dim hover:border-veo-red/40 hover:text-veo-red'
                          }`}
                        >
                          {sending ? '📤 Sending...' : `🚀 Send ${label} to Slack`}
                        </button>
                      </div>
                    )
                  })()}

                  {/* ── Config section ── */}
                  {adminSection === 'config' && (() => {
                    // Use simulated date for the calendar when set, otherwise real today
                    const effectiveNow = simulatedDate ? new Date(simulatedDate + 'T12:00:00') : new Date()
                    const year = effectiveNow.getFullYear()
                    const month = effectiveNow.getMonth()
                    const daysInMonth = new Date(year, month + 1, 0).getDate()
                    const firstDayOfWeek = new Date(year, month, 1).getDay() // 0=Sun
                    // Shift so week starts Monday: Mon=0, Tue=1 ... Sun=6
                    const startOffset = (firstDayOfWeek + 6) % 7
                    const monthLabel = effectiveNow.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

                    const realTodayStr = (() => {
                      const now = new Date()
                      const y = now.getFullYear()
                      const m = String(now.getMonth() + 1).padStart(2, '0')
                      const d = String(now.getDate()).padStart(2, '0')
                      return `${y}-${m}-${d}`
                    })()
                    const todayStr = simulatedDate || realTodayStr

                    const toggleDay = (isoDate: string) => {
                      setAdminConfig(prev => {
                        const days = prev.activeDays.includes(isoDate)
                          ? prev.activeDays.filter(d => d !== isoDate)
                          : [...prev.activeDays, isoDate].sort()
                        return { ...prev, activeDays: days }
                      })
                    }

                    const selectWeekdays = () => {
                      const weekdays: string[] = []
                      for (let d = 1; d <= daysInMonth; d++) {
                        const date = new Date(year, month, d)
                        if (date.getDay() !== 0 && date.getDay() !== 6) {
                          const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                          weekdays.push(iso)
                        }
                      }
                      setAdminConfig(prev => ({ ...prev, activeDays: weekdays }))
                    }

                    return (
                      <div className="space-y-4">

                        {/* ── Date Simulator ── */}
                        <div className={`rounded-lg p-3 border ${simulatedDate ? 'border-yellow-500/40 bg-yellow-500/5' : 'border-veo-border'}`}>
                          <label className="block font-mono text-[9px] text-veo-dim uppercase tracking-wider mb-2">
                            Date Simulator
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={simulatedDate}
                              onChange={e => setSimulatedDate(e.target.value)}
                              className="veo-input px-2 py-1.5 rounded-lg text-xs font-mono flex-1"
                            />
                            <button
                              onClick={() => saveSimulatedDate(simulatedDate)}
                              disabled={simDateSaving || !simulatedDate}
                              className="px-3 py-1.5 rounded-lg border border-veo-green/60 text-veo-green font-mono text-[10px] font-bold hover:bg-veo-green/10 transition-all disabled:opacity-40"
                            >
                              Set
                            </button>
                            <button
                              onClick={() => saveSimulatedDate(null)}
                              disabled={simDateSaving || !simulatedDate}
                              className="px-3 py-1.5 rounded-lg border border-veo-border text-veo-dim font-mono text-[10px] hover:border-veo-red/40 hover:text-veo-red transition-all disabled:opacity-40"
                            >
                              Clear
                            </button>
                          </div>
                          {simulatedDate && (
                            <p className="font-mono text-[9px] text-yellow-400 mt-1.5">⚠ App is using simulated date: {simulatedDate}</p>
                          )}
                        </div>

                        {/* ── Double Points ── */}
                        <div className={`rounded-lg p-3 border ${adminConfig.doubleDayDate ? 'border-yellow-500/40 bg-yellow-500/5' : 'border-veo-border'}`}>
                          <label className="block font-mono text-[9px] text-veo-dim uppercase tracking-wider mb-2">
                            Double Points Day
                          </label>
                          {adminConfig.doubleDayDate ? (
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[11px] text-yellow-400">⚡ Active: {adminConfig.doubleDayDate}</span>
                              <button
                                onClick={async () => {
                                  if (!currentPlayer) return
                                  const res = await fetch('/api/admin/config', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ adminName: currentPlayer.name, clearDoubleDay: true }),
                                  })
                                  if (res.ok) {
                                    setAdminConfig(prev => ({ ...prev, doubleDayDate: null }))
                                    notify('Double points cleared')
                                    await fetchLeagueConfig()
                                  } else {
                                    notify('Failed to clear double points', 'red')
                                  }
                                }}
                                className="px-3 py-1 rounded border border-veo-border text-veo-dim font-mono text-[10px] hover:border-veo-red/40 hover:text-veo-red transition-colors"
                              >
                                Turn Off
                              </button>
                            </div>
                          ) : (
                            <p className="font-mono text-[10px] text-veo-dim">No double points active. Enable via Morning Briefing.</p>
                          )}
                        </div>

                        <div>
                          <label className="block font-mono text-[9px] text-veo-dim uppercase tracking-wider mb-1">
                            Top N scores count toward ranking
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number" min={1} max={31}
                              value={adminConfig.scoreCount}
                              onChange={e => setAdminConfig(prev => ({ ...prev, scoreCount: Math.max(1, parseInt(e.target.value) || 1) }))}
                              className="veo-input w-20 px-3 py-2 rounded-lg text-sm text-center font-display font-700"
                            />
                            <span className="font-mono text-[10px] text-veo-dim">best scores per month</span>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-[9px] text-veo-dim uppercase tracking-wider">{monthLabel} active days</span>
                            <div className="flex gap-1">
                              <button onClick={selectWeekdays} className="px-2 py-1 rounded border border-veo-border text-veo-dim font-mono text-[9px] hover:border-veo-muted transition-colors">
                                Weekdays
                              </button>
                              <button onClick={() => setAdminConfig(prev => ({ ...prev, activeDays: [] }))} className="px-2 py-1 rounded border border-veo-border text-veo-dim font-mono text-[9px] hover:border-veo-red/40 hover:text-veo-red transition-colors">
                                Clear
                              </button>
                            </div>
                          </div>

                          {/* Calendar grid */}
                          <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
                            {['M','T','W','T','F','S','S'].map((d, i) => (
                              <div key={i} className="font-mono text-[9px] text-veo-dim py-1">{d}</div>
                            ))}
                          </div>
                          <div className="grid grid-cols-7 gap-0.5">
                            {Array.from({ length: startOffset }).map((_, i) => (
                              <div key={`pad-${i}`} />
                            ))}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                              const day = i + 1
                              const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                              const isActive = adminConfig.activeDays.includes(iso)
                              const isToday = iso === todayStr
                              const dayOfWeek = new Date(year, month, day).getDay()
                              const isFriday = dayOfWeek === 5
                              return (
                                <button
                                  key={day}
                                  onClick={() => toggleDay(iso)}
                                  className={`h-7 rounded text-[10px] font-mono font-bold transition-all ${
                                    isActive
                                      ? 'bg-veo-green text-black'
                                      : isToday
                                      ? 'border border-veo-green/40 text-veo-green'
                                      : 'border border-veo-border text-veo-dim hover:border-veo-muted'
                                  }`}
                                >
                                  {day}{isFriday ? '⚡' : ''}
                                </button>
                              )
                            })}
                          </div>
                          <p className="font-mono text-[9px] text-veo-dim mt-1">{adminConfig.activeDays.length} days selected · ⚡ = Friday</p>
                        </div>

                        <button
                          onClick={saveAdminConfig}
                          disabled={configSaving}
                          className="w-full py-2.5 rounded-lg border border-veo-red/60 text-veo-red font-mono text-[11px] font-bold uppercase tracking-wider hover:bg-veo-red/10 transition-all disabled:opacity-50"
                        >
                          {configSaving ? 'Saving...' : '💾 Save League Config'}
                        </button>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── SUBMIT ─── */}
        {activeTab === 'submit' && (
          <div className="max-w-md mx-auto">
            <div className="bento-card p-6">
              <div className="flex items-center gap-2 mb-6">
                <Zap size={16} className="text-veo-green"/>
                <span className="font-display text-xl font-700 tracking-wide text-white uppercase">Submit Daily Score</span>
              </div>
              {!currentPlayer ? (
                <div className="text-center py-8">
                  <p className="font-mono text-sm text-veo-dim mb-2">Select a player first</p>
                  <button onClick={()=>setActiveTab('leaderboard')} className="text-veo-green font-mono text-xs hover:underline">← Back to sign in</button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 p-3 bg-black rounded-xl border border-veo-green/30 mb-4">
                    <span className="text-2xl">{currentPlayer.countryFlag}</span>
                    <span className="font-display text-lg font-700 text-veo-green">{currentPlayer.name}</span>
                    <Star size={12} className="text-veo-green ml-auto"/>
                  </div>
                  {leagueConfig.isDoubleDay && (
                    <div className="mb-4 p-3 rounded-xl border border-yellow-400/40 bg-yellow-400/5 text-center">
                      <div className="font-display text-lg font-900 text-yellow-400 tracking-wider">⚡ DOUBLE POINTS DAY</div>
                      <div className="font-mono text-[10px] text-yellow-400/70 mt-0.5">Today&apos;s score counts TWICE in the standings</div>
                    </div>
                  )}
                  <div className="space-y-4 mb-6">
                    {[{label:'Round 1',val:r1,set:setR1},{label:'Round 2',val:r2,set:setR2},{label:'Round 3',val:r3,set:setR3}].map(({label,val,set})=>(
                      <div key={label}>
                        <label className="block font-mono text-[10px] text-veo-dim mb-1.5 uppercase tracking-wider">{label} <span className="text-veo-muted">/ 5,000</span></label>
                        <input type="number" min={0} max={5000} value={val} onChange={e=>set(e.target.value)} placeholder="0"
                          className="veo-input w-full px-4 py-3 rounded-xl text-2xl font-display font-700 text-center"/>
                        <div className="mt-1.5 h-1.5 rounded-full bg-veo-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-300" style={{
                            width:`${Math.min(((parseInt(val)||0)/5000)*100,100)}%`,
                            background:(parseInt(val)||0)>=4500?'#30FF51':'#3a4a5a'
                          }}/>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 rounded-xl border border-veo-green/30 bg-veo-green/5 mb-6 text-center">
                    <div className="font-mono text-[10px] text-veo-dim uppercase tracking-wider mb-1">Total Score</div>
                    <div className={`font-display text-5xl font-900 ${total>0?'text-veo-green':'text-veo-muted'}`}>{total.toLocaleString()}</div>
                    <div className="font-mono text-[10px] text-veo-dim mt-1">/ 15,000</div>
                    {total >= 14800 && (
                      <div className="mt-2">
                        <ScoreTag total={total} />
                      </div>
                    )}
                    {total > 0 && total < 6000 && (
                      <div className="mt-2 font-mono text-[10px] text-veo-red">⚠️ Sub-6000 incoming — brace for shame</div>
                    )}
                  </div>
                  <button onClick={submitScore} disabled={total===0}
                    className="w-full py-3 rounded-xl bg-veo-green text-black font-display text-lg font-900 tracking-wider hover:bg-veo-green/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                    <Check size={18}/> SUBMIT SCORE
                  </button>
                </>
              )}
            </div>
          </div>
        )}


        {/* ─── HISTORY ─── */}
        {activeTab === 'history' && (
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={16} className="text-veo-green" />
              <span className="font-display text-xl font-700 tracking-wide text-white uppercase">Score History</span>
              <span className="ml-auto font-mono text-[10px] text-veo-dim">This month</span>
              <button onClick={fetchHistoryScores} className="p-1.5 rounded-lg border border-veo-border text-veo-dim hover:text-veo-green transition-colors">
                <RefreshCw size={12} />
              </button>
            </div>
            {(() => {
              if (!historyLoaded) return (
                <div className="bento-card p-8 text-center font-mono text-xs text-veo-dim">Loading history...</div>
              )
              if (historyScores.length === 0) return (
                <div className="bento-card p-8 text-center font-mono text-xs text-veo-dim">No scores yet this month</div>
              )
              // Group by date
              const groups = new Map<string, Score[]>()
              for (const s of historyScores) {
                const dateKey = new Date(s.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
                if (!groups.has(dateKey)) groups.set(dateKey, [])
                groups.get(dateKey)!.push(s)
              }
              return (
                <div className="space-y-4">
                  {Array.from(groups.entries()).map(([dateLabel, scores]) => (
                    <div key={dateLabel} className="bento-card p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="font-display text-sm font-700 text-veo-green tracking-wide">{dateLabel}</span>
                        {scores[0]?.isDoubleDay && (
                          <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border border-yellow-400/50 text-yellow-400 bg-yellow-400/10">⚡ ×2</span>
                        )}
                        <span className="ml-auto font-mono text-[10px] text-veo-dim">{scores.length} submitted</span>
                      </div>
                      <div className="space-y-1.5">
                        {scores.map((score, i) => (
                          <div key={score.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-veo-border bg-black">
                            <span className="font-mono text-sm w-6 text-center text-veo-dim">{['🥇','🥈','🥉'][i] ?? `${i+1}.`}</span>
                            <span className="text-lg">{score.player.countryFlag}</span>
                            <span className="font-mono text-xs text-veo-text flex-1 truncate">{score.player.name}</span>
                            <div className="flex items-center gap-1.5">
                              {score.isDoubleDay && <span className="font-mono text-[9px] text-yellow-400">⚡</span>}
                              {score._count.redCards > 0 && <span className="font-mono text-[9px] text-veo-red">🟥×{score._count.redCards}</span>}
                              <span className="font-display text-base font-700 text-white">{score.total.toLocaleString()}</span>
                            </div>
                            <div className="hidden sm:flex gap-1 text-veo-dim font-mono text-[9px]">
                              <span>{score.round1.toLocaleString()}</span>
                              <span>·</span>
                              <span>{score.round2.toLocaleString()}</span>
                              <span>·</span>
                              <span>{score.round3.toLocaleString()}</span>
                            </div>
                            {isLeoAdmin && (
                              <button
                                onClick={() => deleteScore(score.id, score.player.name)}
                                className="p-1 rounded border border-veo-red/30 text-veo-red hover:bg-veo-red/10 transition-colors flex-shrink-0"
                                title="Delete score"
                              >
                                <X size={10}/>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}

        {/* ─── ARCHIVE ─── */}
        {activeTab === 'archive' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bento-card p-4">
              <div className="flex items-center gap-2 mb-4">
                <Archive size={14} className="text-veo-green"/>
                <span className="font-display text-lg font-700 tracking-wide text-white uppercase">Season Archive</span>
              </div>
              {archiveMonths.length === 0 ? (
                <p className="text-veo-dim font-mono text-xs text-center py-6">No past seasons yet</p>
              ) : (
                <div className="space-y-2">
                  {archiveMonths.map(m => (
                    <button key={`${m.year}-${m.month}`}
                      onClick={() => { setSelectedArchive(m); fetchLeaderboard(m.year,m.month) }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border font-mono text-sm transition-all ${
                        selectedArchive?.year===m.year&&selectedArchive?.month===m.month
                          ? 'border-veo-green/40 bg-veo-green/10 text-veo-green'
                          : 'border-veo-border text-veo-text hover:border-veo-muted'
                      }`}>
                      <div className="flex items-center justify-between">
                        <span>{m.label}</span>
                        <ChevronDown size={12} className={selectedArchive?.year===m.year&&selectedArchive?.month===m.month?'rotate-180':''}/>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="lg:col-span-2 bento-card p-4">
              {!selectedArchive ? (
                <div className="flex items-center justify-center h-full min-h-48">
                  <p className="font-mono text-sm text-veo-dim">← Select a month to view</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy size={14} className="text-veo-green"/>
                    <span className="font-display text-lg font-700 tracking-wide text-white uppercase">{selectedArchive.label} Results</span>
                  </div>
                  <div className="space-y-2">
                    {archiveStandings.map((s,i) => (
                      <div key={s.id} className={`p-3 rounded-xl border flex items-center gap-3 ${i===0?'border-veo-green/30 bg-veo-green/5':'border-veo-border'}`}>
                        <div className={`w-8 text-center font-display text-xl font-900 ${i===0?'rank-1':i===1?'rank-2':i===2?'rank-3':'text-veo-dim'}`}>#{i+1}</div>
                        <span className="text-2xl">{s.countryFlag}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-display text-base font-700 text-white">{s.name}</span>
                            {s.isMvp && <span>🏆</span>}
                            <FormBadge streak={s.formStreak} />
                            {s.redCardCount > 0 && (
                              <span className="font-mono text-[10px] text-veo-red bg-veo-red/10 px-1.5 py-0.5 rounded border border-veo-red/20">🟥 ×{s.redCardCount}</span>
                            )}
                          </div>
                          <span className="font-mono text-[10px] text-veo-dim">{s.gamesPlayed} games played</span>
                        </div>
                        <div className="text-right">
                          <div className={`font-display text-xl font-900 ${i===0?'text-veo-green':'text-white'}`}>{s.monthlyAverage.toFixed(0)}</div>
                          <div className="font-mono text-[9px] text-veo-dim">avg</div>
                        </div>
                      </div>
                    ))}
                    {archiveStandings.length===0&&<p className="text-center text-veo-dim font-mono text-sm py-6">No data for this month</p>}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ─── HALL OF FAME ─── */}
        {activeTab === 'wins' && (
          <div className="space-y-4">
            <div className="bento-card p-4">
              <div className="flex items-center gap-2 mb-6">
                <Award size={14} className="text-veo-green"/>
                <span className="font-display text-lg font-700 tracking-wide text-white uppercase">Hall of Fame</span>
                <span className="ml-auto font-mono text-[10px] text-veo-dim">MONTHLY CHAMPIONS</span>
              </div>
              {!winsLoaded ? (
                <p className="text-center text-veo-dim font-mono text-sm py-8">Loading…</p>
              ) : monthlyWins.length === 0 ? (
                <p className="text-center text-veo-dim font-mono text-sm py-8">No monthly champions yet — first month still in progress</p>
              ) : (
                <div className="space-y-3">
                  {monthlyWins.map((entry, i) => (
                    <div key={entry.id} className={`p-4 rounded-xl border ${i === 0 ? 'border-yellow-500/40 bg-yellow-500/5' : 'border-veo-border'}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">{entry.countryFlag}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-display text-base font-700 text-white">{entry.name}</span>
                            {i === 0 && <span className="font-mono text-[10px] text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20">MOST TITLES</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-display text-3xl font-900 ${i === 0 ? 'text-yellow-400' : 'text-veo-green'}`}>{entry.winCount}</div>
                          <div className="font-mono text-[9px] text-veo-dim">{entry.winCount === 1 ? 'WIN' : 'WINS'}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {entry.months.map(mo => (
                          <span key={`${mo.year}-${mo.month}`} className="font-mono text-[10px] px-2 py-1 rounded border border-veo-border text-veo-dim">
                            🏆 {mo.label} <span className="text-veo-green">{mo.avgScore.toFixed(0)} avg</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TITLE RACE ─── */}
        {activeTab === 'titlerace' && (
          <div className="space-y-4">
            <div className="bento-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart2 size={14} className="text-veo-green"/>
                <span className="font-display text-lg font-700 tracking-wide text-white uppercase">Title Race</span>
                <button onClick={fetchTitleRace} className="ml-auto p-1.5 rounded-lg border border-veo-border text-veo-dim hover:text-veo-green transition-colors">
                  <RefreshCw size={12}/>
                </button>
              </div>
              <p className="font-mono text-[10px] text-veo-dim mb-4">Average score progression — day by day this month</p>
              {!titleRaceLoaded ? (
                <p className="text-center text-veo-dim font-mono text-sm py-8">Loading…</p>
              ) : !titleRace || titleRace.days.length === 0 ? (
                <p className="text-center text-veo-dim font-mono text-sm py-8">No scores submitted yet this month</p>
              ) : (
                <TitleRaceChart data={titleRace} />
              )}
            </div>
          </div>
        )}

      </div>

      <footer className="border-t border-veo-border mt-12 py-4 text-center">
        <p className="font-mono text-[10px] text-veo-dim tracking-widest uppercase">Veo Geo League · Powered by Honor System · No Excuses</p>
      </footer>
    </div>
  )
}
