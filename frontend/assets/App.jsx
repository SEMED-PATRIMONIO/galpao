import React, { useState, useEffect } from 'react';

// Função simples para gerar um ID de dispositivo persistente caso não exista
const obterOuCriarDeviceKey = () => {
  let key = localStorage.getItem('formar_device_key');
  if (!key) {
    key = 'dev_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    localStorage.setItem('formar_device_key', key);
  }
  return key;
};

export default function App() {
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState('Obtendo sua localização GPS...');
  const [passo, setPasso] = useState('inicial'); // inicial | pedir_matricula | sucesso_entrada | avaliacao | fim
  
  const [matriculaInput, setMatriculaInput] = useState('');
  const [gps, setGps] = useState({ lat: null, lng: null });
  const [dadosPresenca, setDadosPresenca] = useState({ frequencia_id: null, professor: '', evento: '' });
  const [notaAvaliacao, setNotaAvaliacao] = useState('');

  const API = "https://api.paiva.api.br/api";
  const deviceKey = obterOuCriarDeviceKey();

  useEffect(() => {
    // Captura a localização exata do celular assim que abre o link
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coordenadas = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGps(coordenadas);
        // Dispara a checagem automática com o aparelho
        verificarPresencaNoServidor(coordenadas, '');
      },
      (err) => {
        setCarregando(false);
        setMensagem('Por favor, ative a localização/GPS do seu celular para registrar a presença.');
      },
      { enableHighAccuracy: true }
    );
  }, []);

  const verificarPresencaNoServidor = (coordenadas, matriculaForcada) => {
    setCarregando(true);
    fetch(`${API}/verificar-localizacao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_key: deviceKey,
        matricula: matriculaForcada,
        lat: coordenadas.lat,
        lng: coordenadas.lng
      })
    })
    .then(r => r.json())
    .then(res => {
      setCarregando(false);
      if (res.requere_matricula) {
        setPasso('pedir_matricula');
      } else if (res.success === false) {
        setMensagem(res.message);
        setPasso('inicial');
      } else if (res.status === 'entrada_gravada') {
        setDadosPresenca({ professor: res.professor, evento: res.evento });
        setPasso('sucesso_entrada');
      } else if (res.status === 'requer_avaliacao') {
        setDadosPresenca({ frequencia_id: res.frequencia_id, professor: res.professor, evento: res.evento });
        setPasso('avaliacao');
      }
    })
    .catch(() => {
      setCarregando(false);
      setMensagem('Erro de comunicação com o servidor de validação.');
    });
  };

  const enviarMatriculaPrimeiroAcesso = (e) => {
    e.preventDefault();
    if (!matriculaInput) return alert('Insira sua matrícula.');
    verificarPresencaNoServidor(gps, matriculaInput);
  };

  const enviarFeedbackESaida = () => {
    if (!notaAvaliacao) return alert('Por favor, selecione uma opção de avaliação.');
    setCarregando(true);

    fetch(`${API}/finalizar-saida`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frequencia_id: dadosPresenca.frequencia_id,
        avaliacao: notaAvaliacao,
        lat: gps.lat,
        lng: gps.lng
      })
    })
    .then(r => r.json())
    .then(res => {
      setCarregando(false);
      if (res.success) setPasso('fim');
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-slate-800 p-8 rounded-3xl shadow-xl text-center border border-slate-700">
        <img src="/logap.png" className="w-32 mx-auto mb-6" alt="Logo Formar" />

        {carregando && (
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-sm text-slate-300">Processando criptografia de presença...</p>
          </div>
        )}

        {!carregando && (
          <>
            {/* PASSO INICIAL: EXIBIÇÃO DE ERROS DE LOCALIZAÇÃO */}
            {passo === 'inicial' && (
              <div className="space-y-4">
                <div className="text-4xl">📍</div>
                <p className="text-red-400 font-bold">{mensagem}</p>
                <button onClick={() => window.location.reload()} className="bg-slate-700 text-white text-xs px-4 py-2 rounded-xl font-bold">Tentar Novamente</button>
              </div>
            )}

            {/* PASSO: PRIMEIRO ACESSO DO APARELHO (PEDE MATRÍCULA) */}
            {passo === 'pedir_matricula' && (
              <form onSubmit={enviarMatriculaPrimeiroAcesso} className="space-y-4 text-left">
                <h3 className="text-xl font-black text-center">Vincular Dispositivo</h3>
                <p className="text-xs text-slate-400 text-center mb-4">Seu aparelho será associado com segurança para validações automáticas futuras.</p>
                <div>
                  <label className="text-xs font-bold text-slate-400">Digite sua Matrícula Oficial</label>
                  <input type="text" className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700 mt-1 outline-none font-bold tracking-widest text-center" value={matriculaInput} onChange={e => setMatriculaInput(e.target.value)} placeholder="Ex: 12345" required />
                </div>
                <button className="w-full bg-blue-600 text-white p-3 rounded-xl font-black tracking-wide mt-2">CONFIRMAR REGISTRO</button>
              </form>
            )}

            {/* PASSO: SINAL VERDE DE ENTRADA */}
            {passo === 'sucesso_entrada' && (
              <div className="space-y-4">
                <div className="text-5xl text-emerald-500 animate-bounce">✓</div>
                <h3 className="text-xl font-black text-emerald-400">Entrada Registrada!</h3>
                <p className="text-sm text-slate-300">Olá, <strong className="text-white">{dadosPresenca.professor}</strong>. Sua entrada no circuito foi computada com sucesso.</p>
                <div className="bg-slate-900 p-4 rounded-xl text-xs font-mono text-slate-400 text-left border border-slate-700/50">
                  <strong>Formação:</strong> {dadosPresenca.evento}
                </div>
                <p className="text-[10px] text-slate-500">Lembre-se de ler o QR Code novamente ao término do evento para registrar a saída e validar suas horas.</p>
              </div>
            )}

            {/* PASSO: TELA DE AVALIAÇÃO OBRIGATÓRIA NA SAÍDA */}
            {passo === 'avaliacao' && (
              <div className="space-y-4 text-left">
                <h3 className="text-xl font-black text-center text-amber-400">Ficha de Saída</h3>
                <p className="text-xs text-slate-300 text-center">Identificamos sua entrada aberta para: <br/><strong className="text-white">{dadosPresenca.evento}</strong></p>
                
                <div className="pt-4 space-y-2">
                  <label className="text-xs font-bold text-slate-400">O que você achou dessa Formação?</label>
                  <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                    {['Excelente', 'Muito Boa', 'Regular', 'Ruim / Insatisfatória'].map((opc) => (
                      <button key={opc} type="button" onClick={() => setNotaAvaliacao(opc)} className={`p-3 rounded-xl border text-center transition ${notaAvaliacao === opc ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}`}>
                        {opc}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={enviarFeedbackESaida} className="w-full bg-amber-500 text-slate-950 p-4 rounded-xl font-black tracking-wide mt-6 shadow-lg shadow-amber-500/10">CONCLUIR E LIBERAR HORAS</button>
              </div>
            )}

            {/* PASSO FINAL: SINAL VERDE DE CONCLUSÃO */}
            {passo === 'fim' && (
              <div className="space-y-4">
                <div className="text-5xl">🎉</div>
                <h3 className="text-xl font-black text-blue-400">Obrigado pelo Feedback!</h3>
                <p className="text-sm text-slate-300">Sua jornada de formação de hoje foi concluída e fechada com sucesso no sistema.</p>
                <p className="text-xs text-slate-400">Obrigado por ajudar a aprimorar o nosso ecossistema educacional!</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}