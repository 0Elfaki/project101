import { useState, useEffect, useMemo } from 'react'
import './App.css'

const API_URL = 'http://16.170.220.228:3000'
const USER_ID = '330595a4-7fab-40e6-a501-d03d2de25b43'

function App() {
  const [originalUrl, setOriginalUrl] = useState('')
  const [affiliateNetwork, setAffiliateNetwork] = useState('amazon')
  const [smartLinks, setSmartLinks] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingLinks, setLoadingLinks] = useState(true)

  const [expandedLinks, setExpandedLinks] = useState({})
  const [selectedCategory, setSelectedCategory] = useState('all')

  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState('newest')

  // NEW: analytics state
  const [analytics, setAnalytics] = useState(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(true)

  useEffect(() => {
    fetchUserLinks()
    fetchAnalytics()
  }, [])

  const fetchUserLinks = async () => {
    setLoadingLinks(true)
    try {
      const response = await fetch(`${API_URL}/api/smart-links/user/${USER_ID}`)
      const data = await response.json()
      if (data.success) {
        setSmartLinks(data.links || data.smart_links || [])
      }
    } catch (error) {
      console.error('Error loading links:', error)
    }
    setLoadingLinks(false)
  }

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true)
    try {
      const response = await fetch(`${API_URL}/api/analytics/summary/${USER_ID}`)
      const data = await response.json()
      if (data.success) setAnalytics(data)
    } catch (error) {
      console.error('Error loading analytics:', error)
    }
    setLoadingAnalytics(false)
  }

  const createSmartLink = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/smart-links/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: USER_ID,
          original_url: originalUrl,
          affiliate_network: affiliateNetwork
        })
      })
      const data = await response.json()
      if (data.success) {
        setSmartLinks([data.smart_link, ...smartLinks])
        setOriginalUrl('')
        alert('Smart link created!')
        // refresh analytics after creating a link (optional)
        fetchAnalytics()
      }
    } catch (error) {
      alert('Error creating link: ' + error.message)
    }
    setLoading(false)
  }

  const copyToClipboard = async (text) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        alert('✅ Copied')
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        alert('✅ Copied')
      }
    } catch (err) {
      alert('❌ Copy failed')
    }
  }

  const toggleExpand = (linkId) => {
    setExpandedLinks(prev => ({ ...prev, [linkId]: !prev[linkId] }))
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getProductInfo = (url) => {
    const u = (url || '').toLowerCase()
    if (u.includes('iphone')) return 'iPhone'
    if (u.includes('apple')) return 'Apple'
    if (u.includes('samsung')) return 'Samsung'
    if (u.includes('laptop')) return 'Laptop'
    return 'Product'
  }

  const getDomain = (url) => {
    try {
      return new URL(url).hostname.replace('www.', '')
    } catch {
      return ''
    }
  }

  const categories = ['all', 'amazon', 'trendyol']

  const filteredLinks = useMemo(() => {
    const q = query.trim().toLowerCase()

    let list = selectedCategory === 'all'
      ? [...smartLinks]
      : smartLinks.filter(l => l.affiliate_network === selectedCategory)

    if (q) {
      list = list.filter(l => {
        const original = (l.original_url || '').toLowerCase()
        const shortUrl = (l.short_url || '').toLowerCase()
        const clickId = (l.click_id || '').toLowerCase()
        const network = (l.affiliate_network || '').toLowerCase()
        const domain = getDomain(l.original_url).toLowerCase()
        const product = getProductInfo(l.original_url).toLowerCase()
        return (
          original.includes(q) ||
          shortUrl.includes(q) ||
          clickId.includes(q) ||
          network.includes(q) ||
          domain.includes(q) ||
          product.includes(q)
        )
      })
    }

    list.sort((a, b) => {
      const da = new Date(a.created_at || 0).getTime()
      const db = new Date(b.created_at || 0).getTime()
      return sortMode === 'oldest' ? da - db : db - da
    })

    return list
  }, [smartLinks, selectedCategory, query, sortMode])

  return (
    <div className="app">
      <h1>🔗 Zatii - Smart Link Manager</h1>

      {/* Analytics */}
      <div className="analytics-section">
        <div className="analytics-header">
          <h2>Analytics</h2>
          <button className="mini-btn" onClick={fetchAnalytics} disabled={loadingAnalytics}>
            {loadingAnalytics ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {loadingAnalytics && <p className="loading-message">🔄 Loading analytics...</p>}

        {!loadingAnalytics && analytics && (
          <>
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-label">Total clicks</div>
                <div className="kpi-value">{analytics.total_clicks}</div>
              </div>

              <div className="kpi-card">
                <div className="kpi-label">Top link clicks (30d)</div>
                <div className="kpi-value">{analytics.top_links?.[0]?.clicks || 0}</div>
              </div>

              <div className="kpi-card">
                <div className="kpi-label">Days tracked (7d)</div>
                <div className="kpi-value">{analytics.clicks_last_7_days?.length || 0}</div>
              </div>
            </div>

            <div className="analytics-panels">
              <div className="panel">
                <h3>Top links</h3>
                {analytics.top_links?.length ? analytics.top_links.map((l) => (
                  <div key={l.id} className="top-link-row">
                    <div className="top-link-left">
                      <div className="top-link-code">{l.short_code}</div>
                      <div className="top-link-meta">
                        <span className="pill">{l.affiliate_network}</span>
                        <span className="pill">{getDomain(l.original_url) || 'unknown'}</span>
                      </div>
                    </div>
                    <div className="top-link-right">
                      <div className="top-link-clicks">{l.clicks}</div>
                      <div className="top-link-clicks-label">clicks</div>
                    </div>
                  </div>
                )) : <p className="empty-message">No clicks yet.</p>}
              </div>

              <div className="panel">
                <h3>Last 7 days</h3>
                {analytics.clicks_last_7_days?.length ? analytics.clicks_last_7_days.map((d) => (
                  <div key={d.date} className="day-row">
                    <div className="day-date">{d.date}</div>
                    <div className="day-count">{d.clicks}</div>
                  </div>
                )) : <p className="empty-message">No data yet.</p>}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create */}
      <div className="create-section">
        <h2>Create Smart Link</h2>
        <input
          type="url"
          placeholder="Enter your affiliate URL"
          value={originalUrl}
          onChange={(e) => setOriginalUrl(e.target.value)}
        />
        <select value={affiliateNetwork} onChange={(e) => setAffiliateNetwork(e.target.value)}>
          <option value="amazon">Amazon</option>
          <option value="trendyol">Trendyol</option>
        </select>
        <button onClick={createSmartLink} disabled={loading || !originalUrl}>
          {loading ? 'Creating...' : 'Create Smart Link'}
        </button>
      </div>

      {/* Links */}
      <div className="links-section">
        <div className="section-header">
          <h2>Your Smart Links ({filteredLinks.length})</h2>

          <div className="category-filters">
            {categories.map(cat => (
              <button
                key={cat}
                className={`filter-btn ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat === 'all' ? '🌐 All' : cat === 'amazon' ? '📦 Amazon' : '🛍️ Trendyol'}
              </button>
            ))}
          </div>
        </div>

        <div className="toolbar">
          <input
            className="search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search: product, domain, click id, url..."
          />

          <select
            className="sort-select"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>

        {loadingLinks && <p className="loading-message">🔄 Loading your links...</p>}

        {!loadingLinks && filteredLinks.length === 0 && (
          <p className="empty-message">No links match this filter/search.</p>
        )}

        {!loadingLinks && filteredLinks.map(link => (
          <div key={link.id} className="link-card">
            <div className="link-header">
              <strong>Short URL</strong>
              <button className="copy-btn" onClick={() => copyToClipboard(link.short_url)}>
                📋 Copy
              </button>
            </div>

            <p className="short-url">
              <a href={link.short_url} target="_blank" rel="noopener noreferrer">{link.short_url}</a>
            </p>

            <div className="tags-container">
              <span className="tag network-tag">{link.affiliate_network}</span>
              <span className="tag date-tag">📅 {formatDate(link.created_at)}</span>
              <span className="tag product-tag">🏷️ {getProductInfo(link.original_url)}</span>
              <span className="tag domain-tag">🌍 {getDomain(link.original_url) || 'unknown'}</span>
            </div>

            <div className="collapsible-section">
              <button className="expand-btn" onClick={() => toggleExpand(link.id)}>
                {expandedLinks[link.id] ? '▼' : '▶'} Original URL
              </button>

              {expandedLinks[link.id] && (
                <div className="expanded-content">
                  <p className="original-url-expanded">{link.original_url}</p>
                </div>
              )}
            </div>

            <p className="click-id">🔑 {link.click_id}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
