import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { createClient } from '@supabase/supabase-js';

// Direct Supabase client with updated keys for testing
const supabase = createClient(
  'https://xqsjyvqikrvibyluynwv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxc2p5dnFpa3J2aWJ5bHV5bnd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MzIzOTgsImV4cCI6MjA2ODUwODM5OH0.rfBsX1s-3dJcr7hvd9x3hHW7WZPJpT-SMYrMfiG8fgc'
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Lightweight fetch interceptor for dev to return role by operator id
// GET /api/operator-role?operator_id=OP-XXXX
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === 'string' ? new URL(input, window.location.origin) : new URL((input as any).url || input.toString());
      if (url.pathname === '/api/operator-role') {
        const operatorId = url.searchParams.get('operator_id') || '';
        const { data } = await supabase.rpc('get_email_and_role_by_operator', { _operator_id: operatorId });
        const email = (data?.[0]?.email as string) || '';
        const role = (data?.[0]?.role as string) || '';
        return new Response(JSON.stringify({ email, role }), { headers: { 'Content-Type': 'application/json' } });
      }
      
      if (url.pathname === '/api/operator-roles') {
        const operatorId = url.searchParams.get('operator_id') || '';
        const { data } = await supabase.rpc('get_roles_by_operator', { _operator_id: operatorId });
        const roles = (data || []).map((item: any) => item.role);
        return new Response(JSON.stringify({ roles }), { headers: { 'Content-Type': 'application/json' } });
      }
      
      if (url.pathname === '/api/authenticate-operator') {
        const operatorId = url.searchParams.get('operator_id') || '';
        const accessKey = url.searchParams.get('access_key') || '';
        const { data, error } = await supabase.rpc('authenticate_operator', { 
          _operator_id: operatorId, 
          _access_key: accessKey 
        });
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { 
            status: 400, 
            headers: { 'Content-Type': 'application/json' } 
          });
        }
        
        return new Response(JSON.stringify({ data }), { headers: { 'Content-Type': 'application/json' } });
      }
    } catch {}
    return originalFetch(input as any, init);
  };
}
