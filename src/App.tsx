import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthPage } from './pages/AuthPage'
import { Dashboard } from './pages/Dashboard'
import { CampaignsPage } from './pages/CampaignsPage'
import { ContactsPage } from './pages/ContactsPage'
import { GroupsPage } from './pages/GroupsPage'
import { DomainsPage } from './pages/DomainsPage'
import { SendersPage } from './pages/SendersPage'
import { ReportsPage } from './pages/ReportsPage'
import { LeadsViewPage } from './pages/LeadsViewPage'
import { ClientAppointmentsPage } from './pages/ClientAppointmentsPage'
import { ReplyOperatorLogPage } from './pages/ReplyOperatorLogPage'
import { AdminPage } from './pages/AdminPage'
import { PMDashboardPage } from './pages/PMDashboardPage'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'

function App() {
  return (
    //<Router basename="/sb1-4putolyz-main">
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#fff',
              color: '#374151',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            },
          }}
        />
        
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          
          {/* Rotte specifiche per ruolo - senza Layout */}
          <Route
            path="/reply-operator"
            element={
              <ProtectedRoute>
                <ReplyOperatorLogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pm-dashboard"
            element={
              <ProtectedRoute>
                <PMDashboardPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="" element={<Dashboard />} />
            <Route path="campaigns" element={<CampaignsPage />} />
            <Route path="contacts" element={<ContactsPage />} />
            <Route path="groups" element={<GroupsPage />} />
            <Route path="domains" element={<DomainsPage />} />
            <Route path="senders" element={<SendersPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="leads" element={<LeadsViewPage />} />
            <Route path="client" element={<ClientAppointmentsPage />} />
          </Route>
        </Routes>
      </div>
    </Router>
  )
}

export default App