import React, { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function App() {
  const [matricula, setMatricula] = useState('');
  const [status, setStatus] = useState('login'); // login, scanner, sucesso
  const API = "https://api.paiva.api.br/api";

  const iniciarLeitura = () => {
    if (!matricula) return alert("Insira sua matrícula");
    
    // Trava de Localização
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus('scanner');
        setTimeout(() => {
          const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
          scanner.render((text) => {
            scanner.clear();
            registrar(text, pos.coords.latitude, pos.coords.longitude);
          });
        }, 100);
      },
      () => alert("ACESSO NEGADO: Você deve permitir a localização para ganhar suas horas.")
    );
  };

  const device_key = localStorage.getItem('formar_device_id') || uuidv4();
  localStorage.setItem('formar_device_id', device_key);

  const registrar = (token, lat, lng) => {
    fetch(`${API}/registrar-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matricula,
        token_qr: qrcode_lido,
        lat: latitude_gps,
        lng: longitude_gps,
        device_key: device_key
      })
    })
    .then(r => r.json())
    .then(data => {
      if(data.error) alert(data.error);
      else setStatus('sucesso');
    });
  };

  if (status === 'sucesso') return (
    <div className="h-screen flex flex-col items-center justify-center p-10 text-center bg-blue-600 text-white">
      <div className="text-8xl mb-6">🎉</div>
      <h1 className="text-3xl font-black">CHECK-IN REALIZADO!</h1>
      <p className="mt-4">O sistema registrou seu horário e localização com sucesso.</p>
      <button onClick={() => setStatus('login')} className="mt-10 bg-white text-blue-600 px-8 py-4 rounded-2xl font-bold">NOVA LEITURA</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white font-sans">
      <img src="/logap.png" className="w-24 mb-10" />
      
      {status === 'login' ? (
        <div className="w-full max-w-sm bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700">
          <h2 className="text-xl font-bold mb-6">Identificação</h2>
          <input 
            className="w-full bg-slate-900 border-none rounded-xl p-4 mb-4 outline-none focus:ring-2 ring-blue-500" 
            placeholder="Sua Matrícula" 
            value={matricula}
            onChange={e => setMatricula(e.target.value)}
          />
          <button onClick={iniciarLeitura} className="w-full bg-blue-600 p-4 rounded-xl font-black shadow-lg shadow-blue-900/50">ABRIR LEITOR QR</button>
        </div>
      ) : (
        <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden p-4">
          <div id="reader"></div>
          <p className="text-slate-400 text-center text-xs mt-4">Aponte para o QR Code do Evento</p>
        </div>
      )}
    </div>
  );
}
