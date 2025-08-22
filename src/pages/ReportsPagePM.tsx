import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Area, AreaChart, ComposedChart
} from 'recharts'
import { 
  Download, Calendar, TrendingUp, Users, FolderOpen, 
  CheckCircle, Clock, AlertTriangle, BarChart3, FileText, 
  Filter, RefreshCw, Eye, Printer
} from 'lucide-react'

// Mock data for reports
const mockProjectData = [
  { month: 'Gen', completed: 12, inProgress: 8, blocked: 3, total: 23 },
  { month: 'Feb', completed: 15, inProgress: 10, blocked: 2, total: 27 },
  { month: 'Mar', completed: 18, inProgress: 12, blocked: 1, total: 31 },
  { month: 'Apr', completed: 22, inProgress: 15, blocked: 0, total: 37 },
  { month: 'Mag', completed: 25, inProgress: 18, blocked: 2, total: 45 },
  { month: 'Giu', completed: 28, inProgress: 20, blocked: 1, total: 49 }
]

const mockOperatorPerformance = [
  { name: 'Marco Rossi', tasks: 45, avgTime: 2.1, rating: 4.8, efficiency: 92 },
  { name: 'Anna Bianchi', tasks: 52, avgTime: 1.8, rating: 4.9, efficiency: 95 },
  { name: 'Luca Verdi', tasks: 38, avgTime: 2.8, rating: 4.5, efficiency: 87 },
  { name: 'Sofia Neri', tasks: 41, avgTime: 2.0, rating: 4.7, efficiency: 90 },
  { name: 'Giuseppe Gialli', tasks: 35, avgTime: 2.5, rating: 4.3, efficiency: 85 }
]

const mockDepartmentStats = [
  { name: 'Marketing', projects: 8, operators: 12, budget: 125000, completion: 78 },
  { name: 'Sales', projects: 6, operators: 8, budget: 98000, completion: 85 },
  { name: 'Technical', projects: 10, operators: 15, budget: 180000, completion: 72 },
  { name: 'Customer Service', projects: 4, operators: 6, budget: 65000, completion: 90 }
]

const mockTimeTracking = [
  { day: 'Lun', planned: 8, actual: 7.5, efficiency: 94 },
  { day: 'Mar', planned: 8, actual: 8.2, efficiency: 103 },
  { day: 'Mer', planned: 8, actual: 7.8, efficiency: 98 },
  { day: 'Gio', planned: 8, actual: 8.5, efficiency: 106 },
  { day: 'Ven', planned: 8, actual: 7.2, efficiency: 90 },
  { day: 'Sab', planned: 4, actual: 3.8, efficiency: 95 },
  { day: 'Dom', planned: 0, actual: 0, efficiency: 100 }
]

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

export function ReportsPage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [dateRange, setDateRange] = useState('month')
  const [reportType, setReportType] = useState('overview')
  const [departmentFilter, setDepartmentFilter] = useState('all')

  const handleLogout = async () => {
    await signOut()
    navigate('/auth')
  }

  const navigateToPage = (page: string) => {
    navigate(page)
  }

  const handleExport = (format: 'csv' | 'pdf' | 'excel') => {
    console.log(`Exporting report as ${format}`)
  }

  const handlePrint = () => {
    window.print()
  }

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 95) return 'text-green-600'
    if (efficiency >= 85) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getCompletionColor = (completion: number) => {
    if (completion >= 80) return 'text-green-600'
    if (completion >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-6">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                📊 Report e Analisi
              </h1>
              <p className="mt-2 text-lg text-gray-600">
                Dashboard analitica e report dettagliati per il management
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
                  onClick={() => navigateToPage('/pm-operators')}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-200"
                >
                  👥 Operatori
                </button>
              </div>

              <button
                onClick={handlePrint}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Printer className="w-4 h-4 mr-2" />
                Stampa
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
        {/* Report Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Intervallo Temporale</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="week">Ultima settimana</option>
                <option value="month">Ultimo mese</option>
                <option value="quarter">Ultimo trimestre</option>
                <option value="year">Ultimo anno</option>
                <option value="custom">Range personalizzato</option>
              </select>
            </div>

            {/* Report Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo Report</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="overview">Panoramica Generale</option>
                <option value="projects">Report Progetti</option>
                <option value="operators">Performance Operatori</option>
                <option value="departments">Analisi Dipartimenti</option>
                <option value="financial">Report Finanziari</option>
              </select>
            </div>

            {/* Department Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dipartimento</label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Tutti i dipartimenti</option>
                <option value="marketing">Marketing</option>
                <option value="sales">Sales</option>
                <option value="technical">Technical</option>
                <option value="customer-service">Customer Service</option>
              </select>
            </div>

            {/* Refresh Button */}
            <div className="flex items-end">
              <button className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                <RefreshCw className="w-4 h-4 mr-2" />
                Aggiorna
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FolderOpen className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Progetti Attivi</dt>
                  <dd className="text-lg font-medium text-gray-900">24</dd>
                </dl>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm text-green-600">+12% rispetto al mese scorso</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Operatori Online</dt>
                  <dd className="text-lg font-medium text-gray-900">18</dd>
                </dl>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm text-green-600">+3 rispetto a ieri</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Task Completati</dt>
                  <dd className="text-lg font-medium text-gray-900">156</dd>
                </dl>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm text-green-600">+8% rispetto alla settimana scorsa</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Clock className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">TTR Medio</dt>
                  <dd className="text-lg font-medium text-gray-900">2.4h</dd>
                </dl>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm text-green-600">-15% rispetto al mese scorso</div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Project Progress Over Time */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Andamento Progetti nel Tempo</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={mockProjectData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" fill="#10B981" name="Completati" />
                <Bar dataKey="inProgress" fill="#3B82F6" name="In Corso" />
                <Bar dataKey="blocked" fill="#EF4444" name="Bloccati" />
                <Line type="monotone" dataKey="total" stroke="#8B5CF6" strokeWidth={2} name="Totale" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Operator Performance */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Operatori</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mockOperatorPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="tasks" fill="#3B82F6" name="Task Completati" />
                <Bar dataKey="efficiency" fill="#10B981" name="Efficienza %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Analysis */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Analisi per Dipartimento</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dipartimento</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progetti</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Operatori</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Budget</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completamento</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trend</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {mockDepartmentStats.map((dept, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{dept.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{dept.projects}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{dept.operators}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">€{dept.budget.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${getCompletionColor(dept.completion)}`}>
                        {dept.completion}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                        <span className="text-sm text-green-600">+5%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Time Tracking and Efficiency */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Time Tracking */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tracking Tempo Settimanale</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={mockTimeTracking}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="planned" stackId="1" stroke="#8884d8" fill="#8884d8" name="Pianificato" />
                <Area type="monotone" dataKey="actual" stackId="1" stroke="#82ca9d" fill="#82ca9d" name="Effettivo" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Efficiency Distribution */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribuzione Efficienza Operatori</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={mockOperatorPerformance}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, efficiency }) => `${name}: ${efficiency}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="efficiency"
                >
                  {mockOperatorPerformance.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Performance Metrics */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Metriche Dettagliate Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockOperatorPerformance.map((operator, index) => (
              <div key={index} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">{operator.name}</h4>
                  <span className={`text-sm font-medium ${getEfficiencyColor(operator.efficiency)}`}>
                    {operator.efficiency}%
                  </span>
                </div>
                
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Task Completati:</span>
                    <span className="font-medium">{operator.tasks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>TTR Medio:</span>
                    <span className="font-medium">{operator.avgTime}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rating:</span>
                    <span className="font-medium">{operator.rating}/5</span>
                  </div>
                </div>

                {/* Efficiency Bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Efficienza</span>
                    <span>{operator.efficiency}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        operator.efficiency >= 95 ? 'bg-green-500' : 
                        operator.efficiency >= 85 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${operator.efficiency}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Export Options */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Opzioni di Export</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleExport('csv')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <FileText className="w-4 h-4 mr-2" />
              Export PDF
            </button>
            <button
              onClick={() => handleExport('excel')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Export Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}