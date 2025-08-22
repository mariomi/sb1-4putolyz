import Logo from '/Logo.svg'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// Nota: Per visualizzare le icone, assicurati di aver importato Font Awesome
// nel tuo progetto. Puoi aggiungerlo nel file `index.html` pubblico:
// <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" />

export function PMDashboardPage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  const handleLogout = async () => {
    await signOut()
    navigate('/auth')
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 text-white flex flex-col">
        <div className="p-4 flex justify-center">
            <img src={Logo} alt="Sendura Logo" className="h-20 w-auto" />
        </div>
        <nav className="mt-10 flex-1">
          <a href="#" className="block py-2.5 px-4 rounded transition duration-200 bg-gray-700">
            <i className="fas fa-tachometer-alt mr-3"></i>Dashboard
          </a>
          <a href="#" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
            <i className="fas fa-tasks mr-3"></i>Projects
          </a>
          <a href="#" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
            <i className="fas fa-users mr-3"></i>Operators
          </a>
          <a href="#" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
            <i className="fas fa-chart-line mr-3"></i>Reports
          </a>
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex justify-between items-center p-4 bg-white border-b">
          <h1 className="text-2xl font-bold">Project Manager Dashboard</h1>
          <div className="flex items-center">
            <span className="mr-4 hidden sm:block">Welcome, Project Manager</span>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded transition-colors duration-200"
            >
              Esci
            </button>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-200 p-6">
          {/* KPI Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-semibold">Total Projects</h3>
              <p className="text-3xl font-bold">12</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-semibold">Operators Online</h3>
              <p className="text-3xl font-bold">8</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-semibold">Pending Assignments</h3>
              <p className="text-3xl font-bold">4</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-semibold">Overall Progress</h3>
              <p className="text-3xl font-bold">75%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Project Overview Section */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-4">Project Overview</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th className="py-2">Project Name</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-2">Project Alpha</td>
                      <td className="py-2"><span className="bg-green-200 text-green-800 py-1 px-3 rounded-full text-xs">Active</span></td>
                      <td className="py-2">
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: '45%' }}></div>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2">Project Beta</td>
                      <td className="py-2"><span className="bg-yellow-200 text-yellow-800 py-1 px-3 rounded-full text-xs">Pending</span></td>
                      <td className="py-2">
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: '10%' }}></div>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2">Project Gamma</td>
                      <td className="py-2"><span className="bg-red-200 text-red-800 py-1 px-3 rounded-full text-xs">Overdue</span></td>
                      <td className="py-2">
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: '80%' }}></div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Operator Workload Section */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-4">Operator Workload</h3>
              <ul>
                <li className="flex justify-between items-center mb-2 p-2 rounded hover:bg-gray-50">
                  <span>Operator 1</span>
                  <span className="bg-blue-500 text-white px-2 py-1 rounded">High</span>
                </li>
                <li className="flex justify-between items-center mb-2 p-2 rounded hover:bg-gray-50">
                  <span>Operator 2</span>
                  <span className="bg-green-500 text-white px-2 py-1 rounded">Normal</span>
                </li>
                <li className="flex justify-between items-center p-2 rounded hover:bg-gray-50">
                  <span>Operator 3</span>
                  <span className="bg-yellow-500 text-white px-2 py-1 rounded">Low</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Assignments Section */}
          <div className="bg-white p-6 rounded-lg shadow mt-6">
            <h3 className="text-xl font-bold mb-4">Assignments</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                <thead>
                    <tr>
                    <th className="py-2">Task</th>
                    <th className="py-2">Assigned To</th>
                    <th className="py-2">Due Date</th>
                    <th className="py-2">Status</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                    <td className="py-2">Review Project Alpha KPIs</td>
                    <td className="py-2">Operator 1</td>
                    <td className="py-2">2025-08-25</td>
                    <td className="py-2"><span className="bg-blue-200 text-blue-800 py-1 px-3 rounded-full text-xs">In Progress</span></td>
                    </tr>
                    <tr>
                    <td className="py-2">Start initial work on Project Beta</td>
                    <td className="py-2">Operator 2</td>
                    <td className="py-2">2025-08-28</td>
                    <td className="py-2"><span className="bg-gray-200 text-gray-800 py-1 px-3 rounded-full text-xs">Not Started</span></td>
                    </tr>
                </tbody>
                </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}