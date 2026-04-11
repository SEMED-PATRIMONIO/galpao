// /var/www/aee-cadastro/frontend/src/components/ChangePasswordModal.jsx
import React, { useState } from 'react';

// Interface de Alteração de Senha (Modal de Perfil)
const ChangePasswordModal = ({ isOpen, onClose, userId }) => {
  // Estado local para armazenar os inputs de senha
  const [passwords, setPasswords] = useState({ nova: '', confirma: '' });

  // Função para processar a atualização da senha
  const handleUpdate = async () => {
    // 1. Validação simples: as senhas devem coincidir
    if (passwords.nova !== passwords.confirma) {
      alert("As senhas não coincidem!");
      return;
    }
    
    // 2. Chamada à API para atualizar o campo senha_hash no backend
    // A rota deve ser genérica ou específica de usuário logado
    // Ex: /api/usuarios/update-password/${userId} ou /api/perfil/senha
    try {
      const response = await fetch(`/api/usuarios/update-password/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          // Incluir token JWT se necessário (ex: Auth Bearer token)
        },
        body: JSON.stringify({ senha: passwords.nova })
      });

      if (!response.ok) {
        throw new Error('Falha ao atualizar a senha');
      }

      alert("Senha atualizada com sucesso!");
      
      // Reseta os campos e fecha o modal
      setPasswords({ nova: '', confirma: '' });
      onClose();

    } catch (error) {
      console.error('Erro na atualização:', error);
      alert('Ocorreu um erro ao atualizar sua senha. Tente novamente.');
    }
  };

  // Se o modal não estiver aberto (isOpen === false), não renderiza nada
  if (!isOpen) return null;

  return (
    // Fundo escurecido e efeito de blur (Tailwind)
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] transition-opacity duration-300">
      
      {/* Container do Modal com sombra pesada (shadow-2xl) e tons de azul */}
      <div className="bg-white rounded-2xl p-8 w-96 shadow-2xl border border-blue-100 transform scale-100 transition-transform duration-300">
        
        {/* Título com ícone */}
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
          <span className="mr-2">🔐</span> Alterar Minha Senha
        </h2>
        
        <p className="text-sm text-slate-500 mb-6">Digite sua nova senha abaixo.</p>
        
        {/* Campo Nova Senha */}
        <input 
          type="password" 
          placeholder="Nova Senha" 
          className="w-full p-3 mb-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
          onChange={e => setPasswords({...passwords, nova: e.target.value})}
          value={passwords.nova}
        />
        
        {/* Campo Confirmar Nova Senha */}
        <input 
          type="password" 
          placeholder="Confirmar Nova Senha" 
          className="w-full p-3 mb-6 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
          onChange={e => setPasswords({...passwords, confirma: e.target.value})}
          value={passwords.confirma}
        />
        
        {/* Área de Botões */}
        <div className="flex space-x-3">
          {/* Botão Cancelar: sem fundo, apenas texto */}
          <button 
            onClick={onClose} 
            className="flex-1 py-2 text-slate-500 font-medium hover:text-slate-700 transition-colors"
          >
            Cancelar
          </button>
          
          {/* Botão Salvar: Azul corporativo (#2563eb do Tailwind) */}
          <button 
            onClick={handleUpdate} 
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md transition-all duration-150 active:scale-95"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordModal;