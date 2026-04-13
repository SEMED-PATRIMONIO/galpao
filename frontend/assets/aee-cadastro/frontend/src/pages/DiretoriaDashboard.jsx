import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const Card = ({ title, value, icon, color, onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white p-6 rounded-3xl border-b-4 ${color} shadow-sm hover:shadow-xl transition-all cursor-pointer group`}
  >
    <div className="flex justify-between items-start">
      <div>
        <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-4xl font-black text-slate-800 tracking-tighter">{value}</h3>
      </div>
      <span className="text-3xl opacity-20 group-hover:opacity-100 transition-opacity">{icon}</span>
    </div>
  </div>
);

const DiretoriaDashboard = () => {
  const [stats, setStats] = useState({});
  const [dates, setDates] = useState({ start: '', end: '' });
  const [modalData, setModalData] = useState(null);

  useEffect(() => { fetchStats(); }, [dates]);

  const fetchStats = async () => {
    const res = await fetch(`http://localhost:3005/api/diretoria/stats?start=${dates.start}&end=${dates.end}`);
    setStats(await res.json());
  };

  const gerarPDF = (titulo, dados) => {
    const doc = new jsPDF();
    const img = new Image();
    img.src = '/assets/braque.png';

    img.onload = () => {
      // Cabeçalho Institucional
      doc.addImage(img, 'PNG', 15, 10, 20, 20);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("PREFEITURA MUNICIPAL DE QUEIMADOS", 38, 18);
      doc.setFont("helvetica", "normal");
      doc.text("SECRETARIA MUNICIPAL DE EDUCAÇÃO", 38, 23);

      // Título do Relatório
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(titulo.toUpperCase(), 105, 45, { align: 'center' });

      // Tabela de Dados
      const headers = Object.keys(dados[0]);
      const rows = dados.map(item => Object.values(item));

      doc.autoTable({
        startY: 55,
        head: [headers.map(h => h.replace('_', ' ').toUpperCase())],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59] }
      });

      doc.save(`Relatorio_${titulo}.pdf`);
    };
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-8">
      {/* Topo com Filtros */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter italic">
            Dashboard <span className="text-blue-600">Diretoria</span>
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            <p className="text-slate-500 text-xs font-bold">
              {stats.pendentes_pai} agendamentos aguardando confirmação dos pais
            </p>
          </div>
        </div>

        <div className="flex bg-white p-2 rounded-2xl shadow-sm border border-slate-100 items-center gap-4">
          <input 
            type="date" 
            className="p-2 text-xs font-bold text-slate-600 outline-none" 
            onChange={e => setDates({...dates, start: e.target.value})}
          />
          <span className="text-slate-300">➜</span>
          <input 
            type="date" 
            className="p-2 text-xs font-bold text-slate-600 outline-none"
            onChange={e => setDates({...dates, end: e.target.value})}
          />
        </div>
      </header>

      {/* Grid de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card title="Total de Alunos" value={stats.alunos} icon="🎓" color="border-blue-500" onClick={() => {/* fetch detalhe */}} />
        <Card title="Profissionais" value={stats.profissionais} icon="🩺" color="border-emerald-500" />
        <Card title="Especialidades" value={stats.especialidades} icon="🧬" color="border-indigo-500" />
        <Card title="Agendamentos" value={stats.agendamentos} icon="📅" color="border-purple-500" />
        <Card title="Atendimentos Realizados" value={stats.atendimentos} icon="✅" color="border-sky-500" />
        <Card title="Faltas / Ausências" value={stats.faltas} icon="❌" color="border-red-500" />
      </div>

      {/* Exemplo de botão para gerar PDF rápido do resumo atual */}
      <button 
        onClick={() => gerarPDF("Resumo Geral da Diretoria", [stats])}
        className="fixed bottom-8 right-8 bg-slate-900 text-white p-4 rounded-full shadow-2xl hover:bg-blue-600 transition-all flex items-center gap-2"
      >
        <span>🖨️</span> <span className="text-xs font-black uppercase tracking-widest pr-2">Imprimir Geral</span>
      </button>
    </div>
  );
};

export default DiretoriaDashboard;