import React, { useState, useEffect } from 'react';

export default function App() {
  const [evento, setEvento] = useState(null);
  const [nome, setNome] = useState('');
  const [matricula, setMatricula] = useState('');
  const [status, setStatus] = useState('carregando'); // carregando, pronto, sucesso, erro

  const API = "https://api.paiva.api.br/api";

  useEffect(() => {
    // Busca o evento que está acontecendo hoje
    fetch(`${API}/evento-atual`)
      .then(r => r.json())
      .then(data => {
        if (data) {
          setEvento(data);
          setStatus('pronto');
        } else {
          setStatus('nenhum-evento');
        }
      })
      .catch(() => setStatus('erro'));
  }, []);

  const registrarPresenca = (e) => {
    e.preventDefault();
    setStatus('processando');

    // Pegamos a localização para garantir que o professor está no local
    navigator.geolocation.getCurrentPosition((pos) => {
      const dados = {
        nome,
        matricula,
        evento_id: evento.id,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };

      fetch(`${API}/registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      })
      .then(r => r.json())
      .then(() => setStatus('sucesso'))
      .catch(() => setStatus('erro'));
    }, () => {
      alert("Por favor, ative a localização para confirmar sua presença.");
      setStatus('pronto');
    });
  };

  if (status === 'carregando') return <div className="flex h-screen items-center justify-center font-bold">Iniciando sistema...</div>;
  
  if (status === 'nenhum-evento') return (
    <div className="flex h-screen flex-col items-center justify-center p-6 text-center">
      <div className="text-6xl mb-4">🗓️</div>
      <h1 className="text-xl font-bold text-slate-400">Não há nenhum evento agendado para hoje.</h1>
    </div>
  );

  if (status === 'sucesso') return (
    <div className="flex h-screen flex-col items-center justify-center p-6 text-center bg-green-50">
      <div className="text-6xl mb-4 text-green-500">✅</div>
      <h1 className="text-2xl font-black text-green-700">PRESENÇA REGISTRADA!</h1>
      <p className="text-green-600 mt-2">Bom treinamento, professor(a) {nome.split(' ')[0]}!</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-indigo-600 p-8 text-white text-center">
          <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-1">Check-in Digital</p>
          <h1 className="text-xl font-black leading-tight">{evento.titulo}</h1>
          <div className="mt-4 inline-block bg-indigo-500 px-4 py-1 rounded-full text-sm font-bold">
            {evento.carga_horaria} HORAS
          </div>
        </div>

        <form onSubmit={registrarPresenca} className="p-8 space-y-6">
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase mb-2">Nome Completo</label>
            <input 
              required 
              className="w-full border-b-2 border-slate-100 focus:border-indigo-500 outline-none py-3 text-lg font-medium"
              placeholder="Digite seu nome..."
              value={nome}
              onChange={e => setNome(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-400 uppercase mb-2">Matrícula</label>
            <input 
              required 
              className="w-full border-b-2 border-slate-100 focus:border-indigo-500 outline-none py-3 text-lg font-medium"
              placeholder="Sua matrícula..."
              value={matricula}
              onChange={e => setMatricula(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            disabled={status === 'processando'}
            className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
          >
            {status === 'processando' ? 'REGISTRANDO...' : 'CONFIRMAR MINHA PRESENÇA'}
          </button>
          
          <p className="text-[10px] text-center text-slate-400">
            Ao confirmar, sua localização GPS será enviada para validação do MEC.
          </p>
        </form>
      </div>
    </div>
  );
}