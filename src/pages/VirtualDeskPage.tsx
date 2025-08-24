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
    const [mails, setMails] = useState([])
    useEffect(() => {
        
      })
    function toBase64(str: string): string {
  // gestisce anche caratteri non-ASCII
  return btoa(unescape(encodeURIComponent(str)));
}
    const  readMail = async (id: string) => {
        
        const token = toBase64(`no-reply@greenleads.xyz:dcc1c0ca799b9136436c62a4`);

        var mails_fetched = await fetch('https://api.forwardemail.net/v1/messages/'+id, {
          headers: {
            Authorization: 'Basic ' + token,
          }
        })
        
        var stream = mails_fetched.body?.getReader();
        var done_mail = false;
        while(!done_mail){
          await stream?.read().then(({ done, value }) => {
          if (done) {
            console.log('No more data to read.');
            done_mail = true;
            return;
          }
          const chunk = new TextDecoder("utf-8").decode(value);
          console.log('Received content:', JSON.parse(chunk).nodemailer.text);  //qua da rosso  ma in realta funziona lo stesso 
          
          // Puoi continuare a leggere altri chunk se necessario
        });
        }

            
      } 
    const fetchMails = async () => {
        console.log('Fetching mails for virtual desk:')
        const token = toBase64(`no-reply@greenleads.xyz:dcc1c0ca799b9136436c62a4`);

        var mails_fetched = await fetch('https://api.forwardemail.net/v1/messages', {
          headers: {
            Authorization: 'Basic ' + token,
          }
        })
        console.log('Response received:', mails_fetched.status);
        var stream = mails_fetched.body?.getReader();
        var done_mail = false;
        while(!done_mail){
          await stream?.read().then(({ done, value }) => {
          if (done) {
            console.log('No more data to read.');
            done_mail = true;
            return;
          }
          const chunk = new TextDecoder("utf-8").decode(value);
          setMails(JSON.parse(chunk));
          console.log('Received chunk:', mails[1]);  //qua da rosso  ma in realta funziona lo stesso 
          readMail(mails[1].id);
          // Puoi continuare a leggere altri chunk se necessario
        });
        }

            
      } 
    const handleLogout = async () => {
      await signOut()
      navigate('/auth')
    }

    const virtualDesk = localStorage.getItem('virtual_desk')
    if (virtualDesk) {
        const sessionData = JSON.parse(virtualDesk);
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
      <button
          type="button"
          onClick={fetchMails}
          className="w-full bg-gradient-to-r from-[#0b2e63] to-[#1e40af] text-white py-4 px-6 rounded-lg text-lg font-semibold hover:from-[#08234a] hover:to-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-[#0b2e63] focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
        >
        request
      </button>
        
      
    </div>
  )
    
}