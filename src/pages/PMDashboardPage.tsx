import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Area, AreaChart
} from 'recharts'
import { 
  RefreshCw, Download, Calendar, TrendingUp, Users, FolderOpen, 
  CheckCircle, Clock, AlertTriangle, BarChart3, FileText, UserCheck
} from 'lucide-react'

// Mock data for demonstration
const mockKPIData = [
  { title: 'Progetti Attivi', value: 24, change: '+12%', icon: FolderOpen, color: 'bg-blue-500', changeColor: 'text-green-600' },
  { title: 'Task Completati', value: 156, change: '+8%', icon: CheckCircle, color: 'bg-green-500', changeColor: 'text-green-600' },
  { title: 'Task Aperti', value: 43, change: '-5%', icon: FileText, color: 'bg-yellow-500', changeColor: 'text-red-600' },
  { title: 'TTR Medio (ore)', value: 2.4, change: '-15%', icon: Clock, color: 'bg-purple-500', changeColor: 'text-green-600' },
  { title: 'Ticket Chiusi 24h', value: '89%', change: '+3%', icon: CheckCircle, color: 'bg-emerald-500', changeColor: 'text-green-600' },
  { title: 'Task Falliti', value: 7, change: '-2%', icon: AlertTriangle, color: 'bg-red-500', changeColor: 'text-green-600' }
]

const mockOperators = [
  { name: 'Marco Rossi', assigned: 12, completed: 8, workload: 75, status: 'normal' },
  { name: 'Anna Bianchi', assigned: 18, completed: 15, workload: 85, status: 'high' },
  { name: 'Luca Verdi', assigned: 8, completed: 6, workload: 60, status: 'normal' },
  { name: 'Sofia Neri', assigned: 15, completed: 12, workload: 80, status: 'high' },
  { name: 'Giuseppe Gialli', assigned: 10, completed: 9, workload: 70, status: 'normal' }
]

const mockProjects = [
  { name: 'Project Alpha', manager: 'Marco Rossi', operators: 4, status: 'In corso', progress: 45 },
  { name: 'Project Beta', manager: 'Anna Bianchi', operators: 3, status: 'In attesa', progress: 10 },
  { name: 'Project Gamma', manager: 'Luca Verdi', operators: 5, status: 'Bloccato', progress: 80 },
  { name: 'Project Delta', manager: 'Sofia Neri', operators: 2, status: 'Completato', progress: 100 }
]

const mockAssignments = [
  { type: 'assignment', description: 'Marco Rossi assegnato a Project Alpha', time: '2 ore fa', icon: UserCheck },
  { type: 'completion', description: 'Task "Review KPIs" completato da Anna Bianchi', time: '4 ore fa', icon: CheckCircle },
  { type: 'update', description: 'Stato Project Beta aggiornato a "In attesa"', time: '6 ore fa', icon: FileText },
  { type: 'assignment', description: 'Luca Verdi assegnato a Project Gamma', time: '1 giorno fa', icon: UserCheck }
]

const mockChartData = [
  { name: 'Lun', ttr: 2.1, workload: 65 },
  { name: 'Mar', ttr: 1.8, workload: 70 },
  { name: 'Mer', ttr: 2.3, workload: 75 },
  { name: 'Gio', ttr: 1.9, workload: 80 },
  { name: 'Ven', ttr: 2.0, workload: 72 },
  { name: 'Sab', ttr: 1.5, workload: 60 },
  { name: 'Dom', ttr: 1.2, workload: 45 }
]

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export function PMDashboardPage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [timeRange, setTimeRange] = useState('week')
  const [sortBy, setSortBy] = useState('workload')

  const handleLogout = async () => {
    await signOut()
    navigate('/auth')
  }

  const handleExport = (format: 'csv' | 'pdf') => {
    // Implementation for export functionality
    console.log(`Exporting as ${format}`)
  }

  const handleRefresh = () => {
    // Implementation for refresh functionality
    console.log('Refreshing data')
  }

  const navigateToPage = (page: string) => {
    navigate(page)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In corso': return 'bg-blue-200 text-blue-800'
      case 'Completato': return 'bg-green-200 text-green-800'
      case 'Bloccato': return 'bg-red-200 text-red-800'
      case 'In attesa': return 'bg-yellow-200 text-yellow-800'
      default: return 'bg-gray-200 text-gray-800'
    }
  }

  const getWorkloadColor = (workload: number) => {
    if (workload > 80) return 'bg-red-500 text-white'
    if (workload > 60) return 'bg-yellow-500 text-white'
    return 'bg-green-500 text-white'
  }

  const sortedOperators = [...mockOperators].sort((a, b) => {
    switch (sortBy) {
      case 'workload': return b.workload - a.workload
      case 'name': return a.name.localeCompare(b.name)
      case 'assigned': return b.assigned - a.assigned
      default: return 0
    }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-6">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                📊 Project Manager — Dashboard
              </h1>
              <p className="mt-2 text-lg text-gray-600">
                Overview progetti, workload operatori, assegnazioni e KPI base
              </p>
            </div>
            
            <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-3">
              {/* Navigation Links */}
              <div className="flex space-x-2">
                <button
                  onClick={() => navigateToPage('/pm-projects')}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-200"
                >
                  📁 Progetti
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

              {/* Time Range Selector */}
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="today">Oggi</option>
                <option value="week">Ultima settimana</option>
                <option value="month">Ultimo mese</option>
                <option value="custom">Range personalizzato</option>
              </select>

              {/* Action Buttons */}
              <button
                onClick={handleRefresh}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Dati
              </button>
              
              <div className="relative">
                <button
                  onClick={() => handleExport('csv')}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </button>
              </div>

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
        {/* KPI Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
          {mockKPIData.map((kpi, index) => {
            const IconComponent = kpi.icon
            return (
              <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{kpi.title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">{kpi.value}</p>
                    <p className={`text-sm mt-1 ${kpi.changeColor}`}>{kpi.change}</p>
                  </div>
                  <div className={`p-3 rounded-full ${kpi.color}`}>
                    <IconComponent className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Workload Operators */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Workload Operatori</h3>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="workload">Per Carico</option>
                <option value="name">Per Nome</option>
                <option value="assigned">Per Task</option>
              </select>
            </div>
            
            <div className="space-y-4">
              {sortedOperators.map((operator, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{operator.name}</p>
                    <p className="text-sm text-gray-600">
                      {operator.completed}/{operator.assigned} task completati
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getWorkloadColor(operator.workload)}`}>
                    {operator.workload}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Active Projects */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Progetti Attivi</h3>
            <div className="space-y-4">
              {mockProjects.map((project, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{project.name}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                      {project.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Manager: {project.manager} • Operatori: {project.operators}
                  </p>
                  <div className="flex items-center">
                    <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${project.progress}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{project.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Assignments Timeline */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">Assegnazioni Recenti</h3>
          <div className="space-y-4">
            {mockAssignments.map((assignment, index) => {
              const IconComponent = assignment.icon
              return (
                <div key={index} className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <IconComponent className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{assignment.description}</p>
                    <p className="text-sm text-gray-500">{assignment.time}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Advanced Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* TTR Trend Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Trend TTR (Tempo di Risposta)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mockChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="ttr" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Workload Distribution */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Distribuzione Workload</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mockChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="workload" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}