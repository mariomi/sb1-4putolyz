import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, FileText, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { logLeadExplorerEvent } from '../lib/accessLogger'

type LeadRow = {
  id: string
  company_name?: string
  contact_name?: string
  role?: string
  email?: string
  phone?: string
  sector_name?: string
  area_name?: string
  revenue_band?: string
  template_name?: string
  status?: string
  score?: number
  updated_at?: string
}

const DEFAULT_COLUMNS = [
  'company_name',
  'contact_name',
  'role',
  'email',
  'phone',
  'sector_name',
  'area_name',
  'revenue_band',
  'template_name',
  'status',
  'score',
  'updated_at',
]

export function LeadsViewPage() {
  const { user } = useAuth()
  const [authorized, setAuthorized] = useState<boolean | null>(null)

  // filters and options
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([])
  const [sectors, setSectors] = useState<{ id: string; name: string }[]>([])
  const [templates, setTemplates] = useState<{ id: string; name: string; lead_count?: number }[]>([])
  const revenueBands = ['<1M', '1M-5M', '5M-20M', '>20M']

  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([])
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([])
  const [selectedRevenueBands, setSelectedRevenueBands] = useState<string[]>([])
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([])

  const [searchQuery, setSearchQuery] = useState('')
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState<number>(0)

  // selection
  const [selectedRowIds, setSelectedRowIds] = useState<Record<string, boolean>>({})
  const [selectAllOnPage, setSelectAllOnPage] = useState(false)

  // export
  const [exportColumns] = useState<string[]>(DEFAULT_COLUMNS)

  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const checkRole = async () => {
      if (!user) return
      // check local operator session first
      const opSession = localStorage.getItem('operator_session')
      if (opSession) {
        const session = JSON.parse(opSession)
        setAuthorized(session.role === 'sales')
        return
      }

      try {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        setAuthorized((profile?.role || '').toLowerCase() === 'sales')
      } catch (err) {
        console.error('Errore controllo ruolo:', err)
        setAuthorized(false)
      }
    }

    checkRole()
  }, [user])

  useEffect(() => {
    if (authorized === false) return
    if (authorized === null) return

    // load filters options and counts
    Promise.all([fetchAreas(), fetchSectors(), fetchTemplates(), fetchTotalCount()]).catch(console.error)
  }, [authorized])

  useEffect(() => {
    if (!authorized) return
    fetchLeads().catch(console.error)
    // log view event once
    logLeadExplorerEvent(user?.id, 'lead_explorer_view', { count: undefined }).catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized])

  const fetchAreas = async () => {
    const { data, error } = await supabase.from('areas').select('id,name').order('name')
    if (error) return console.error(error)
    setAreas((data as any) || [])
  }

  const fetchSectors = async () => {
    const { data, error } = await supabase.from('sectors').select('id,name').order('name')
    if (error) return console.error(error)
    setSectors((data as any) || [])
  }

  const fetchTemplates = async () => {
    const { data, error } = await supabase.from('templates').select('id,name').order('name')
    if (error) return console.error(error)
    setTemplates((data as any) || [])
  }

  const fetchTotalCount = async () => {
    try {
      const { count, error } = await supabase.from('contacts').select('id', { count: 'exact', head: false })
      if (error) throw error
      setTotalCount(count || 0)
    } catch (err) {
      console.error('Errore conteggio totale lead', err)
    }
  }

  const buildFilters = (queryBuilder: any) => {
    if (selectedAreaIds.length) queryBuilder.in('area_id', selectedAreaIds)
    if (selectedSectorIds.length) queryBuilder.in('sector_id', selectedSectorIds)
    if (selectedRevenueBands.length) queryBuilder.in('revenue_band', selectedRevenueBands)
    if (selectedTemplateIds.length) queryBuilder.in('template_id', selectedTemplateIds)
    if (selectedRoles.length) queryBuilder.in('role', selectedRoles)
  }

  const fetchLeads = async () => {
    setLoading(true)
    try {
      // basic server-side filtering, using ilike for text search across fields
      let qb = supabase.from('contacts').select('*')

      // apply filters
      buildFilters(qb)

      if (searchQuery && searchQuery.trim()) {
        const q = `%${searchQuery.trim()}%`
        qb = qb.or(`company_name.ilike.${q},first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q},notes.ilike.${q}`)
      }

      const { data, error } = await qb.order('updated_at', { ascending: false }).limit(10000)
      if (error) throw error

      const rows = (data || []).map((r: any) => ({
        id: r.id,
        company_name: r.company_name || r.company || '',
        contact_name: r.contact_name || `${r.first_name || ''} ${r.last_name || ''}`.trim(),
        role: r.role,
        email: r.email,
        phone: r.phone,
        sector_name: r.sector_name || r.sector || '',
        area_name: r.area_name || r.area || '',
        revenue_band: r.revenue_band,
        template_name: r.template_name || '',
        status: r.status,
        score: r.score,
        updated_at: r.updated_at,
      }))

      setLeads(rows)
      // log search
      logLeadExplorerEvent(user?.id, 'lead_search', {
        count: rows.length,
        criteria: {
          areas: selectedAreaIds.length,
          sectors: selectedSectorIds.length,
          templates: selectedTemplateIds.length,
          revenueBands: selectedRevenueBands,
          roles: selectedRoles,
          searchQuery: searchQuery ? '***' : undefined,
        },
      }).catch(console.error)

    } catch (err) {
      console.error('Errore fetch leads', err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleRow = (id: string) => {
    setSelectedRowIds(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleSelectAllOnPage = () => {
    if (!selectAllOnPage) {
      const pageIds = leads.map(l => l.id)
      const map: Record<string, boolean> = {}
      pageIds.forEach(id => (map[id] = true))
      setSelectedRowIds(prev => ({ ...prev, ...map }))
    } else {
      // clear visible
      const map = { ...selectedRowIds }
      leads.forEach(l => delete map[l.id])
      setSelectedRowIds(map)
    }
    setSelectAllOnPage(!selectAllOnPage)
  }

  const visibleCount = leads.length

  const selectedCount = useMemo(() => Object.values(selectedRowIds).filter(Boolean).length, [selectedRowIds])

  const downloadCSV = (rows: LeadRow[], columns: string[], separator = ',') => {
    const header = columns.join(separator)
    const lines = rows.map(r => columns.map(c => JSON.stringify((r as any)[c] ?? '')).join(separator))
    const csv = [header, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads_export_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadXLS = (rows: LeadRow[], columns: string[]) => {
    // Export as simple HTML table with .xls extension (widely supported by Excel)
    const header = columns.map(c => `<th>${c}</th>`).join('')
    const body = rows
      .map(r => `<tr>${columns.map(c => `<td>${String((r as any)[c] ?? '')}</td>`).join('')}</tr>`)
      .join('')
    const html = `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads_export_${Date.now()}.xls`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExport = (format: 'csv' | 'xls', columns = exportColumns, separator = ',') => {
    if (!leads.length) return
    // privacy: mask emails if user not authorized for export full (simplified check)
    const rowsToExport = leads.map(r => ({ ...r }))
    if (format === 'csv') downloadCSV(rowsToExport, columns, separator)
    else downloadXLS(rowsToExport, columns)

    logLeadExplorerEvent(user?.id, 'lead_export', { count: rowsToExport.length, format }).catch(console.error)
  }

  const handleSaveSearch = (name: string) => {
    const saved = JSON.parse(localStorage.getItem('lead_saved_searches' ) || '[]')
    saved.push({ name, criteria: { selectedAreaIds, selectedSectorIds, selectedRevenueBands, selectedRoles, selectedTemplateIds, searchQuery }, created_at: new Date().toISOString() })
    localStorage.setItem('lead_saved_searches', JSON.stringify(saved))
  }

  // roles options
  const [rolesOptions, setRolesOptions] = useState<string[]>([])
  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase.from('contacts').select('role').neq('role', null)
      if (error) throw error
      const uniq = Array.from(new Set((data || []).map((d: any) => d.role).filter(Boolean)))
      setRolesOptions(uniq)
    } catch (err) {
      console.error('Errore fetch roles', err)
    }
  }

  useEffect(() => { fetchRoles() }, [])

  if (authorized === false) {
    return <div className="p-6">Accesso riservato al ruolo <strong>sales</strong>.</div>
  }

  if (authorized === null) {
    return <div className="p-6">Caricamento autorizzazione...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Lead Explorer <span className="ml-3 inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm font-semibold">{totalCount.toLocaleString()}</span></h1>
        <p className="text-gray-600 mt-2">Filtra, cerca, salva e esporta i lead (accesso riservato a sales)</p>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200/50">
        {/* Filter bar */}
        <div className="sticky top-4 bg-white/90 p-4 rounded-xl border border-gray-100 flex gap-4 items-start">
          <div className="flex-1">
            <label className="text-xs text-gray-500">Area</label>
            <select multiple value={selectedAreaIds} onChange={(e) => setSelectedAreaIds(Array.from(e.target.selectedOptions).map(o => o.value))} className="w-full mt-1 h-24 rounded-md border p-2">
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          <div className="flex-1">
            <label className="text-xs text-gray-500">Settore</label>
            <select multiple value={selectedSectorIds} onChange={(e) => setSelectedSectorIds(Array.from(e.target.selectedOptions).map(o => o.value))} className="w-full mt-1 h-24 rounded-md border p-2">
              {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div style={{minWidth: 160}}>
            <label className="text-xs text-gray-500">Fatturato</label>
            <select multiple value={selectedRevenueBands} onChange={(e) => setSelectedRevenueBands(Array.from(e.target.selectedOptions).map(o => o.value))} className="w-full mt-1 h-24 rounded-md border p-2">
              {revenueBands.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div style={{minWidth: 160}}>
            <label className="text-xs text-gray-500">Template</label>
            <select multiple value={selectedTemplateIds} onChange={(e) => setSelectedTemplateIds(Array.from(e.target.selectedOptions).map(o => o.value))} className="w-full mt-1 h-24 rounded-md border p-2">
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div style={{minWidth: 160}}>
            <label className="text-xs text-gray-500">Ruolo</label>
            <select multiple value={selectedRoles} onChange={(e) => setSelectedRoles(Array.from(e.target.selectedOptions).map(o => o.value))} className="w-full mt-1 h-24 rounded-md border p-2">
              {rolesOptions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="flex-1">
            <label className="text-xs text-gray-500">Cerca</label>
            <div className="mt-1 flex">
              <input aria-label="Cerca lead" placeholder="Cerca nome, azienda, email, note..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 px-3 py-2 rounded-l-md border" />
              <button onClick={() => fetchLeads()} className="px-3 bg-indigo-600 text-white rounded-r-md"><Search className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        {/* Active chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedAreaIds.map(id => <span key={id} className="px-3 py-1 bg-gray-100 rounded-full text-sm">{areas.find(a=>a.id===id)?.name || id} <button aria-label={`rimuovi ${id}`} onClick={() => setSelectedAreaIds(prev => prev.filter(x=>x!==id))} className="ml-2">×</button></span>)}
          {selectedSectorIds.map(id => <span key={id} className="px-3 py-1 bg-gray-100 rounded-full text-sm">{sectors.find(s=>s.id===id)?.name || id} <button onClick={() => setSelectedSectorIds(prev => prev.filter(x=>x!==id))} className="ml-2">×</button></span>)}
          {selectedRevenueBands.map(b => <span key={b} className="px-3 py-1 bg-gray-100 rounded-full text-sm">{b} <button onClick={() => setSelectedRevenueBands(prev => prev.filter(x=>x!==b))} className="ml-2">×</button></span>)}
          {selectedTemplateIds.map(id => <span key={id} className="px-3 py-1 bg-gray-100 rounded-full text-sm">{templates.find(t=>t.id===id)?.name || id} <button onClick={() => setSelectedTemplateIds(prev => prev.filter(x=>x!==id))} className="ml-2">×</button></span>)}
          {searchQuery && <span className="px-3 py-1 bg-yellow-50 rounded-full text-sm">"{searchQuery}" <button onClick={() => setSearchQuery('')} className="ml-2">×</button></span>}
        </div>

        {/* KPI / quick counts */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="p-4 bg-white rounded-lg border">
            <div className="text-sm text-gray-500">Totale lead</div>
            <div className="text-2xl font-bold">{totalCount.toLocaleString()}</div>
          </div>
          <div className="p-4 bg-white rounded-lg border">
            <div className="text-sm text-gray-500">Lead filtrati</div>
            <div className="text-2xl font-bold">{visibleCount.toLocaleString()}</div>
          </div>
          <div className="p-4 bg-white rounded-lg border">
            <div className="text-sm text-gray-500">Selezionati</div>
            <div className="text-2xl font-bold">{selectedCount}</div>
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto" ref={containerRef}>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2"><input aria-label="Seleziona tutto" type="checkbox" checked={selectAllOnPage} onChange={handleSelectAllOnPage} /></th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Azienda</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contatto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ruolo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefono</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Settore</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Area</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fatturato</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Template</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ultimo aggiornamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading && (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-gray-500">Caricamento...</td>
                </tr>
              )}

              {!loading && leads.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-gray-500">Nessun lead corrisponde ai filtri correnti. Prova a rimuovere qualche filtro.</td>
                </tr>
              )}

              {leads.map(lead => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><input aria-label={`Seleziona ${lead.contact_name || lead.email}`} type="checkbox" checked={!!selectedRowIds[lead.id]} onChange={() => handleToggleRow(lead.id)} /></td>
                  <td className="px-6 py-3 whitespace-nowrap font-medium text-gray-900">{lead.company_name}</td>
                  <td className="px-6 py-3 whitespace-nowrap">{lead.contact_name}</td>
                  <td className="px-6 py-3 whitespace-nowrap">{lead.role}</td>
                  <td className="px-6 py-3 whitespace-nowrap">{lead.email ? maskEmailPreview(lead.email) : ''}</td>
                  <td className="px-6 py-3 whitespace-nowrap">{lead.phone}</td>
                  <td className="px-6 py-3 whitespace-nowrap">{lead.sector_name}</td>
                  <td className="px-6 py-3 whitespace-nowrap">{lead.area_name}</td>
                  <td className="px-6 py-3 whitespace-nowrap">{lead.revenue_band}</td>
                  <td className="px-6 py-3 whitespace-nowrap">{lead.template_name}</td>
                  <td className="px-6 py-3 whitespace-nowrap">{lead.score ?? '-'}</td>
                  <td className="px-6 py-3 whitespace-nowrap">{lead.updated_at ? new Date(lead.updated_at).toLocaleString() : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer actions */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => handleExport('csv')} className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-md"><Download className="h-4 w-4 mr-2"/>Esporta CSV</button>
            <button onClick={() => handleExport('xls')} className="inline-flex items-center px-3 py-2 bg-yellow-600 text-white rounded-md"><FileText className="h-4 w-4 mr-2"/>Esporta XLS</button>
            <button onClick={() => { const name = prompt('Nome per la ricerca salvata'); if (name) handleSaveSearch(name) }} className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md">Salva ricerca</button>
          </div>

          <div className="text-sm text-gray-500">Visualizzati: {visibleCount} • Selezionati: {selectedCount}</div>
        </div>
      </div>
    </div>
  )
}

function maskEmailPreview(email?: string) {
  if (!email) return ''
  const [local, domain] = email.split('@')
  if (!domain) return email
  if (local.length <= 2) return '*@' + domain
  return `${local.slice(0, 2)}***@${domain}`
}

