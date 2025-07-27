import { Menu, Bell, User } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { signOut } = useAuth()

  return (
    <header className="bg-white/80 backdrop-blur-xl shadow-lg border-b border-gray-200/50">
      <div className="flex items-center justify-between h-16 px-6">
        <div className="flex items-center">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-300 transform hover:scale-105"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center space-x-4">
          <button className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 relative">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
          </button>
          
          <div className="relative">
            <button
              onClick={() => signOut()}
              className="flex items-center space-x-2 p-2 rounded-xl text-gray-700 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 transition-all duration-300 transform hover:scale-105"
            >
              <User className="h-5 w-5" />
              <span className="text-sm font-semibold">Esci</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}