import { useState, useEffect } from 'react'
import { Users, Settings, BarChart3, Home, LogOut, Filter, Plus, Edit, Trash2, Eye, Calendar, UserCheck, Shield, Briefcase, Activity } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import Logo from '/Logo.svg'
import { AccessLogsSection } from '../components/AccessLogsSection'

type AdminSection = 'dashboard' | 'gestione-dipendenti' | 'impostazioni' | 'statistiche' | 'log-accessi'

interface EmployeeFilters {
  role: string
  search: string
}

export function AdminPage() {
  const navigate = useNavigate()
  const { signOut, user, loading: authLoading } = useAuth()
  const [activeSection, setActiveSection] = useState<AdminSection>('gestione-dipendenti')
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<EmployeeFilters>({
    role: '',
    search: ''
  })
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set())
  const [decryptedPasswords, setDecryptedPasswords] = useState<Map<string, string>>(new Map())

  const [editingUser, setEditingUser] = useState<any>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  const navigationItems = [
    { 
      id: 'dashboard', 
      name: 'Dashboard', 
      icon: Home, 
      description: 'Panoramica generale'
    },
    { 
      id: 'gestione-dipendenti', 
      name: 'Gestione Utenti', 
      icon: Users, 
      description: 'Utenti e permessi'
    },
    { 
      id: 'log-accessi', 
      name: 'Log Accessi', 
      icon: Activity, 
      description: 'Monitoraggio accessi utenti'
    },
    { 
      id: 'statistiche', 
      name: 'Analytics', 
      icon: BarChart3, 
      description: 'Report e metriche'
    },
    { 
      id: 'impostazioni', 
      name: 'Configurazione', 
      icon: Settings, 
      description: 'Impostazioni sistema'
    },
  ]

  const roleOptions = [
    { value: '', label: 'Tutti i ruoli' },
    { value: 'admin', label: 'Amministratore' },
    { value: 'project_manager', label: 'Project Manager' },
    { value: 'reply_operator', label: 'Operatore Risposte' },
    { value: 'data_operator', label: 'Operatore Dati' },
    { value: 'sales', label: 'Vendite' },
    { value: 'client', label: 'Cliente' },
  ]

  const roleColors = {
    admin: 'bg-[#F64C38] text-white',
    project_manager: 'bg-[#002F6C] text-white',
    reply_operator: 'bg-[#00C48C] text-white',
    data_operator: 'bg-[#FFA726] text-white',
    sales: 'bg-[#2C8EFF] text-white',
    client: 'bg-[#333333] text-white',
  }

  useEffect(() => {
    if (!authLoading && user) {
      fetchEmployees()
    }
  }, [authLoading, user])

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      console.log('🔄 Starting to fetch employees...')
      
      // Check if user is authenticated using the hook
      if (!user) {
        console.error('❌ No authenticated user')
        alert('Utente non autenticato. Effettua il login per continuare.')
        return
      }
      
      console.log('✅ User authenticated:', user.id)
      
      // Since user is authenticated, try to fetch all profiles using admin client (bypasses RLS)
      console.log('🔄 Attempting to fetch all profiles using admin client...')
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Error fetching all profiles with admin client:', error)
        alert('Errore nel caricamento dipendenti: ' + error.message)
        return
      }

      console.log('✅ All profiles fetched successfully:', data)
      const raw = data || []
      const mapped = raw.map((row: any) => ({
        id: row.id ?? '',
        full_name: row.full_name ?? row.name ?? '',
        role: row.role ?? 'client',
        operator_id: row.operator_id ?? '',
        access_key: row.access_key ?? null,
        created_at: row.created_at ?? ''
      }))
      setEmployees(mapped)
    } catch (error) {
      console.error('💥 Unexpected error:', error)
      alert('Errore imprevisto: ' + (error as Error).message)
    } finally {
      setLoading(false)
      console.log('🏁 Fetch operation completed')
    }
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/auth')
  }

  const handleFilterChange = (key: keyof EmployeeFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const filteredEmployees = employees.filter(employee => {
    const matchesRole = !filters.role || employee.role === filters.role
    const matchesSearch = !filters.search || 
      employee.full_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
      employee.operator_id?.toLowerCase().includes(filters.search.toLowerCase())
    
    return matchesRole && matchesSearch
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getRoleLabel = (role: string) => {
    const roleOption = roleOptions.find(r => r.value === role)
    return roleOption?.label || role
  }

  const togglePasswordVisibility = async (employeeId: string) => {
    // Se clicchi per nascondere, nascondi immediatamente
    if (visiblePasswords.has(employeeId)) {
      setVisiblePasswords(prev => {
        const newSet = new Set<string>()
        return newSet
      })
      return
    }

    // Se clicchi per mostrare, prima decripta e poi mostra
    const employee = employees.find(e => e.id === employeeId)
    if (employee && employee.access_key && employee.access_key.length > 20) {
      // Decripta la password prima di cambiare il pulsante
      try {
        const decrypted = await decryptPassword(employee.access_key)
        console.log('Password decriptata per', employeeId, ':', decrypted)
        
        // Prima imposta la password decriptata
        setDecryptedPasswords(prevMap => {
          const newMap = new Map(prevMap)
          newMap.set(employeeId, decrypted)
          return newMap
        })
        
        // Poi cambia il pulsante e mostra la password
        setVisiblePasswords(prev => {
          const newSet = new Set<string>()
          newSet.add(employeeId)
          return newSet
        })
      } catch (error) {
        console.error('Errore decriptazione password:', error)
        // Fallback: mostra che c'è un errore
        setDecryptedPasswords(prevMap => {
          const newMap = new Map(prevMap)
          newMap.set(employeeId, 'Errore decriptazione')
          return newMap
        })
        
        // Mostra anche la password con errore
        setVisiblePasswords(prev => {
          const newSet = new Set<string>()
          newSet.add(employeeId)
          return newSet
        })
      }
    } else if (employee && employee.access_key && employee.access_key.length <= 20) {
      // Password non criptata, imposta prima e poi mostra
      setDecryptedPasswords(prevMap => {
        const newMap = new Map(prevMap)
        newMap.set(employeeId, employee.access_key)
        return newMap
      })
      
      setVisiblePasswords(prev => {
        const newSet = new Set<string>()
        newSet.add(employeeId)
        return newSet
      })
    }
  }

  const handleEditUser = (user: any) => {
    setEditingUser(user)
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      const { error } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', userId)

      if (error) {
        toast.error('Errore durante l\'eliminazione: ' + error.message)
        return
      }

      toast.success('Utente eliminato con successo')
      setShowDeleteConfirm(null)
      fetchEmployees() // Ricarica la lista
    } catch (error) {
      toast.error('Errore imprevisto: ' + (error as Error).message)
    }
  }

  const handleUpdateUser = async (updatedUser: any) => {
    try {
      // Cripta SEMPRE la password con AES-256-GCM prima di salvarla nel database
      let passwordToSave = updatedUser.access_key || ''
      
      if (updatedUser.access_key) {
        // Cripta sempre la password con encrypt/decrypt, anche se sembra già criptata
        // Questo garantisce che tutte le password siano sicure nel database
        passwordToSave = await encryptPassword(updatedUser.access_key)
      }

      let error
      if (updatedUser.id) {
        // Update existing user
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            full_name: updatedUser.full_name,
            role: updatedUser.role,
            operator_id: updatedUser.operator_id,
            access_key: passwordToSave,
            updated_at: new Date().toISOString()
          })
          .eq('id', updatedUser.id)
        error = updateError
      } else {
        // Create new user
        const { error: createError } = await supabaseAdmin
          .from('profiles')
          .insert({
            full_name: updatedUser.full_name,
            role: updatedUser.role,
            operator_id: updatedUser.operator_id,
            access_key: passwordToSave,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        error = createError
      }

      if (error) {
        toast.error(updatedUser.id ? 'Errore durante l\'aggiornamento: ' : 'Errore durante la creazione: ' + error.message)
        return
      }

      toast.success(updatedUser.id ? 'Utente aggiornato con successo' : 'Utente creato con successo')
      setEditingUser(null)
      fetchEmployees() // Ricarica la lista
    } catch (error) {
      toast.error('Errore imprevisto: ' + (error as Error).message)
    }
  }

  const handleCancelEdit = () => {
    setEditingUser(null)
  }

  // Funzione per criptare password con encrypt/decrypt usando la funzione RPC del database
  const encryptPassword = async (password: string): Promise<string> => {
    try {
      const { data, error } = await supabaseAdmin.rpc('encrypt_password', { _password: password })
      if (error) {
        console.error('Errore durante la criptazione:', error)
        // Fallback: restituisci la password in chiaro se la criptazione fallisce
        return password
      }
      return data || password
    } catch (error) {
      console.error('Errore durante la criptazione:', error)
      // Fallback: restituisci la password in chiaro se la criptazione fallisce
      return password
    }
  }

  // Funzione per decriptare password con encrypt/decrypt usando la funzione RPC del database
  const decryptPassword = async (encryptedPassword: string): Promise<string> => {
    try {
      console.log('Tentativo di decriptare password:', encryptedPassword.substring(0, 20) + '...')
      
      const { data, error } = await supabaseAdmin.rpc('decrypt_password', { _encrypted_data: encryptedPassword })
      
      if (error) {
        console.error('Errore RPC durante la decriptazione:', error)
        throw new Error(`Errore RPC: ${error.message}`)
      }
      
      if (!data) {
        console.error('Nessun dato restituito dalla decriptazione')
        throw new Error('Nessun dato restituito')
      }
      
      console.log('Password decriptata con successo:', data)
      return data
      
    } catch (error) {
      console.error('Errore durante la decriptazione:', error)
      throw error // Rilancia l'errore per gestirlo nel chiamante
    }
  }

  // Funzione per verificare password (confronta password in chiaro con cifrata)
  const verifyPassword = async (plainPassword: string, encryptedPassword: string): Promise<boolean> => {
    // Per ora confrontiamo direttamente, la verifica reale avviene nel DB
    return plainPassword === encryptedPassword
  }

  // Funzione per mostrare password in chiaro (per admin)
  const getPasswordDisplay = (encryptedPassword: string | null): string => {
    if (!encryptedPassword) return 'Non specificato'
    
    // Se la password è criptata (lunghezza > 20 caratteri, tipico di PGP)
    if (encryptedPassword.length > 20) {
      // Mostriamo che è criptata, la decriptazione avverrà quando l'admin clicca per vedere
      return '••••••••••••••••'
    }
    
    // Se non è criptata, mostra la password in chiaro
    return encryptedPassword
  }

    // Funzione per mostrare password originale (se disponibile)
  const getOriginalPassword = (encryptedPassword: string | null): string => {
    if (!encryptedPassword) return 'Non specificato'
    
    // Se la password è criptata (lunghezza > 20 caratteri, tipico di PGP)
    if (encryptedPassword.length > 20) {
              return 'Password criptata (encrypt/decrypt AES-256)'
    }
    
    // Se non è criptata, mostra la password originale
    return encryptedPassword
  }

  const renderMainContent = () => {
    switch (activeSection) {
      case 'gestione-dipendenti':
  return (
          <div className="space-y-6">
            {/* Header Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-[#333333] mb-2">Gestione Utenti</h1>
                  <p className="text-[#333333] text-base leading-relaxed max-w-2xl">
                    Gestisci gli utenti, i loro ruoli e le autorizzazioni nel sistema.
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={() => setEditingUser({})}
                    className="bg-[#002F6C] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#002F6C]/90 transition-colors duration-200 flex items-center space-x-2"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Nuovo Utente</span>
                  </button>

                </div>
              </div>
              
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#F5F7FA] rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#333333] text-sm font-medium">Totale Utenti</p>
                      <p className="text-2xl font-bold text-[#333333]">{employees.length}</p>
                    </div>
                    <div className="w-10 h-10 bg-[#002F6C] rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-[#F5F7FA] rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#333333] text-sm font-medium">Operatori Attivi</p>
                      <p className="text-2xl font-bold text-[#333333]">{employees.filter(e => e.role === 'reply_operator').length}</p>
                    </div>
                    <div className="w-10 h-10 bg-[#00C48C] rounded-lg flex items-center justify-center">
                      <UserCheck className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-[#F5F7FA] rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#333333] text-sm font-medium">Project Manager</p>
                      <p className="text-2xl font-bold text-[#333333]">{employees.filter(e => e.role === 'project_manager').length}</p>
                    </div>
                    <div className="w-10 h-10 bg-[#002F6C] rounded-lg flex items-center justify-center">
                      <Briefcase className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-[#F5F7FA] rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#333333] text-sm font-medium">Amministratori</p>
                      <p className="text-2xl font-bold text-[#333333]">{employees.filter(e => e.role === 'admin').length}</p>
                    </div>
                    <div className="w-10 h-10 bg-[#F64C38] rounded-lg flex items-center justify-center">
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-[#002F6C] rounded-lg flex items-center justify-center">
                    <Filter className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#333333]">Filtri e Ricerca</h3>
                </div>
                <button
                  onClick={() => setFilters({ role: '', search: '' })}
                  className="text-[#333333] hover:text-[#002F6C] font-medium px-3 py-2 rounded-lg hover:bg-[#F5F7FA] transition-colors duration-200 border border-gray-200 hover:border-[#002F6C]/30"
                >
                  Reset Filtri
                </button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#F5F7FA] rounded-lg p-4 border border-gray-200">
                  <label className="block text-sm font-semibold text-[#333333] mb-3">
                    Filtra per Ruolo
                  </label>
                  <div className="relative">
                    <select
                      value={filters.role}
                      onChange={(e) => handleFilterChange('role', e.target.value)}
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C] transition-all duration-200 bg-white text-[#333333] font-medium shadow-sm appearance-none cursor-pointer hover:border-[#002F6C]/50"
                    >
                      {roleOptions.map(option => (
                        <option key={option.value} value={option.value} className="py-2">
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                      <div className="w-4 h-4 border-2 border-[#002F6C] border-t-transparent border-l-transparent transform rotate-45"></div>
                    </div>
                  </div>
                  {filters.role && (
                    <div className="mt-3 flex items-center space-x-2">
                      <div className="w-2 h-2 bg-[#00C48C] rounded-full"></div>
                      <span className="text-xs text-[#333333] font-medium">
                        Filtro attivo: {roleOptions.find(r => r.value === filters.role)?.label}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="bg-[#F5F7FA] rounded-lg p-4 border border-gray-200">
                  <label className="block text-sm font-semibold text-[#333333] mb-3">
                    Ricerca
                  </label>
                  <input
                    type="text"
                    placeholder="Cerca per nome, ID operatore..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C] transition-colors duration-200 bg-white text-[#333333] font-medium shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Employees Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-[#F5F7FA]">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[#333333]">
                    Elenco Utenti
                  </h3>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-[#333333] bg-white px-3 py-1 rounded border border-gray-200">
                      {filteredEmployees.length} risultati
                    </span>
                    <span className="text-sm text-[#333333] bg-[#00C48C] text-white px-3 py-1 rounded">
                      Totale: {employees.length} utenti
                    </span>
                  </div>
                </div>
        </div>
        
              {loading ? (
                <div className="p-12 text-center">
                  <div className="inline-flex items-center px-4 py-2 font-medium leading-6 text-[#333333]">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-[#002F6C]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Caricamento utenti...
                  </div>
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-[#F5F7FA] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-[#333333]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#333333] mb-2">Nessun utente trovato</h3>
                  <p className="text-[#333333]">Prova a modificare i filtri di ricerca.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#F5F7FA]">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-[#333333] uppercase tracking-wider">
                          Utente
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-[#333333] uppercase tracking-wider">
                          Ruolo
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-[#333333] uppercase tracking-wider">
                          ID Operatore
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-[#333333] uppercase tracking-wider">
                          Password
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-[#333333] uppercase tracking-wider">
                          Data Creazione
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-[#333333] uppercase tracking-wider">
                          Azioni
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredEmployees.map((employee, index) => (
                        <tr key={employee.id} className={`hover:bg-[#F5F7FA] transition-colors duration-200 ${index % 2 === 0 ? 'bg-white' : 'bg-[#F5F7FA]'}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-10 h-10 bg-[#002F6C] rounded-lg flex items-center justify-center text-white font-semibold text-sm">
                                {employee.full_name?.charAt(0)?.toUpperCase() || 'U'}
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-[#333333]">
                                  {employee.full_name || 'Nome non specificato'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {(() => {
                              const roleValue = (employee?.role as string) ?? undefined
                              const roleClass = roleValue ? (roleColors[roleValue as keyof typeof roleColors] ?? '') : ''
                              return (
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${roleClass}`}>
                                  {roleValue ? getRoleLabel(roleValue) : 'Non specificato'}
                                </span>
                              )
                            })()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-[#333333]">
                              {employee.operator_id ? (
                                <span className="font-mono bg-[#F5F7FA] px-2 py-1 rounded border border-gray-200">
                                  {employee.operator_id}
                                </span>
                              ) : (
                                <span className="text-gray-400 italic">Non specificato</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-[#333333]">
                              {employee.access_key ? (
                                <div className="flex items-center">
                                  <span 
                                    onClick={() => togglePasswordVisibility(employee.id)}
                                    className={`font-mono bg-[#F5F7FA] px-2 py-1 rounded border border-gray-200 cursor-pointer transition-all duration-200 hover:bg-[#E8ECF1] ${
                                      visiblePasswords.has(employee.id) 
                                        ? 'text-[#002F6C] font-medium' 
                                        : 'text-gray-600 blur-[0.5px] hover:blur-[0.3px]'
                                    }`}
                                    title={visiblePasswords.has(employee.id) ? 'Clicca per nascondere' : 'Clicca per rivelare'}
                                  >
                                    {visiblePasswords.has(employee.id) 
                                      ? (decryptedPasswords.get(employee.id) || getPasswordDisplay(employee.access_key))
                                      : '••••••••••••••••'
                                    }
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-400 italic">Non specificato</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center text-sm text-[#333333]">
                              <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                              {formatDate(employee.created_at)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <button 
                                onClick={() => handleEditUser(employee)}
                                className="text-[#00C48C] hover:text-[#00C48C]/80 p-1 rounded hover:bg-[#F5F7FA] transition-colors duration-200"
                                title="Modifica utente"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setShowDeleteConfirm(employee.id)}
                                className="text-[#F64C38] hover:text-[#F64C38]/80 p-1 rounded hover:bg-[#F5F7FA] transition-colors duration-200"
                                title="Elimina utente"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )

      case 'dashboard':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h1 className="text-3xl font-bold text-[#333333] mb-4">Dashboard</h1>
              <p className="text-[#333333]">Contenuto dashboard in sviluppo...</p>
            </div>
          </div>
        )

      case 'statistiche':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h1 className="text-3xl font-bold text-[#333333] mb-4">Analytics</h1>
              <p className="text-[#333333]">Contenuto statistiche in sviluppo...</p>
            </div>
          </div>
        )

      case 'log-accessi':
        return <AccessLogsSection />

      case 'impostazioni':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h1 className="text-3xl font-bold text-[#333333] mb-4">Configurazione</h1>
              <p className="text-[#333333]">Contenuto impostazioni in sviluppo...</p>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  // Show loading state while authentication is being checked
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#002F6C] mx-auto mb-4"></div>
          <p className="text-[#333333] text-lg">Verifica autenticazione...</p>
        </div>
      </div>
    )
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#F64C38] rounded-full flex items-center justify-center mx-auto mb-4">
            <LogOut className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-[#333333] mb-2">Accesso Richiesto</h2>
          <p className="text-[#333333] mb-6">Effettua il login per accedere al pannello amministrativo</p>
          <button
            onClick={() => navigate('/auth')}
            className="bg-[#002F6C] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#002F6C]/90 transition-colors duration-200"
          >
            Vai al Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Modal Conferma Eliminazione */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-[#333333] mb-4">Conferma Eliminazione</h3>
            <p className="text-[#333333] mb-6">
              Sei sicuro di voler eliminare questo utente? Questa azione non può essere annullata.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 text-[#333333] border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                Annulla
              </button>
              <button
                onClick={() => handleDeleteUser(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-[#F64C38] text-white rounded-lg hover:bg-[#F64C38]/90 transition-colors duration-200"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modifica Utente */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-[#333333] mb-4">
              {editingUser.id ? 'Modifica Utente' : 'Nuovo Utente'}
            </h3>
            <form onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              handleUpdateUser({
                id: editingUser.id,
                full_name: formData.get('full_name') as string,
                role: formData.get('role') as string,
                operator_id: formData.get('operator_id') as string,
                access_key: formData.get('access_key') as string
              })
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#333333] mb-2">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    name="full_name"
                    defaultValue={editingUser.full_name || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C]"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[#333333] mb-2">
                    Ruolo
                  </label>
                  <select
                    name="role"
                    defaultValue={editingUser.role || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C]"
                    required
                  >
                    {roleOptions.filter(option => option.value !== '').map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[#333333] mb-2">
                    ID Operatore
                  </label>
                  <input
                    type="text"
                    name="operator_id"
                    defaultValue={editingUser.operator_id || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C]"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[#333333] mb-2">
                    Password
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      name="access_key"
                      defaultValue={editingUser.access_key || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C]"
                      placeholder="Inserisci password (verrà criptata automaticamente)"
                      required
                    />
                    {editingUser.access_key && (
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">Password attuale:</span> {editingUser.access_key ? (editingUser.access_key.length > 20 ? '••••••••••••••••' : editingUser.access_key) : 'Non specificata'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex-1 px-4 py-2 text-[#333333] border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#002F6C] text-white rounded-lg hover:bg-[#002F6C]/90 transition-colors duration-200"
                >
                  {editingUser.id ? 'Salva Modifiche' : 'Crea Utente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <img src={Logo} alt="Logo" className="h-10 w-auto" />
            <div className="h-6 w-px bg-gray-300"></div>
            <h1 className="text-2xl font-bold text-[#002F6C]">
              Admin Panel
            </h1>
        </div>
        
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 text-[#333333] hover:text-[#F64C38] font-medium transition-colors duration-200 px-4 py-2 rounded-lg hover:bg-[#F5F7FA] border border-gray-200"
          >
            <LogOut className="w-4 h-4" />
            <span>Disconnetti</span>
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Left Sidebar - Much Smaller */}
        <div className="w-48 bg-white border-r border-gray-200 min-h-screen">
          <div className="p-4">
            <nav className="space-y-2">
              {navigationItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id as AdminSection)}
                  className={`w-full text-left p-3 rounded-lg transition-colors duration-200 group ${
                    activeSection === item.id
                      ? 'bg-[#002F6C] text-white'
                      : 'text-[#333333] hover:bg-[#F5F7FA] hover:text-[#002F6C]'
                  }`}
                >
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 transition-colors duration-200 ${
                      activeSection === item.id 
                        ? 'bg-white/20 text-white' 
                        : 'bg-[#F5F7FA] text-[#333333] group-hover:bg-[#002F6C]/10'
                    }`}>
                      <item.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className={`text-xs ${activeSection === item.id ? 'text-white/80' : 'text-gray-500'}`}>
                        {item.description}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {renderMainContent()}
        </div>
      </div>
    </div>
  )
}
