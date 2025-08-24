import Logo from '/Logo.svg'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'


export function VirtualDeskPage() {
    const navigate = useNavigate()
    const { signOut } = useAuth()
    const [formData, setFormData] = useState({
        vd_id: '',
        name: '',
        sender_id: '',
        campaign_id: '',
    })
    
      useEffect(() => {
          
        })
        
      const handleLogout = async () => {
        await signOut()
        navigate('/auth')
      }

    const virtualDesk = localStorage.getItem('virtual_desk')
    if (virtualDesk) {
        const sessionData = JSON.parse(virtualDesk);
        console.log('Virtual Desk session found:', sessionData)
        formData.vd_id = sessionData.vd_id;
        formData.name = sessionData.name;
        formData.sender_id = sessionData.sender_id;
        formData.campaign_id = sessionData.campaign_id;
    
    }else{
        console.log( "not found");
    }
    return (
        <div className="min-h-screen bg-gray-50">
      {/* Logo e titolo allo stesso livello */}
      <div className="flex items-center pt-8 px-8">
        {/* Logo a sinistra */}
        <div className="flex-shrink-0">
          <img src={Logo} alt="Logo" className="h-20 w-auto" />
        </div>
        
        {/* Titolo centrato */}
        <div className="flex-1 flex justify-center">
          <h1 className="text-4xl font-bold text-gray-900">{formData.name}</h1>
        </div>
        
        {/* Pulsante Esci a destra */}
        <div className="flex-shrink-0">
          <button
            onClick={handleLogout}
            className="text-gray-600 hover:text-red-600 font-medium transition-colors duration-200 underline hover:no-underline"
          >
            Esci
          </button>
        </div>
      </div>

      {/* Contenuto principale */}
      
        
      
    </div>
  )
    
}