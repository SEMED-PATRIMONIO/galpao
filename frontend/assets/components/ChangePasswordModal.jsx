import React, { useState, useEffect } from 'react';

// Interface de Alteração de Senha (Modal de Perfil)
const ChangePasswordModal = ({ isOpen, onClose, userId }) => {
  // Estado local para armazenar os inputs de senha
  const [passwords, setPasswords] = useState({ nova: '', confirma: '' });
  const [loading, setLoading] = useState(false);

  // Limpa os campos sempre que o modal for fechado ou aberto
  useEffect(() => {
    if (!isOpen) {
      setPasswords({ nova: '', confirma: '' });
    }
  }, [isOpen]);

  // Função para processar a atualização da senha
  const handleUpdate = async () => {
    // 1. Validações básicas
    if (!passwords.nova || !passwords.confirma) {
      alert("Por favor, preencha todos os campos.");
      return;
    }

    if (passwords.nova.length < 6) {
      alert("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (passwords.nova !== passwords.confirma) {
      alert("As senhas não coincidem!");
      return;
    }
    
    setLoading(true);

    try {
      const response = await fetch(`/api/usuarios/update-password/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ senha: passwords.nova })
      });

      if (!response.ok) {
        throw new Error('Falha ao atualizar a senha');
      }

      alert("✅ Senha atualizada com sucesso!");
      onClose();

    } catch (error) {
      console.error('Erro na atualização:', error);
      alert('Ocorreu um erro ao atualizar sua senha. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  // Se o modal não estiver aberto, não renderiza nada
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[150] transition-all">
      
      {/* Container do Modal */}
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl border border-blue-50 animate-in fade-in zoom-in duration-200">
        
        {/* Título com ícone */}
        <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center">
          <span className="mr-2">🔐</span> Alterar Minha Senha
        </h2>
        
        <p className="text-sm text-slate-500 mb-6">Crie uma nova senha de acesso segura.</p>
        
        <div className="space-y-4">
          {/* Campo Nova Senha */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Nova Senha</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              onChange={e => setPasswords({...passwords, nova: e.target.value})}
              value={passwords.nova}
            />
          </div>
          
          {/* Campo Confirmar Nova Senha */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Confirmar Senha</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              onChange={e => setPasswords({...passwords, confirma: e.target.value})}
              value={passwords.confirma}
            />
          </div>
        </div>
        
        {/* Área de Botões */}
        <div className="flex space-x-3 mt-8">
          <button 
            onClick={onClose} 
            disabled={loading}
            className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          
          <button 
            onClick={handleUpdate} 
            disabled={loading}
            className={`flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all active:scale-95 ${
              loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'
            }`}
          >
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordModal;