import React, { useState, useEffect } from 'react';

export default function AppProfessor() {
  const [evento, setEvento] = useState(null);
  const [etapa, setEtapa] = useState('carregando'); // carregando, registro, sucesso, nenhum
  const [form, setForm] = useState({ nome: '', matricula: '' });

  useEffect(() => {
    // 1. Busca evento de hoje
    fetch('https://api.paiva.api.br/api/evento-atual')
      .then(r => r.json())
      .then(ev => {
        if (!ev) return setEtapa('nenhum');
        setEvento(ev);
        
        // 2. Tenta registro automático
        const key = localStorage.getItem('device_key');
        if (key) {
          registrar(null, null, key, ev.id);
        } else {
          setEtapa('registro');
        }
      });
  }, []);

  const registrar = (nome, matricula, key, evId) => {
    fetch('https://api.paiva.api.br/api/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, matricula, device_key: key, evento_id: evId })
    }).then(r => r.json()).then(d => {
      if (d.success) {
        localStorage.setItem('device_key', d.device_key);
        setEtapa('sucesso');
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-8 font-sans">
      <img src="/logap.png" className="h-16 mb-6" alt="Logo" />
      
      {evento && (
        <div className="text-center mb-10">
          <h1 className="text-sm font-black text-blue-600 uppercase tracking-widest mb-1">Evento de Hoje</h1>
          <h2 className="text-2xl font-bold text-slate-800">{evento.titulo}</h2>
        </div>
      )}

      <div className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 p-8">
        {etapa === 'registro' && (
          <div className="space-y-4">
            <h3 className="text-center text-slate-500 font-medium mb-6">Primeiro acesso detectado.<br/>Identifique-se abaixo:</h3>
            <input className="w-full p-4 bg-slate-100 rounded-2xl outline-none focus:ring-2 ring-blue-500" placeholder="Nome Completo" onChange={e => setForm({...form, nome: e.target.value})} />
            <input className="w-full p-4 bg-slate-100 rounded-2xl outline-none focus:ring-2 ring-blue-500" placeholder="Matrícula" onChange={e => setForm({...form, matricula: e.target.value})} />
            <button onClick={() => registrar(form.nome, form.matricula, null, evento.id)} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-200">CONFIRMAR PRESENÇA</button>
          </div>
        )}

        {etapa === 'sucesso' && (
          <div className="text-center py-10 animate-bounce">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-black text-slate-800">Presença Registrada!</h2>
            <p className="text-slate-400 mt-2">Bom curso, professor(a).</p>
          </div>
        )}

        {etapa === 'nenhum' && (
          <div className="text-center py-10">
            <div className="text-6xl mb-4">⏳</div>
            <h2 className="text-xl font-bold text-slate-800">Nenhum evento ativo</h2>
            <p className="text-slate-400 mt-2">Não há formações agendadas para hoje.</p>
          </div>
        )}
      </div>
    </div>
  );
}