import React, { useState } from 'react';

export default function App() {
  const [matricula, setMatricula] = useState('');
  const [status, setStatus] = useState('login'); // 'login' | 'processando' | 'multiplos' | 'feedback'
  const [mensagemFeedback, setMensagemFeedback] = useState('');
  const [listaEventos, setListaEventos] = useState([]);
  
  const API = "https://api.paiva.api.br/api";

  // Identificador exclusivo estável do aparelho (Trava Antifraude)
  const obterChaveAparelho = () => {
    let key = localStorage.getItem('formar_device_token');
    if (!key) {
      // Gera token seguro usando API nativa do navegador sem precisar instalar pacotes extras
      if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
        key = window.crypto.randomUUID();
      } else {
        key = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      }
      localStorage.setItem('formar_device_token', key);
    }
    return key;
  };

  const processarPontoAutomatico = (eventoId = null) => {
    if (!matricula.trim()) {
      alert("Por favor, informe seu número de matrícula.");
      return;
    }
    setStatus('processando');

    if (!navigator.geolocation) {
      alert("Este dispositivo ou navegador não suporta captura de Geolocalização.");
      setStatus('login');
      return;
    }

    // Força alta precisão do GPS (crucial para o raio de 60 metros)
    const opcoesGps = { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetch(`${API}/verificar-localizacao`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matricula: matricula.trim(),
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            device_key: obterChaveAparelho(),
            evento_selecionado_id: eventoId
          })
        })
        .then(r => {
          if (!r.ok) {
            return r.json().then(err => { throw new Error(err.error || "Erro interno na validação do servidor."); });
          }
          return r.json();
        })
        .then(res => {
          if (res.status === 'NENHUM_EVENTO') {
            setMensagemFeedback(res.message);
            setStatus('feedback');
          } else if (res.status === 'MULTIPLOS_EVENTOS') {
            setListaEventos(res.lista);
            setStatus('multiplos');
          } else if (res.status === 'ENTRADA') {
            setMensagemFeedback(`Check-in Efetuado! Você entrou na formação: "${res.titulo}". Lembre-se que é obrigatório registrar sua saída (mínimo de 1 hora após a chegada) neste mesmo portal para que suas horas sejam computadas e liberadas para o Certificado.`);
            setStatus('feedback');
          } else if (res.status === 'SAIDA') {
            setMensagemFeedback(`Check-out Efetuado! Sua saída da formação: "${res.titulo}" foi registrada. Suas horas foram computadas com sucesso.`);
            setStatus('feedback');
          }
        })
        .catch(err => {
          alert(err.message);
          setStatus('login');
        });
      },
      (error) => {
        let msgErro = "Não foi possível obter sua localização geográfica.";
        if (error.code === error.PERMISSION_DENIED) {
          msgErro = "Acesso ao GPS negado. Você precisa autorizar o uso da geolocalização no navegador para registrar sua presença.";
        }
        alert(msgErro);
        setStatus('login');
      },
      opcoesGps
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 font-sans">
      {/* Logotipo Central */}
      <img src="/logap.png" className="w-32 mb-12 select-none" alt="Logo" />

      {/* ESTADO 1: ENTRADA DE MATRÍCULA */}
      {status === 'login' && (
        <div className="w-full max-w-sm bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700 transition-all duration-300">
          <h2 className="text-sm font-black mb-1 tracking-wide uppercase text-slate-400 text-center">Formar • Portal do Docente</h2>
          <p className="text-[11px] text-slate-500 text-center mb-6">Validação automática via Geofencing (Tolerância: 60m)</p>
          
          <div className="mb-6">
            <label className="text-[10px] font-bold text-slate-400 block mb-2 uppercase tracking-wider">Sua Matrícula</label>
            <input 
              type="text"
              className="w-full bg-slate-900 text-white border-none rounded-xl p-4 outline-none focus:ring-2 ring-blue-500 font-mono font-bold text-center text-xl tracking-widest transition" 
              placeholder="Digite aqui..." 
              value={matricula}
              onChange={e => setMatricula(e.target.value)}
            />
          </div>
          
          <button 
            onClick={() => processarPontoAutomatico(null)} 
            className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white p-4 rounded-xl font-black shadow-lg shadow-blue-900/40 transition-all uppercase text-sm tracking-wider"
          >
            Acessar Perímetro
          </button>
        </div>
      )}

      {/* ESTADO 2: PROCESSANDO LOCALIZAÇÃO */}
      {status === 'processando' && (
        <div className="text-center p-8 bg-slate-800 rounded-3xl border border-slate-700 w-full max-w-sm shadow-2xl animate-pulse">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <h3 className="font-bold text-base mb-1">Avaliando Coordenadas...</h3>
          <p className="text-xs font-mono text-slate-400">Sincronizando com satélites e escaneando o complexo em busca de eventos ativos.</p>
        </div>
      )}

      {/* ESTADO 3: SELEÇÃO DE MÚLTIPLOS EVENTOS NO MESMO LOCAL */}
      {status === 'multiplos' && (
        <div className="w-full max-w-sm bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-2xl">
          <div className="text-center mb-5">
            <span className="text-3xl">🏢</span>
            <h3 className="font-black text-amber-400 text-lg mt-2">Múltiplas Formações Coincidentes</h3>
            <p className="text-xs text-slate-400 mt-1">Identificamos mais de uma atividade ocorrendo simultaneamente no seu raio de 60m. Confirme a sua:</p>
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {listaEventos.map(ev => (
              <button 
                key={ev.id} 
                onClick={() => processarPontoAutomatico(ev.id)} 
                className="w-full bg-slate-900 border border-slate-700 hover:border-blue-500 p-4 rounded-xl font-bold text-sm text-left hover:bg-slate-700 transition active:scale-95"
              >
                <div className="text-blue-400 text-[10px] font-mono mb-1">📍 Prédio: {ev.local_nome}</div>
                <div className="text-white text-sm line-clamp-2">{ev.titulo}</div>
              </button>
            ))}
          </div>
          
          <button 
            onClick={() => { setStatus('login'); setListaEventos([]); }} 
            className="w-full mt-4 bg-slate-700 text-xs font-bold py-2 rounded-lg text-slate-300 hover:bg-slate-600 transition"
          >
            Voltar ao Início
          </button>
        </div>
      )}

      {/* ESTADO 4: PAINEL DE RETORNO / FEEDBACK */}
      {status === 'feedback' && (
        <div className="w-full max-w-md bg-slate-800 p-8 rounded-3xl text-center shadow-2xl border border-slate-700 transition-all">
          <div className="text-5xl mb-4">📢</div>
          <h3 className="text-lg font-black mb-2 text-white">Mensagem do Sistema</h3>
          <p className="text-sm font-medium leading-relaxed mb-6 text-slate-300 bg-slate-900/60 p-5 rounded-2xl border border-slate-700/50 text-left font-sans">
            {mensagemFeedback}
          </p>
          <button 
            onClick={() => { setMatricula(''); setStatus('login'); setMensagemFeedback(''); }} 
            className="bg-white hover:bg-slate-100 active:scale-95 text-slate-900 px-12 py-3 rounded-xl font-black text-sm tracking-wide transition shadow-lg w-full sm:w-auto"
          >
            Ok, Entendido
          </button>
        </div>
      )}
    </div>
  );
}