import React, { useState, useEffect } from 'react';

const AgendamentoFormModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  agendamentoInicial, 
  listaAlunos = [], 
  listaProfissionais = [] 
}) => {
  // Estado inicial baseado na tabela aee_agendamentos
  const [formData, setFormData] = useState({
    aluno_id: '',
    profissional_id: '',
    data_hora: '',
    status: 'Agendado',
    observacoes: ''
  });

  // Sincronização de dados para inclusão ou edição
  useEffect(() => {
    if (agendamentoInicial) {
      // Ajuste para o input datetime-local (formato YYYY-MM-DDTHH:mm)
      let dataFormatada = '';
      if (agendamentoInicial.data_hora) {
        // Remove os segundos e o fuso (Z) se existirem para encaixar no input HTML
        dataFormatada = new Date(agendamentoInicial.data_hora).toISOString().slice(0, 16);
      }

      setFormData({
        aluno_id: agendamentoInicial.aluno_id || '',
        profissional_id: agendamentoInicial.profissional_id || '',
        data_hora: dataFormatada,
        status: agendamentoInicial.status || 'Agendado',
        observacoes: agendamentoInicial.observacoes || ''
      });
    } else {
      setFormData({
        aluno_id: '',
        profissional_id: '',
        data_hora: '',
        status: 'Agendado',
        observacoes: ''
      });
    }
  }, [agendamentoInicial, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* CABEÇALHO - Tema Roxo para Agendamentos */}
        <div className="bg-purple-600 px-10 py-8 text-white relative">
          <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
            <span className="text-3xl">📅</span> 
            {agendamentoInicial ? 'Editar Agendamento' : 'Novo Agendamento'}
          </h2>
          <p className="text-purple-100 text-[10px] font-bold uppercase tracking-widest mt-1">
            Marcação de Consultas e Atendimentos AEE
          </p>
          <button 
            onClick={onClose}
            className="absolute top-8 right-8 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            ✕
          </button>
        </div>

        {/* FORMULÁRIO */}
        <form onSubmit={handleSubmit} className="p-10 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            
            {/* SELEÇÃO DO ALUNO */}
            <div className="col-span-2 md:col-span-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Aluno Paciente
              </label>
              <select
                required
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-purple-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 appearance-none"
                value={formData.aluno_id}
                onChange={(e) => setFormData({ ...formData, aluno_id: e.target.value })}
              >
                <option value="">Selecione o Aluno...</option>
                {listaAlunos.map((aluno) => (
                  <option key={aluno.id} value={aluno.id}>
                    {aluno.nome_completo} (RA: {aluno.ra})
                  </option>
                ))}
              </select>
            </div>

            {/* SELEÇÃO DO PROFISSIONAL */}
            <div className="col-span-2 md:col-span-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Profissional / Especialista
              </label>
              <select
                required
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-purple-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 appearance-none"
                value={formData.profissional_id}
                onChange={(e) => setFormData({ ...formData, profissional_id: e.target.value })}
              >
                <option value="">Selecione o Profissional...</option>
                {listaProfissionais.map((prof) => (
                  <option key={prof.id} value={prof.id}>
                    {prof.nome_completo} - {prof.especialidade}
                  </option>
                ))}
              </select>
            </div>

            {/* DATA E HORA */}
            <div className="col-span-2 md:col-span-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Data e Hora do Atendimento
              </label>
              <input
                type="datetime-local"
                required
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-purple-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700"
                value={formData.data_hora}
                onChange={(e) => setFormData({ ...formData, data_hora: e.target.value })}
              />
            </div>

            {/* STATUS */}
            <div className="col-span-2 md:col-span-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Status Atual
              </label>
              <select
                required
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-purple-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 appearance-none"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="Agendado">Agendado</option>
                <option value="Concluído">Concluído</option>
                <option value="Faltou">Faltou</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </div>

            {/* OBSERVAÇÕES */}
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Observações Preliminares (Opcional)
              </label>
              <textarea
                rows="3"
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-purple-500 focus:bg-white rounded-2xl outline-none transition-all font-medium text-slate-700 resize-none"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Ex: Aluno precisa de material adaptado. Os pais foram notificados."
              ></textarea>
            </div>

          </div>

          {/* BOTÕES */}
          <div className="pt-6 flex gap-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 bg-slate-100 hover:bg-slate-200 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-[2] py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-200 transition-all active:scale-95"
            >
              {agendamentoInicial ? 'Atualizar Agendamento' : 'Confirmar Marcação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgendamentoFormModal;