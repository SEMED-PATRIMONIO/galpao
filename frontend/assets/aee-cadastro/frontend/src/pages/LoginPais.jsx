import React, { useState } from 'react';

const LoginPais = () => {
  const [credentials, setCredentials] = useState({ usuario: '', senha: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:3006/api/pais/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (response.ok) {
        // Armazena o token e os dados do pai/aluno
        localStorage.setItem('token_pai', data.token);
        localStorage.setItem('user_pai', JSON.stringify(data.user));
        
        // Redireciona para o Dashboard dos Pais
        window.location.href = '/portal-pais';
      } else {
        setError(data.error || 'Falha na autenticação');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl shadow-slate-200 overflow-hidden border border-slate-100">
        
        {/* Banner Superior */}
        <div className="bg-blue-600 p-10 text-center text-white">
          <div className="text-4xl mb-4">🏠</div>
          <h1 className="text-2xl font-black uppercase tracking-tighter italic">
            AEE <span className="text-blue-200">Família</span>
          </h1>
          <p className="text-blue-100 text-xs font-bold mt-2 opacity-80 uppercase tracking-widest">Acesso do Responsável</p>
        </div>

        <form onSubmit={handleLogin} className="p-10 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-500 text-[10px] font-black uppercase p-4 rounded-2xl border border-red-100 text-center">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">Usuário / CPF</label>
            <input
              type="text"
              name="usuario"
              required
              className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none font-bold text-slate-700 transition-all"
              placeholder="Digite seu usuário..."
              value={credentials.usuario}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">Senha / PIN</label>
            <input
              type="password"
              name="senha"
              required
              className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none font-bold text-slate-700 transition-all"
              placeholder="••••"
              value={credentials.senha}
              onChange={handleChange}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Verificando...' : 'Entrar no Portal'}
          </button>
          
          <p className="text-center text-[10px] text-slate-400 font-bold uppercase mt-4">
            Em caso de dúvidas, contacte a secretaria da escola.
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginPais;