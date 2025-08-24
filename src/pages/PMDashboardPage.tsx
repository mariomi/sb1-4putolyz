import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Area, AreaChart
} from 'recharts'
import {
  RefreshCw, Download, Calendar, TrendingUp, Users, FolderOpen,
  CheckCircle, Clock, AlertTriangle, BarChart3, FileText, UserCheck,
  Home, FolderOpen as ProjectsIcon, Users as OperatorsIcon, BarChart3 as ReportsIcon, Settings
} from 'lucide-react'
import Logo from '/Logo.svg'

// Mock data for demonstration
const mockKPIData = [
  { title: 'Progetti Attivi', value: 24, change: '+12%', icon: FolderOpen, color: 'bg-[#002F6C]', changeColor: 'text-[#00C48C]' },
  { title: 'Task Completati', value: 156, change: '+8%', icon: CheckCircle, color: 'bg-[#00C48C]', changeColor: 'text-[#00C48C]' },
  { title: 'Task Aperti', value: 43, change: '-5%', icon: FileText, color: 'bg-[#FFA726]', changeColor: 'text-[#F64C38]' },
  { title: 'TTR Medio (ore)', value: 2.4, change: '-15%', icon: Clock, color: 'bg-[#2C8EFF]', changeColor: 'text-[#00C48C]' },
  { title: 'Ticket Chiusi 24h', value: '89%', change: '+3%', icon: CheckCircle, color: 'bg-[#00C48C]', changeColor: 'text-[#00C48C]' },
  { title: 'Task Falliti', value: 7, change: '-2%', icon: AlertTriangle, color: 'bg-[#F64C38]', changeColor: 'text-[#00C48C]' }
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

const COLORS = ['#2C8EFF', '#00C48C', '#FFA726', '#F64C38', '#002F6C']

export function PMDashboardPage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [timeRange, setTimeRange] = useState('week')
  const [sortBy, setSortBy] = useState('workload')
  const [activeSection, setActiveSection] = useState('dashboard')

  const handleLogout = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error(error)
    } finally {
      navigate('/auth')
    }
  }

  const handleExport = (format: 'csv' | 'pdf') => {
    // Implementation for export functionality
    console.log(`Exporting as ${format}`)
  }

  const handleRefresh = () => {
    // Implementation for refresh functionality
    console.log('Refreshing data')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In corso': return 'bg-[#2C8EFF] text-white'
      case 'Completato': return 'bg-[#00C48C] text-white'
      case 'Bloccato': return 'bg-[#F64C38] text-white'
      case 'In attesa': return 'bg-[#FFA726] text-white'
      default: return 'bg-gray-200 text-gray-800'
    }
  }

  const getWorkloadColor = (workload: number) => {
    if (workload > 80) return 'bg-[#F64C38] text-white'
    if (workload > 60) return 'bg-[#2C8EFF] text-white'
    return 'bg-[#00C48C] text-white'
  }

  const sortedOperators = [...mockOperators].sort((a, b) => {
    switch (sortBy) {
      case 'workload': return b.workload - a.workload
      case 'name': return a.name.localeCompare(b.name)
      case 'assigned': return b.assigned - a.assigned
      default: return 0
    }
  })
  
  const NavButton = ({ section, label, icon: Icon }: { section: string, label: string, icon: React.ElementType }) => (
    <button
      onClick={() => setActiveSection(section)}
      className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
        activeSection === section 
          ? 'bg-[#2C8EFF] text-white shadow-lg' 
          : 'text-white hover:bg-[#1a4a8a] hover:text-[#2C8EFF]'
      }`}
    >
      <Icon className="w-5 h-5 mr-3" />
      {label}
    </button>
  );

  return (
    <div className="flex h-screen bg-[#F5F7FA]">
      {/* Sidebar */}
      <div className="w-64 bg-[#002F6C] text-white flex flex-col">
        <div className="p-6 flex justify-center border-b border-[#1a4a8a]">
          <img src={Logo} alt="SENDURA Logo" className="h-16 w-auto filter brightness-75 contrast-125" />
        </div>
        
        <nav className="mt-8 flex-1 px-4">
          <div className="space-y-2">
            <NavButton section="dashboard" label="Dashboard" icon={Home} />
            <NavButton section="projects" label="Progetti" icon={ProjectsIcon} />
            <NavButton section="operators" label="Operatori" icon={OperatorsIcon} />
            <NavButton section="reports" label="Report" icon={ReportsIcon} />
            <NavButton section="settings" label="Impostazioni" icon={Settings} />
          </div>
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-md border-b border-gray-100">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-[#002F6C]">
                  Project Manager Dashboard
                </h1>
                <p className="mt-2 text-lg text-[#333333]">
                  Overview progetti, workload operatori, assegnazioni e KPI base
                </p>
              </div>
              
              <div className="flex items-center space-x-4">
                <span className="text-[#333333] font-medium">Welcome, Project Manager</span>
                
                {/* Time Range Selector */}
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2C8EFF] focus:border-[#2C8EFF] text-[#333333]"
                >
                  <option value="today">Oggi</option>
                  <option value="week">Ultima settimana</option>
                  <option value="month">Ultimo mese</option>
                  <option value="custom">Range personalizzato</option>
                </select>

                {/* Action Buttons */}
                <button
                  onClick={handleRefresh}
                  className="inline-flex items-center px-4 py-2 bg-[#2C8EFF] hover:bg-[#1a6fd9] text-white font-medium rounded-xl transition-colors duration-200 shadow-md"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Dati
                </button>
                
                <button
                  onClick={() => handleExport('csv')}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-[#333333] bg-white hover:bg-gray-50 font-medium rounded-xl transition-colors duration-200 shadow-md"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </button>

                <button
                  onClick={handleLogout}
                  className="inline-flex items-center px-4 py-2 bg-[#F64C38] hover:bg-[#d93d2a] text-white font-medium rounded-xl transition-colors duration-200 shadow-md"
                >
                  Esci
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-8">
          {/* Dashboard Section */}
          {activeSection === 'dashboard' && (
            <>
              {/* KPI Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
                {mockKPIData.map((kpi, index) => {
                  const IconComponent = kpi.icon
                  return (
                    <div key={index} className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow duration-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-[#333333]">{kpi.title}</p>
                          <p className="text-3xl font-bold text-[#002F6C] mt-2">{kpi.value}</p>
                          <p className={`text-sm mt-1 font-semibold ${kpi.changeColor}`}>{kpi.change}</p>
                        </div>
                        <div className={`p-4 rounded-2xl ${kpi.color}`}>
                          <IconComponent className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Project Overview Section */}
                <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                  <h3 className="text-xl font-bold text-[#002F6C] mb-6">Project Overview</h3>
                  <div className="space-y-4">
                    {mockProjects.map((project, index) => (
                      <div key={index} className="p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors duration-200">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-[#002F6C]">{project.name}</h4>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                            {project.status}
                          </span>
                        </div>
                        <p className="text-sm text-[#333333] mb-3">
                          Manager: {project.manager} • Operatori: {project.operators}
                        </p>
                        <div className="flex items-center">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3">
                            <div 
                              className="bg-[#2C8EFF] h-2 rounded-full transition-all duration-300" 
                              style={{ width: `${project.progress}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-[#333333]">{project.progress}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Operator Workload Section */}
                <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-[#002F6C]">Operator Workload</h3>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-3 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2C8EFF] focus:border-[#2C8EFF] text-[#333333]"
                    >
                      <option value="workload">Per Carico</option>
                      <option value="name">Per Nome</option>
                      <option value="assigned">Per Task</option>
                    </select>
                  </div>
                  
                  <div className="space-y-4">
                    {sortedOperators.map((operator, index) => (
                      <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200">
                        <div className="flex-1">
                          <p className="font-medium text-[#333333]">{operator.name}</p>
                          <p className="text-sm text-[#666666]">
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
              </div>

              {/* Recent Assignments Timeline */}
              <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 mb-8">
                <h3 className="text-xl font-bold text-[#002F6C] mb-6">Assegnazioni Recenti</h3>
                <div className="space-y-4">
                  {mockAssignments.map((assignment, index) => {
                    const IconComponent = assignment.icon
                    return (
                      <div key={index} className="flex items-start space-x-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-[#2C8EFF] rounded-full flex items-center justify-center">
                          <IconComponent className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#333333]">{assignment.description}</p>
                          <p className="text-sm text-[#666666]">{assignment.time}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Advanced Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* TTR Trend Chart */}
                <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                  <h3 className="text-xl font-bold text-[#002F6C] mb-6">Trend TTR (Tempo di Risposta)</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={mockChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="name" tick={{ fill: '#333333' }} />
                      <YAxis tick={{ fill: '#333333' }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #E5E7EB',
                          borderRadius: '12px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="ttr" stroke="#2C8EFF" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Workload Distribution */}
                <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                  <h3 className="text-xl font-bold text-[#002F6C] mb-6">Distribuzione Workload</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={mockChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="name" tick={{ fill: '#333333' }} />
                      <YAxis tick={{ fill: '#333333' }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #E5E7EB',
                          borderRadius: '12px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Legend />
                      <Bar dataKey="workload" fill="#00C48C" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {/* Projects Section (Placeholder) */}
          {activeSection === 'projects' && (
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8">
              <h2 className="text-2xl font-bold text-[#002F6C] mb-6">Sezione Progetti</h2>
              <p className="text-[#333333]">Qui verrà visualizzato il contenuto relativo ai progetti.</p>
            </div>
          )}

          {/* Operators Section (Placeholder) */}
          {activeSection === 'operators' && (
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8">
              <h2 className="text-2xl font-bold text-[#002F6C] mb-6">Sezione Operatori</h2>
              <p className="text-[#333333]">Qui verrà visualizzato il contenuto relativo agli operatori.</p>
            </div>
          )}

          {/* Reports Section (Placeholder) */}
          {activeSection === 'reports' && (
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8">
              <h2 className="text-2xl font-bold text-[#002F6C] mb-6">Sezione Report</h2>
              <p className="text-[#333333]">Qui verrà visualizzato il contenuto relativo ai report.</p>
            </div>
          )}

          {/* Settings Section */}
          {activeSection === 'settings' && (
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8">
              <h2 className="text-2xl font-bold text-[#002F6C] mb-6">Impostazioni</h2>
              <div className="space-y-6">
                <div className="border-b border-gray-200 pb-6">
                  <h3 className="text-lg font-semibold text-[#333333] mb-4">Preferenze Dashboard</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#666666] mb-2">Range Temporale Predefinito</label>
                      <select defaultValue="week" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2C8EFF] focus:border-[#2C8EFF] text-[#333333]">
                        <option value="today">Oggi</option>
                        <option value="week">Ultima settimana</option>
                        <option value="month">Ultimo mese</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#666666] mb-2">Ordinamento Operatori</label>
                      <select defaultValue="workload" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2C8EFF] focus:border-[#2C8EFF] text-[#333333]">
                        <option value="workload">Per Carico</option>
                        <option value="name">Per Nome</option>
                        <option value="assigned">Per Task</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="border-b border-gray-200 pb-6">
                  <h3 className="text-lg font-semibold text-[#333333] mb-4">Notifiche</h3>
                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-3 rounded border-gray-300 text-[#2C8EFF] focus:ring-[#2C8EFF]" defaultChecked />
                      <span className="text-[#333333]">Notifiche email per task completati</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-3 rounded border-gray-300 text-[#2C8EFF] focus:ring-[#2C8EFF]" defaultChecked />
                      <span className="text-[#333333]">Notifiche per progetti bloccati</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-3 rounded border-gray-300 text-[#2C8EFF] focus:ring-[#2C8EFF]" />
                      <span className="text-[#333333]">Report settimanali automatici</span>
                    </label>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-[#333333] mb-4">Esportazione Dati</h3>
                  <div className="space-y-3">
                    <button className="inline-flex items-center px-4 py-2 bg-[#2C8EFF] hover:bg-[#1a6fd9] text-white font-medium rounded-xl transition-colors duration-200 shadow-md">
                      <Download className="w-4 h-4 mr-2" />
                      Esporta Configurazione
                    </button>
                    <button className="inline-flex items-center px-4 py-2 border border-gray-300 text-[#333333] bg-white hover:bg-gray-50 font-medium rounded-xl transition-colors duration-200 shadow-md ml-3">
                      <Download className="w-4 h-4 mr-2" />
                      Importa Configurazione
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}