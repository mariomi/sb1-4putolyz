import { Home, X, Mail, Send, Users, BarChart3, Globe } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '../lib/utils'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Campagne', href: '/campaigns', icon: Send },
  { name: 'Contatti', href: '/contacts', icon: Users },
  { name: 'Gruppi', href: '/groups', icon: Users },
  { name: 'Domini', href: '/domains', icon: Globe },
  { name: 'Mittenti', href: '/senders', icon: Mail },
  { name: 'Report', href: '/reports', icon: BarChart3 },
]

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Sidebar */}
      <div
        className={cn(
          'w-64 bg-white/95 backdrop-blur-xl shadow-2xl border-r border-gray-200/50 h-screen'
        )}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200/50 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform duration-300">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">MailFlow</span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-300 transform hover:scale-105"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-6 px-3">
          <div className="space-y-2">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    'flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 group',
                    isActive
                      ? 'bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 shadow-md border-r-4 border-indigo-500'
                      : 'text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:text-gray-900'
                  )
                }
                onClick={() => onClose()}
              >
                <item.icon className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform duration-300" />
                {item.name}
              </NavLink>
            ))}
          </div>
        </nav>
        
        {/* Decorative gradient at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-indigo-50/50 to-transparent pointer-events-none"></div>
      </div>
    </>
  )
}