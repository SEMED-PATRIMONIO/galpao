import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Importação das Páginas
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LoginPais from './pages/LoginPais';
import PaiDashboard from './pages/PaiDashboard';
import ProfissionalDashboard from './pages/ProfissionalDashboard';
import DiretoriaDashboard from './pages/DiretoriaDashboard';
import GestorDashboard from './pages/GestorDashboard';

/**
 * COMPONENTE DE PROTEÇÃO (PrivateRoute)
 * Ele verifica se o usuário está autenticado antes de liberar a página.
 */
const PrivateRoute = ({ children }) => {
  const user = JSON.parse(localStorage.getItem('user'));
  const token = localStorage.getItem('token');

  // Se não houver token ou usuário, manda para o login
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* ROTAS PÚBLICAS */}
        <Route path="/login" element={<Login />} />
        <Route path="/login-pais" element={<LoginPais />} />

        {/* ROTAS PROTEGIDAS (Só entra se estiver logado) */}
        <Route 
          path="/dashboard" 
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } 
        />
        
        <Route 
          path="/diretoria" 
          element={
            <PrivateRoute>
              <DiretoriaDashboard />
            </PrivateRoute>
          } 
        />

        <Route 
          path="/gestor" 
          element={
            <PrivateRoute>
              <GestorDashboard />
            </PrivateRoute>
          } 
        />

        <Route 
          path="/profissional" 
          element={
            <PrivateRoute>
              <ProfissionalDashboard />
            </PrivateRoute>
          } 
        />

        <Route 
          path="/pai" 
          element={
            <PrivateRoute>
              <PaiDashboard />
            </PrivateRoute>
          } 
        />

        {/* REDIRECIONAMENTO PADRÃO: 
            Se o cara digitar qualquer coisa ou tentar acessar a raiz '/', 
            o sistema decide para onde mandar. */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* ROTA DE CAPTURA (Caso a URL não exista) */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;