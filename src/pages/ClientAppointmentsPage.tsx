import { Calendar } from 'lucide-react'

export function ClientAppointmentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Report & Appuntamenti</h1>
        <p className="text-gray-600 mt-2">Accesso in sola lettura ai report e alla lista appuntamenti</p>
      </div>
      <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/50">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900">Area in preparazione</h3>
        </div>
        <p className="text-gray-600">Questa sezione mostrerà gli appuntamenti generati e i relativi report. Può essere collegata a calendari esterni o a un modulo dedicato.</p>
      </div>
    </div>
  )
}

