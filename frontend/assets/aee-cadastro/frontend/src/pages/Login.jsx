import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

const Login = () => {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, senha }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        Swal.fire({
          icon: 'success',
          title: 'Acesso Autorizado',
          text: `Bem-vindo, ${data.user.nome || data.user.login}!`,
          timer: 1500,
          showConfirmButton: false
        });

        navigate('/dashboard');
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Falha no Login',
          text: data.error || 'Usuário ou senha incorretos.',
        });
      }
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      Swal.fire({
        icon: 'error',
        title: 'Erro no Servidor',
        text: 'Não foi possível conectar ao serviço de autenticação.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-blue-50">
        <div className="p-8">

          {/* LOGO / TÍTULO */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-3xl shadow-lg shadow-blue-200 mb-4">
              <span className="text-white text-4xl font-black">AE</span>
            </div>
            <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Portal Gestor</h1>
            {/* ✅ ALTERADO */}
            <p className="text-slate-400 font-medium">Atendimento Especial & Inclusivo</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">

            {/* CAMPO USUÁRIO */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">
                Usuário de Acesso
              </label>
              <input
                type="text"
                required
                className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300"
                placeholder="Ex: admin.jose"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
              />
            </div>

            {/* CAMPO SENHA */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">
                Senha de Segurança
              </label>
              <input
                type="password"
                required
                className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300"
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </div>

            {/* BOTÃO ENTRAR */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg 
                ${loading
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 active:scale-[0.98]'
                }`}
            >
              {loading ? 'Validando...' : 'Acessar Sistema'}
            </button>
          </form>

          {/* RODAPÉ ✅ ALTERADO com fonte menor */}
          <div className="mt-10 text-center">
            <p className="text-[9px] font-bold text-slate-400 leading-relaxed">
              Desenvolvido pela Subsecretaria Adjunta de<br />
              Inovação e Tecnologia da SEMED - Queimados/RJ
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;