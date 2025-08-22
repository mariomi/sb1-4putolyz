import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { 
  Search, Filter, Plus, Edit, Eye, Trash2, Calendar, Users, 
  TrendingUp, AlertCircle, CheckCircle, Clock, FolderOpen
} from 'lucide-react'

// Mock data for projects
const mockProjects = [
  {
    id: 1,
    name: 'Project Alpha',
    description: 'Sistema di gestione campagne email marketing',
    manager: 'Marco Rossi',
    status: 'In corso',
    priority: 'Alta',
    progress: 45,
    startDate: '2025-01-15',
    endDate: '2025-03-15',
    operators: 4,
    budget: 25000,
    tasks: { total: 24, completed: 11, inProgress: 8, blocked: 5 }
  },
  {
    id: 2,
    name: 'Project Beta',
    description: 'Dashboard analytics per operatori',
    manager: 'Anna Bianchi',
    status: 'In attesa',
    priority: 'Media',
    progress: 10,
    startDate: '2025-02-01',
    endDate: '2025-04-01',
    operators: 3,
    budget: 18000,
    tasks: { total: 18, completed: 2, inProgress: 3, blocked: 13 }
  },
  {
    id: 3,
    name: 'Project Gamma',
    description: 'Integrazione API terze parti',
    manager: 'Luca Verdi',
    status: 'Bloccato',
    priority: 'Alta',
    progress: 80,
    startDate: '2024-12-01',
    endDate: '2025-01-31',
    operators: 5,
    budget: 32000,
    tasks: { total: 32, completed: 26, inProgress: 4, blocked: 2 }
  },
  {
    id: 4,
    name: 'Project Delta',
    description: 'Sistema di notifiche push',
    manager: 'Sofia Neri',
    status: 'Completato',
    priority: 'Bassa',
    progress: 100,
    startDate: '2024-10-01',
    endDate: '2024-12-31',
    operators: 2,
    budget: 15000,
    tasks: { total: 15, completed: 15, inProgress: 0, blocked: 0 }
  },
  {
    id: 5,
    name: 'Project Epsilon',
    description: 'Ottimizzazione database',
    manager: 'Giuseppe Gialli',
    status: 'In corso',
    priority: 'Media',
    progress: 65,
    startDate: '2025-01-20',
    endDate: '2025-03-20',
    operators: 3,
    budget: 22000,
    tasks: { total: 20, completed: 13, inProgress: 5, blocked: 2 }
  }
]

export function ProjectsPage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [managerFilter, setManagerFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')

  const handleLogout = async () => {
    await signOut()
    navigate('/auth')
  }

  const navigateToPage = (page: string) => {
    navigate(page)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In corso': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'Completato': return 'bg-green-100 text-green-800 border-green-200'
      case 'Bloccato': return 'bg-red-100 text-red-800 border-red-200'
      case 'In attesa': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Alta': return 'bg-red-100 text-red-800 border-red-200'
      case 'Media': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'Bassa': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500'
    if (progress >= 50) return 'bg-blue-500'
    if (progress >= 25) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const filteredProjects = mockProjects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.manager.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter
    const matchesPriority = priorityFilter === 'all' || project.priority === priorityFilter
    const matchesManager = managerFilter === 'all' || project.manager === managerFilter
    
    return matchesSearch && matchesStatus && matchesPriority && matchesManager
  })

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    switch (sortBy) {
      case 'name': return a.name.localeCompare(b.name)
      case 'progress': return b.progress - a.progress
      case 'startDate': return new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      case 'budget': return b.budget - a.budget
      case 'operators': return b.operators - a.operators
      default: return 0
    }
  })

  const managers = [...new Set(mockProjects.map(p => p.manager))]
  const statuses = [...new Set(mockProjects.map(p => p.status))]
  const priorities = [...new Set(mockProjects.map(p => p.priority))]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-6">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                📁 Progetti
              </h1>
              <p className="mt-2 text-lg text-gray-600">
                Gestione e monitoraggio di tutti i progetti attivi
              </p>
            </div>
            
            <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-3">
              {/* Navigation Links */}
              <div className="flex space-x-2">
                <button
                  onClick={() => navigateToPage('/pm-dashboard')}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-200"
                >
                  📊 Dashboard
                </button>
                <button
                  onClick={() => navigateToPage('/pm-operators')}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-200"
                >
                  👥 Operatori
                </button>
                <button
                  onClick={() => navigateToPage('/pm-reports')}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-200"
                >
                  📊 Report
                </button>
              </div>

              <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                <Plus className="w-4 h-4 mr-2" />
                Nuovo Progetto
              </button>
              
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Esci
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Cerca progetti..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Tutti gli stati</option>
                {statuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Tutte le priorità</option>
                {priorities.map(priority => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
            </div>

            {/* Manager Filter */}
            <div>
              <select
                value={managerFilter}
                onChange={(e) => setManagerFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Tutti i manager</option>
                {managers.map(manager => (
                  <option key={manager} value={manager}>{manager}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Sort Options */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700">Ordina per:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="name">Nome</option>
                <option value="progress">Progresso</option>
                <option value="startDate">Data inizio</option>
                <option value="budget">Budget</option>
                <option value="operators">Operatori</option>
              </select>
            </div>
            
            <div className="text-sm text-gray-600">
              {filteredProjects.length} progetti trovati
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {sortedProjects.map(project => (
            <div key={project.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
              {/* Project Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                  <div className="flex space-x-2">
                    <button className="p-1 text-gray-400 hover:text-gray-600">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button className="p-1 text-gray-400 hover:text-gray-600">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button className="p-1 text-red-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 mb-4">{project.description}</p>
                
                <div className="flex items-center justify-between mb-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(project.status)}`}>
                    {project.status}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(project.priority)}`}>
                    {project.priority}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Progresso</span>
                    <span className="font-medium text-gray-900">{project.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(project.progress)}`}
                      style={{ width: `${project.progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Project Details */}
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="w-4 h-4 mr-2" />
                    <span>{project.operators} operatori</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>{project.startDate}</span>
                  </div>
                </div>

                {/* Task Summary */}
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Task</span>
                    <span className="font-medium text-gray-900">{project.tasks.completed}/{project.tasks.total}</span>
                  </div>
                  <div className="flex space-x-1 mt-2">
                    <div className="flex-1 bg-green-200 rounded h-2" style={{ width: `${(project.tasks.completed / project.tasks.total) * 100}%` }}></div>
                    <div className="flex-1 bg-blue-200 rounded h-2" style={{ width: `${(project.tasks.inProgress / project.tasks.total) * 100}%` }}></div>
                    <div className="flex-1 bg-red-200 rounded h-2" style={{ width: `${(project.tasks.blocked / project.tasks.total) * 100}%` }}></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>✅ {project.tasks.completed}</span>
                    <span>🔄 {project.tasks.inProgress}</span>
                    <span>🚫 {project.tasks.blocked}</span>
                  </div>
                </div>

                {/* Project Footer */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">€{project.budget.toLocaleString()}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Manager: <span className="font-medium">{project.manager}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {sortedProjects.length === 0 && (
          <div className="text-center py-12">
            <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun progetto trovato</h3>
            <p className="mt-1 text-sm text-gray-500">
              Prova a modificare i filtri di ricerca o crea un nuovo progetto.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
