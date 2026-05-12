import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import confetti from 'canvas-confetti';

export default function App() {
  const [etapa, setEtapa] = useState('identificar'); 
  const [usuario, setUsuario] = useState(null);
  const [form, setForm] = useState({ nome: '', matricula: '' });
  const [lendo, setLendo] = useState(false);
  const scannerRef = useRef(null);

  // 1. Verificar se o dispositivo já é conhecido ao abrir o app
  useEffect(() => {
    const key = localStorage.getItem('device_key');
    if (key) {
      fetch('https://api.paiva.api.br/api/identificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_key: key })
      })
      .then(r => r.json())
      .then(d => {
        if (d.cadastrado) { 
          setUsuario(d.usuario); 
          setEtapa('scanner'); 
        }
      })
      .catch(err => console.error("Erro na identificação:", err));
    }
  }, []);

  // 2. Lógica do Scanner (Inicia apenas na etapa 'scanner')
  useEffect(() => {
    if (etapa === 'scanner' && !scannerRef.current) {
      const html5QrCode = new Html5Qrcode("reader");
      scannerRef.current = html5QrCode;

      const config = { fps: 10, qrbox: { width: 250, height: 250 } };

      html5QrCode.start(
        { facingMode: "environment" }, 
        config,
        (decodedText) => {
          html5QrCode.stop().then(() => {
            scannerRef.current = null;
            onScanSuccess(decodedText);
          });
        }
      ).catch(err => console.error("Erro ao iniciar câmera:", err));

      return () => {
        if (scannerRef.current) {
          scannerRef.current.stop().then(() => { scannerRef.current = null; }).catch(() => {});
        }
      };
    }
  }, [etapa]);

  // 3. Processar a presença
  function onScanSuccess(decodedText) {
    const key = localStorage.getItem('device_key');
    
    fetch('https://api.paiva.api.br/api/registrar-presenca', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        nome: form.nome || (usuario ? usuario.nome_completo : ''), 
        matricula: form.matricula || (usuario ? usuario.matricula : ''), 
        token_evento: decodedText, 
        device_key: key 
      })
    })
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        if (d.device_key) localStorage.setItem('device_key', d.device_key);
        setEtapa('sucesso');
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
      } else { 
        alert("Erro: " + d.error);
        setEtapa('scanner'); // Volta para tentar novamente
      }
    })
    .catch(err => alert("Erro na rede. Verifique sua conexão."));
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-6 font-sans">
      
      {/* HEADER CENTRALIZADO COM LOGO */}
      <header className="mb-8 text-center pt-4">
        <img src="/logap.png" className="h-14 mx-auto mb-3 object-contain" alt="Logo Prefeitura" />
        <h1 className="text-2xl font-black tracking-tighter text-blue-400">FORMAR</h1>
        <div className="h-1 w-12 bg-blue-500 mx-auto rounded-full mt-1"></div>
      </header>

      <main className="w-full flex flex-col items-center justify-center flex-1">
        
        {/* ETAPA 1: CADASTRO INICIAL */}
        {etapa === 'identificar' && (
          <div className="bg-white text-slate-900 p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl animate-fade-in">
            <h2 className="text-2xl font-bold mb-2 text-center text-slate-800">Seja bem-vindo</h2>
            <p className="text-slate-500 text-center mb-8 text-sm font-medium">Cadastre seu aparelho para acessos rápidos.</p>
            
            <div className="space-y-4">
              <input 
                className="w-full bg-slate-100 border-none p-4 rounded-2xl focus:ring-2 ring-blue-500 outline-none transition-all" 
                placeholder="Nome Completo" 
                onChange={e => setForm({...form, nome: e.target.value})} 
              />
              <input 
                className="w-full bg-slate-100 border-none p-4 rounded-2xl focus:ring-2 ring-blue-500 outline-none transition-all" 
                placeholder="Matrícula" 
                onChange={e => setForm({...form, matricula: e.target.value})} 
              />
              <button 
                onClick={() => {
                  if(!form.nome || !form.matricula) return alert("Preencha todos os campos");
                  setEtapa('scanner');
                }} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 transition-all active:scale-95"
              >
                COMEÇAR AGORA
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 2: SCANNER DE QR CODE */}
        {etapa === 'scanner' && (
          <div className="w-full max-w-sm text-center">
            <div className="mb-8">
              <p className="text-lg font-bold">Olá, <span className="text-blue-400">{usuario?.nome_completo || form.nome}</span></p>
              <p className="text-slate-400 text-sm">Aponte a câmera para o QR Code do evento</p>
            </div>
            
            <div className="relative group">
              <div id="reader" className="bg-black rounded-[2rem] overflow-hidden border-4 border-slate-700 shadow-2xl"></div>
              {/* Overlay decorativo do scanner */}
              <div className="absolute inset-0 pointer-events-none border-[20px] border-transparent border-t-blue-500/20 border-b-blue-500/20 rounded-[2rem]"></div>
            </div>
            
            <button 
              onClick={() => { localStorage.clear(); window.location.reload(); }}
              className="mt-8 text-slate-500 text-xs uppercase tracking-widest font-bold hover:text-white transition-colors"
            >
              Trocar de usuário
            </button>
          </div>
        )}

        {/* ETAPA 3: SUCESSO GAMIFICADO */}
        {etapa === 'sucesso' && (
          <div className="text-center p-8 bg-slate-800/50 rounded-[3rem] border border-slate-700 w-full max-w-sm">
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_50px_rgba(34,197,94,0.4)] animate-bounce">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 className="text-3xl font-black mb-2">PRESENÇA OK!</h2>
            <p className="text-slate-400 mb-8 font-medium">Sua frequência foi registrada com sucesso.</p>
            
            <div className="w-full bg-slate-700 h-3 rounded-full overflow-hidden mb-2">
              <div className="bg-blue-500 h-full w-2/3 shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
            </div>
            

            <button 
              onClick={() => setEtapa('scanner')} 
              className="w-full bg-slate-700 hover:bg-slate-600 text-white py-4 rounded-2xl font-bold transition-all"
            >
              NOVA LEITURA
            </button>
          </div>
        )}
      </main>

      <footer className="py-6 text-slate-600 text-[10px] font-bold tracking-widest uppercase">
        © 2026 SEMED QUEIMADOS
      </footer>
    </div>
  );
}