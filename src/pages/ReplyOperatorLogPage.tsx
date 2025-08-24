import Logo from '/Logo.svg'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export function ReplyOperatorLogPage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [formData, setFormData] = useState({
      virtualDesk: '',
      idOperatore: '',
    })
  const [availableDesks, setAvailableDesks] = useState<[any]>([''])

  const findVDesk = (id:any) => {
    for (let i = 0; i < availableDesks.length; i++) {
      if (availableDesks[i].vd_id == id) {
        return availableDesks[i];
      }
    }
  };
  useEffect(() => {
      const fetchRoles = async () => {
        if (!formData.idOperatore) {
          setAvailableDesks([''])
          return
        }
        
        try {
          console.log('Fetching desks for operator:', formData.idOperatore)
          const { data, error } = await supabase.rpc('get_virtual_desks')
          
          if (error) {
            console.error('Error fetching desks:', error)
            setAvailableDesks([''])
            return
          }
          
          
          const desks = (data || []).map((r: any) => r )
          console.log('Desks fetched successfully:', desks)
          setAvailableDesks(desks)
          if (desks.length && !formData.virtualDesk) {
            setFormData((prev) => ({ ...prev, virtualDesk: desks[0].vd_id }) )
          }
        } catch (err) {
          console.error('Exception fetching desks:', err)
          setAvailableDesks( [''])
        }
      }
      fetchRoles()
    }, [formData.idOperatore])
    
  const handleLogout = async () => {
    await signOut()
    navigate('/auth')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if(formData.virtualDesk == '') {
      alert('Seleziona una Virtual Desk')
      return
    }
    console.log("qualcosa ",formData.virtualDesk ,"--->", findVDesk(formData.virtualDesk) )
    localStorage.setItem('virtual_desk', JSON.stringify( findVDesk(formData.virtualDesk)))
    navigate('/virtual-desk')
    
  }
  const operatorSession = localStorage.getItem('operator_session')
  if (operatorSession) {
    const sessionData = JSON.parse(operatorSession);
    formData.idOperatore = sessionData.operator_id;
    
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
          <h1 className="text-4xl font-bold text-gray-900">Reply Operator Log</h1>
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
      <main className="px-8 pt-12">
        <div className="max-w-7xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Virtual Desk</label>
                  <select
                    onChange={(e) => setFormData({ ...formData, virtualDesk: e.target.value })}
                    className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0b2e63] focus:border-transparent appearance-none transition-all duration-200"
                  >
                    <option value="" disabled>
                      {'seleziona la Virtual Desk'}
                    </option>
                    { availableDesks.map((r: any) => ( <option key={r.vd_id} value={r.vd_id}>{r.name}</option>)) }
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ID Operatore</label>
                  <input
                    disabled = {true}
                    type="text"
                    className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0b2e63] focus:border-transparent transition-all duration-200"
                    value={formData.idOperatore}
                    
                  />
                </div>

                

                <button
                  type="button"
                
                  className="w-full bg-gradient-to-r from-[#0b2e63] to-[#1e40af] text-white py-4 px-6 rounded-lg text-lg font-semibold hover:from-[#08234a] hover:to-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-[#0b2e63] focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                dashboard
                </button>

                <button
                  type="submit"
                
                  className="w-full bg-gradient-to-r from-[#15ab37] to-[#14db42] text-white py-4 px-6 rounded-lg text-lg font-semibold hover:from-[#139430] hover:to-[#15ab37] focus:outline-none focus:ring-2 focus:ring-[#15ab37] focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                entra
                </button>

                
              </form>
        </div>
      </main>
    </div>
  )
}
