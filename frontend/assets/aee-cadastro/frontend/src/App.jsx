import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Importação das Páginas
import Login from './pages/Login';
import LoginPais from './pages/LoginPais';
import Dashboard from './pages/Dashboard';
import PaiDashboard from './pages/PaiDashboard';
import ProfissionalDashboard from './pages/ProfissionalDashboard';
import DiretoriaDashboard from './pages/DiretoriaDashboard';
import GestorDashboard from './pages/GestorDashboard';

/**
 * Componente de Rota Protegida
 * Verifica a existência do token e se o perfil do usuário é compatível com a rota.
 */
const ProtectedRoute = ({ children, roleRequired }) => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  if (!token) {
    // Redireciona para o login correspondente à intenção de acesso 
    return <Navigate to={roleRequired === 'pai' ? '/login-pais' : '/login'} replace />;
  }

  // Regra de segurança específica para o Portal dos Pais 
  if (roleRequired === 'pai' && !user.aluno_id) {
    return <Navigate to="/login-pais" replace />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* --- ROTAS PÚBLICAS --- */}
        <Route path="/login" element={<Login />} />
        <Route path="/login-pais" element={<LoginPais />} />

        {/* --- ROTAS DA EQUIPE TÉCNICA (PROTEGIDAS) --- */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute roleRequired="equipe">
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/diretoria" 
          element={
            <ProtectedRoute roleRequired="equipe">
              <DiretoriaDashboard />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/gestor" 
          element={
            <ProtectedRoute roleRequired="equipe">
              <GestorDashboard />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/profissional" 
          element={
            <ProtectedRoute roleRequired="equipe">
              <ProfissionalDashboard />
            </ProtectedRoute>
          } 
        />

        {/* --- ROTAS DOS PAIS (PROTEGIDAS) --- */}
        <Route 
          path="/pai-dashboard" 
          element={
            <ProtectedRoute roleRequired="pai">
              <PaiDashboard />
            </ProtectedRoute>
          } 
        />

        {/* --- REDIRECIONAMENTO E 404 --- */}
        {/* Se o usuário acessar a raiz, tenta mandar para o dashboard principal [cite: 1] */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* Captura qualquer rota inexistente e manda para o login  */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;