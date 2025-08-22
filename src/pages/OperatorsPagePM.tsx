import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { 
  Search, Filter, Plus, Edit, Eye, Trash2, Calendar, Users, 
  TrendingUp, AlertCircle, CheckCircle, Clock, UserCheck, 
  Mail, Phone, MapPin, Star, Activity
} from 'lucide-react'

// Mock data for operators
const mockOperators = [
  {
    id: 1,
    name: 'Marco Rossi',
    email: 'marco.rossi@company.com',
    phone: '+39 333 1234567',
    location: 'Milano, Italia',
    role: 'Senior Operator',
    department: 'Marketing',
    status: 'Online',
    joinDate: '2023-03-15',
    rating: 4.8,
    workload: 75,
    assigned: 12,
    completed: 8,
    inProgress: 3,
    blocked: 1,
    avgResponseTime: 2.1,
    projects: ['Project Alpha', 'Project Beta'],
    skills: ['Email Marketing', 'Analytics', 'CRM'],
    availability: 'Full-time',
    lastActivity: '2 ore fa'
  },
  {
    id: 2,
    name: 'Anna Bianchi',
    email: 'anna.bianchi@company.com',
    phone: '+39 333 2345678',
    location: 'Roma, Italia',
    role: 'Lead Operator',
    department: 'Sales',
    status: 'Online',
    joinDate: '2022-11-20',
    rating: 4.9,
    workload: 85,
    assigned: 18,
    completed: 15,
    inProgress: 2,
    blocked: 1,
    avgResponseTime: 1.8,
    projects: ['Project Beta', 'Project Gamma'],
    skills: ['Sales Operations', 'Lead Generation', 'Customer Success'],
    availability: 'Full-time',
    lastActivity: '1 ora fa'
  },
  {
    id: 3,
    name: 'Luca Verdi',
    email: 'luca.verdi@company.com',
    phone: '+39 333 3456789',
    location: 'Torino, Italia',
    role: 'Operator',
    department: 'Technical',
    status: 'Away',
    joinDate: '2024-01-10',
    rating: 4.5,
    workload: 60,
    assigned: 8,
    completed: 6,
    inProgress: 1,
    blocked: 1,
    avgResponseTime: 2.8,
    projects: ['Project Gamma'],
    skills: ['Technical Support', 'API Integration', 'Debugging'],
    availability: 'Part-time',
    lastActivity: '4 ore fa'
  },
  {
    id: 4,
    name: 'Sofia Neri',
    email: 'sofia.neri@company.com',
    phone: '+39 333 4567890',
    location: 'Firenze, Italia',
    role: 'Senior Operator',
    department: 'Customer Service',
    status: 'Online',
    joinDate: '2023-06-05',
    rating: 4.7,
    workload: 80,
    assigned: 15,
    completed: 12,
    inProgress: 2,
    blocked: 1,
    avgResponseTime: 2.0,
    projects: ['Project Delta', 'Project Epsilon'],
    skills: ['Customer Support', 'Problem Solving', 'Communication'],
    availability: 'Full-time',
    lastActivity: '30 min fa'
  },
  {
    id: 5,
    name: 'Giuseppe Gialli',
    email: 'giuseppe.gialli@company.com',
    phone: '+39 333 5678901',
    location: 'Napoli, Italia',
    role: 'Operator',
    department: 'Marketing',
    status: 'Offline',
    joinDate: '2024-02-28',
    rating: 4.3,
    workload: 70,
    assigned: 10,
    completed: 9,
    inProgress: 1,
    blocked: 0,
    avgResponseTime: 2.5,
    projects: ['Project Epsilon'],
    skills: ['Content Creation', 'Social Media', 'SEO'],
    availability: 'Full-time',
    lastActivity: '1 giorno fa'
  }
]

export function OperatorsPage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [availabilityFilter, setAvailabilityFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const handleLogout = async () => {
    await signOut()
    navigate('/auth')
  }

  const navigateToPage = (page: string) => {
    navigate(page)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Online': return 'bg-green-100 text-green-800 border-green-200'
      case 'Away': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'Offline': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getWorkloadColor = (workload: number) => {
    if (workload > 80) return 'bg-red-500 text-white'
    if (workload > 60) return 'bg-yellow-500 text-white'
    return 'bg-green-500 text-white'
  }

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-green-600'
    if (rating >= 4.0) return 'text-yellow-600'
    return 'text-red-600'
  }

  const filteredOperators = mockOperators.filter(operator => {
    const matchesSearch = operator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         operator.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         operator.role.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDepartment = departmentFilter === 'all' || operator.department === departmentFilter
    const matchesStatus = statusFilter === 'all' || operator.status === statusFilter
    const matchesAvailability = availabilityFilter === 'all' || operator.availability === availabilityFilter
    
    return matchesSearch && matchesDepartment && matchesStatus && matchesAvailability
  })

  const sortedOperators = [...filteredOperators].sort((a, b) => {
    switch (sortBy) {
      case 'name': return a.name.localeCompare(b.name)
      case 'workload': return b.workload - a.workload
      case 'rating': return b.rating - a.rating
      case 'joinDate': return new Date(a.joinDate).getTime() - new Date(b.joinDate).getTime()
      case 'assigned': return b.assigned - a.assigned
      default: return 0
    }
  })

  const departments = [...new Set(mockOperators.map(o => o.department))]
  const statuses = [...new Set(mockOperators.map(o => o.status))]
  const availabilities = [...new Set(mockOperators.map(o => o.availability))]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-6">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                👥 Operatori
              </h1>
              <p className="mt-2 text-lg text-gray-600">
                Gestione e monitoraggio del team di operatori
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
                  onClick={() => navigateToPage('/pm-projects')}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-200"
                >
                  📁 Progetti
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
                Nuovo Operatore
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Cerca operatori..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Department Filter */}
            <div>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Tutti i dipartimenti</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
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

            {/* Availability Filter */}
            <div>
              <select
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Tutte le disponibilità</option>
                {availabilities.map(availability => (
                  <option key={availability} value={availability}>{availability}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Sort and View Options */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700">Ordina per:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="name">Nome</option>
                <option value="workload">Workload</option>
                <option value="rating">Rating</option>
                <option value="joinDate">Data assunzione</option>
                <option value="assigned">Task assegnati</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <div className="grid grid-cols-2 gap-1 w-4 h-4">
                  <div className="bg-current rounded-sm"></div>
                  <div className="bg-current rounded-sm"></div>
                  <div className="bg-current rounded-sm"></div>
                  <div className="bg-current rounded-sm"></div>
                </div>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <div className="space-y-1 w-4 h-4">
                  <div className="bg-current rounded-sm h-1"></div>
                  <div className="bg-current rounded-sm h-1"></div>
                  <div className="bg-current rounded-sm h-1"></div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Operators Grid/List */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {sortedOperators.map(operator => (
              <div key={operator.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
                {/* Operator Header */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{operator.name}</h3>
                      <p className="text-sm text-gray-600">{operator.role}</p>
                    </div>
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
                  
                  <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(operator.status)}`}>
                      {operator.status}
                    </span>
                    <div className="flex items-center">
                      <Star className={`w-4 h-4 mr-1 ${getRatingColor(operator.rating)}`} />
                      <span className={`text-sm font-medium ${getRatingColor(operator.rating)}`}>
                        {operator.rating}
                      </span>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 mr-2" />
                      <span>{operator.email}</span>
                    </div>
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 mr-2" />
                      <span>{operator.location}</span>
                    </div>
                  </div>
                </div>

                {/* Operator Details */}
                <div className="p-6">
                  {/* Workload and Performance */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-900">{operator.workload}%</div>
                      <div className="text-xs text-gray-600">Workload</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-900">{operator.avgResponseTime}h</div>
                      <div className="text-xs text-gray-600">TTR Medio</div>
                    </div>
                  </div>

                  {/* Task Summary */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-600">Task</span>
                      <span className="font-medium text-gray-900">{operator.completed}/{operator.assigned}</span>
                    </div>
                    <div className="flex space-x-1">
                      <div className="flex-1 bg-green-200 rounded h-2" style={{ width: `${(operator.completed / operator.assigned) * 100}%` }}></div>
                      <div className="flex-1 bg-blue-200 rounded h-2" style={{ width: `${(operator.inProgress / operator.assigned) * 100}%` }}></div>
                      <div className="flex-1 bg-red-200 rounded h-2" style={{ width: `${(operator.blocked / operator.assigned) * 100}%` }}></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>✅ {operator.completed}</span>
                      <span>🔄 {operator.inProgress}</span>
                      <span>🚫 {operator.blocked}</span>
                    </div>
                  </div>

                  {/* Skills */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Competenze</h4>
                    <div className="flex flex-wrap gap-1">
                      {operator.skills.map((skill, index) => (
                        <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Projects */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Progetti</h4>
                    <div className="space-y-1">
                      {operator.projects.map((project, index) => (
                        <div key={index} className="text-sm text-gray-600 flex items-center">
                          <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
                          {project}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>Assunto: {operator.joinDate}</span>
                    <span className="flex items-center">
                      <Activity className="w-4 h-4 mr-1" />
                      {operator.lastActivity}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Operatore</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ruolo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stato</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Workload</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedOperators.map(operator => (
                    <tr key={operator.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="text-sm font-medium text-blue-600">
                                {operator.name.split(' ').map(n => n[0]).join('')}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{operator.name}</div>
                            <div className="text-sm text-gray-500">{operator.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{operator.role}</div>
                        <div className="text-sm text-gray-500">{operator.department}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(operator.status)}`}>
                          {operator.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getWorkloadColor(operator.workload)}`}>
                          {operator.workload}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Star className={`w-4 h-4 mr-1 ${getRatingColor(operator.rating)}`} />
                          <span className={`text-sm font-medium ${getRatingColor(operator.rating)}`}>
                            {operator.rating}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{operator.completed}/{operator.assigned}</div>
                        <div className="text-sm text-gray-500">TTR: {operator.avgResponseTime}h</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button className="text-blue-600 hover:text-blue-900">Visualizza</button>
                          <button className="text-indigo-600 hover:text-indigo-900">Modifica</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {sortedOperators.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun operatore trovato</h3>
            <p className="mt-1 text-sm text-gray-500">
              Prova a modificare i filtri di ricerca o aggiungi un nuovo operatore.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
