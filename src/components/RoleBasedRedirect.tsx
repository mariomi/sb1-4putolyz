import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

interface RoleBasedRedirectProps {
  children: React.ReactNode
}

export function RoleBasedRedirect({ children }: RoleBasedRedirectProps) {
  const { user } = useAuth()
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUserRole = async () => {
      if (!user) {
        setLoading(false)
        return
      }

      try {
        // Controlla se c'è una sessione operatore locale
        const operatorSession = localStorage.getItem('operator_session')
        if (operatorSession) {
          const sessionData = JSON.parse(operatorSession)
          setUserRole(sessionData.role)
          setLoading(false)
          return
        }

        // Altrimenti cerca il ruolo nel database
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        setUserRole(profile?.role || null)
      } catch (error) {
        console.error('Error fetching user role:', error)
        setUserRole(null)
      } finally {
        setLoading(false)
      }
    }

    getUserRole()
  }, [user])

  if (loading) {
    return <div>Caricamento...</div>
  }

  if (!userRole) {
    return <>{children}</>
  }

  // Reindirizzamento basato sul ruolo
  const roleRedirects: { [key: string]: string } = {
    'reply_operator': '/reply-operator',
    'admin': '/admin',
    'project_manager': '/pm-dashboard',
    'booking_discovery': '/booking-discovery-call'
  }

  const redirectPath = roleRedirects[userRole.toLowerCase()]
  
  if (redirectPath && window.location.pathname !== redirectPath) {
    console.log(`Redirecting ${userRole} to ${redirectPath}`)
    return <Navigate to={redirectPath} replace />
  }

  return <>{children}</>
}
