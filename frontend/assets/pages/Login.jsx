import React, { useState } from 'react';

const Login = ({ onLoginSuccess }) => {
  const [credentials, setCredentials] = useState({ login: '', senha: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onLoginSuccess(data.user);
      } else {
        setError(data.message || 'Falha no login');
      }
    } catch (err) {
      setError('Erro ao conectar ao servidor');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/assets/logap.png" alt="Logo" className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800">AEE Cadastro</h1>
          <p className="text-slate-500">Acesso restrito à equipe</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Usuário"
            className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => setCredentials({ ...credentials, login: e.target.value })}
          />
          <input
            type="password"
            placeholder="Senha"
            className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => setCredentials({ ...credentials, senha: e.target.value })}
          />
          {error && <p className="text-red-500 text-sm text-center font-medium">{error}</p>}
          <button className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all">
            Entrar no Sistema
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;