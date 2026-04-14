import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Importação das Páginas
import Login from './pages/Login';
import LoginPais from './pages/LoginPais';
import Dashboard from './pages/Dashboard';
import PaiDashboard from './pages/PaiDashboard';

/**
 * Componente de Rota Protegida
 * Verifica se existe um token no localStorage antes de liberar o acesso.
 */
const ProtectedRoute = ({ children, roleRequired }) => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  if (!token) {
    // Se não houver token, manda para o login de acordo com a intenção
    return <Navigate to={roleRequired === 'pai' ? '/login-pais' : '/login'} />;
  }

  // Verifica se o usuário tem o "cargo" certo para aquela rota (Opcional)
  if (roleRequired === 'pai' && !user.aluno_id) {
    return <Navigate to="/login-pais" />;
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

        {/* --- ROTAS DOS PAIS (PROTEGIDAS) --- */}
        <Route 
          path="/pai-dashboard" 
          element={
            <ProtectedRoute roleRequired="pai">
              <PaiDashboard />
            </ProtectedRoute>
          } 
        />

        {/* --- REDIRECIONAMENTO PADRÃO --- */}
        <Route path="/" element={<Navigate to="/login" />} />
        
        {/* Rota 404 (Pode ser criada depois) */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;