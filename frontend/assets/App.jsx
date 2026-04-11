import React from 'react';
// Importação das suas Páginas Reais
import Dashboard from './pages/Dashboard';
import GestorDashboard from './pages/GestorDashboard';
import ParentsDashboard from './pages/ParentsDashboard';
import MedicalPortal from './pages/MedicalPortal';

function App() {
  const hostname = window.location.hostname;

  // Roteamento por Domínio para os Portais Reais
  if (hostname.includes('aeecadastro')) {
    return <Dashboard />;
  }

  if (hostname.includes('aeepainel')) {
    return <GestorDashboard />;
  }

  if (hostname.includes('aee.paiva')) {
    return <ParentsDashboard />;
  }

  if (hostname.includes('atendimento')) {
    return <MedicalPortal />;
  }

  // Fallback caso acesse por IP ou domínio não mapeado
  return (
    <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>Sistema AEE - Selecione um portal válido</h1>
      <p>Domínio atual: {hostname}</p>
    </div>
  );
}

export default App;