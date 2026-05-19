// ============================================================================
// ARQUIVO: app-professor/src/App.jsx — PARTE 1 DE 2 (LÓGICA E AUTO-CADASTRO)
// ============================================================================

import React, { useState, useEffect } from 'react';

const API_URL = 'https://qrcode.paiva.api.br/api';

export default function App() {
  // Controle de Sessão e Modos de Login
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [listaProfessores, setListaProfessores] = useState([]);
  const [publicosAlvo, setPublicosAlvo] = useState([]);
  const [eventosDisponiveis, setEventosDisponiveis] = useState([]);
  const [carregando, setCarregando] = useState(false);
  
  // Modo de Auto-Identificação (Não estou na lista)
  const [naoEstouNaLista, setNaoEstouNaLista] = useState(false);
  const [formAutoIdentificacao, setFormAutoIdentificacao] = useState({ matricula: '', nome: '', publico_alvo_id: '' });

  // Controle de Fluxo do Check-out e Janela de Pesquisa de Satisfação
  const [exibirPainelPesquisa, setExibirPainelPesquisa] = useState(null); // Armazena o ID do evento em check-out
  const [pesquisaSatisfacao, setPesquisaSatisfacao] = useState({ nota: '5', comentario: '' });
  const [statusFeed, setStatusFeed] = useState({ id: null, tipo: '', mensagem: '' });

  // Carrega dados estruturais do PostgreSQL para alimentar os formulários
  const inicializarDadosBase = async () => {
    try {
      const [resUsers, resPublicos] = await Promise.all([
        fetch(`${API_URL}/usuarios`),
        fetch(`${API_URL}/publicos`)
      ]);
      if (resUsers.ok) {
        const users = await resUsers.json();
        setListaProfessores(users.filter(u => u.perfil === 'professor' && u.ativo));
      }
      if (resPublicos.ok) {
        const dataPub = await resPublicos.json();
        setPublicosAlvo(dataPub.filter(p => p.ativo));
      }
    } catch (err) {
      console.error('Erro de sincronização inicial:', err);
    }
  };

  useEffect(() => {
    inicializarDadosBase();
  }, []);

  const buscarEventosVigentes = async () => {
    setCarregando(true);
    try {
      const res = await fetch(`${API_URL}/eventos`);
      if (!res.ok) throw new Error();
      const dados = await res.json();
      setEventosDisponiveis(dados.filter(ev => ev.ativo));
    } catch (err) {
      alert('Erro ao carregar a grade de eventos ativos.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (usuarioLogado) buscarEventosVigentes();
  }, [usuarioLogado]);

  // Captura do GPS Nativo do Smartphone
  const obterGpsAparelho = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject('Aparelho sem suporte a GPS.');
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => reject('Acesso ao GPS negado ou indisponível. Ative a localização.'),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  // Trata o Login por Auto-Identificação sem bloquear o fluxo
  const handleEntrarPorIdentificacao = (e) => {
    e.preventDefault();
    const { matricula, nome, publico_alvo_id } = formAutoIdentificacao;
    if (!matricula || !nome || !publico_alvo_id) {
      alert('Preencha todos os dados para se identificar.');
      return;
    }
    // Cria uma sessão temporária que o backend vai processar e salvar no banco no primeiro check-in
    setUsuarioLogado({
      id: null,
      nome: nome.trim(),
      nao_cadastrado: true,
      matricula: matricula.trim(),
      publico_alvo_id: publico_alvo_id
    });
  };

  // Acionador Mestre de Presença (Entrada e Saída)
  const processarFrequenciaComGps = async (eventoId, dadosPesquisa = null) => {
    setStatusFeed({ id: eventoId, tipo: 'processando', mensagem: 'Validando coordenadas geográficas...' });
    try {
      const gps = await obterGpsAparelho();
      
      const payload = {
        evento_id: eventoId,
        latitude: gps.latitude,
        longitude: gps.longitude,
        ...(usuarioLogado.nao_cadastrado 
          ? { nao_cadastrado: true, matricula: usuarioLogado.matricula, nome: usuarioLogado.nome, publico_alvo_id: usuarioLogado.publico_alvo_id }
          : { usuario_id: usuarioLogado.id }
        ),
        ...(dadosPesquisa && { nota_satisfacao: dadosPesquisa.nota, comentario: dadosPesquisa.comentario })
      };

      const res = await fetch(`${API_URL}/frequencias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const dados = await res.json();

      if (!res.ok) {
        setStatusFeed({ id: eventoId, tipo: 'erro', mensagem: dados.mensagem });
        return;
      }

      // Desvia o fluxo caso a API informe que a janela de tempo passou e pede a avaliação
      if (dados.status === 'liberado_para_checkout') {
        setExibirPainelPesquisa(eventoId);
        setStatusFeed({ id: eventoId, tipo: 'alerta', mensagem: dados.mensagem });
        return;
      }

      if (dados.status === 'check-out_concluido') {
        setExibirPainelPesquisa(null);
        setPesquisaSatisfacao({ nota: '5', comentario: '' });
      }

      setStatusFeed({ id: eventoId, tipo: 'sucesso', mensagem: dados.mensagem });
    } catch (err) {
      setStatusFeed({ id: eventoId, tipo: 'erro', mensagem: err.toString() });
    }
  };

  const executarLogout = () => {
    setUsuarioLogado(null);
    setNaoEstouNaLista(false);
    setFormAutoIdentificacao({ matricula: '', nome: '', publico_alvo_id: '' });
    setExibirPainelPesquisa(null);
    setStatusFeed({ id: null, tipo: '', message: '' });
  };
  // ============================================================================
// ARQUIVO: app-professor/src/App.jsx — PARTE 2 DE 2 (RENDERIZAÇÃO MOBILE-FIRST)
// ============================================================================

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        
        {/* TELA DE IDENTIFICAÇÃO INICIAL (LOGIN OU AUTO-CADASTRO) */}
        {!usuarioLogado ? (
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl space-y-5">
            <div className="text-center">
              <span className="text-[10px] font-black tracking-widest text-blue-400 uppercase font-mono bg-blue-500/10 px-2.5 py-1 rounded-md">
                Acesso Docente
              </span>
              <h1 className="text-base font-black text-white mt-3">Portal de Frequência Digital</h1>
            </div>

            {!naoEstouNaLista ? (
              /* MODO A: SELEÇÃO RAPIDA DE QUEM JÁ ESTÁ NO BANCO */
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Localize seu nome</label>
                  <select 
                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs mt-1.5 outline-none text-white font-bold focus:border-blue-500"
                    onChange={(e) => setUsuarioLogado(listaProfessores.find(p => p.id === Number(e.target.value)))}
                    defaultValue=""
                  >
                    <option value="" disabled>Selecione na listagem...</option>
                    {listaProfessores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <div className="text-center pt-2">
                  <button 
                    type="button" 
                    onClick={() => setNaoEstouNaLista(true)}
                    className="text-xs text-blue-400 font-bold hover:underline"
                  >
                    Não encontrou seu nome? Identifique-se aqui ➔
                  </button>
                </div>
              </div>
            ) : (
              /* MODO B: FORMULÁRIO COMPLETO PARA QUEM NÃO CONSTA NO BANCO */
              <form onSubmit={handleEntrarPorIdentificacao} className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Matrícula Funcional</label>
                  <input type="text" required className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white font-mono" placeholder="Ex: 20261099" value={formAutoIdentificacao.matricula} onChange={e => setFormAutoIdentificacao({...formAutoIdentificacao, matricula: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Nome Completo</label>
                  <input type="text" required className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white" placeholder="Ex: Maria de Paiva" value={formAutoIdentificacao.nome} onChange={e => setFormAutoIdentificacao({...formAutoIdentificacao, nome: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Seu Público-Alvo Vigente</label>
                  <select required className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs mt-1 outline-none text-white font-bold" value={formAutoIdentificacao.publico_alvo_id} onChange={e => setFormAutoIdentificacao({...formAutoIdentificacao, publico_alvo_id: e.target.value})}>
                    <option value="" disabled>Selecione seu segmento...</option>
                    {publicosAlvo.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button type="button" onClick={() => setNaoEstouNaLista(false)} className="bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 font-bold p-2.5 rounded-xl text-xs transition">Voltar</button>
                  <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold p-2.5 rounded-xl text-xs transition">Acessar Agenda</button>
                </div>
              </form>
            )}
          </div>
        ) : (
          
          /* MODO SESSÃO ATIVA: AGENDA DE COMPROVAÇÃO DE PRESENÇA */
          <div className="w-full max-w-xl space-y-5 my-2">
            
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-lg">
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase font-mono font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Sessão Conectada</span>
                <h2 className="text-xs font-black text-white pt-1">{usuarioLogado.nome}</h2>
                <p className="text-[10px] text-slate-500 font-mono">{usuarioLogado.matricula ? `Matrícula: ${usuarioLogado.matricula}` : 'Registro Pré-existente'}</p>
              </div>
              <button onClick={executarLogout} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold px-3 py-1.5 rounded-xl text-xs transition">Sair</button>
            </div>

            <div className="space-y-4">
              {eventosDisponiveis.map((ev) => {
                const feed = statusFeed.id === ev.id ? statusFeed : null;
                const painelAberto = exibirPainelPesquisa === ev.id;

                return (
                  <div key={ev.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-md">
                    <div>
                      <div className="flex justify-between items-start gap-3">
                        <h3 className="text-sm font-bold text-white leading-tight">{ev.titulo}</h3>
                        <span className="bg-blue-500/10 text-blue-400 font-mono font-black text-[10px] px-2 py-0.5 rounded">{ev.horas_ofertadas}h</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 font-mono">📍 {ev.local_nome} | 📅 {ev.data} ({ev.horario_inicio} às {ev.horario_fim})</p>
                    </div>

                    {/* INTERFACE DE PESQUISA DE SATISFAÇÃO CONDICIONAL (EXIBIDA APENAS NO CHECK-OUT) */}
                    {painelAberto && (
                      <div className="bg-slate-950 p-4 rounded-xl border border-blue-500/20 space-y-3 animate-fadeIn">
                        <h4 className="text-xs font-black text-blue-400 uppercase tracking-wide">⭐ Pesquisa de Satisfação Obrigatória</h4>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-500">Avaliação do Conteúdo</label>
                          <select className="w-full bg-slate-900 border border-slate-800 p-2 rounded-lg text-xs mt-1 outline-none text-amber-400 font-black" value={pesquisaSatisfacao.nota} onChange={e => setPesquisaSatisfacao({...pesquisaSatisfacao, nota: e.target.value})}>
                            <option value="5">⭐⭐⭐⭐⭐ Excelente / Altamente Produtivo</option>
                            <option value="4">⭐⭐⭐⭐ Muito Bom / Relevante</option>
                            <option value="3">⭐⭐⭐ Regular / Atendeu Parcialmente</option>
                            <option value="2">⭐⭐ Ruim / Pouco Produtivo</option>
                            <option value="1">⭐ Muito Ruim / Insatisfatório</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-500">Críticas ou Comentários (Opcional)</label>
                          <textarea className="w-full bg-slate-900 border border-slate-800 p-2 rounded-lg text-xs mt-1 outline-none text-slate-200 h-16 resize-none" placeholder="Deixe suas observações sobre a formação..." value={pesquisaSatisfacao.comentario} onChange={e => setPesquisaSatisfacao({...pesquisaSatisfacao, comentario: e.target.value})} />
                        </div>
                        <button type="button" onClick={() => processarFrequenciaComGps(ev.id, pesquisaSatisfacao)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 rounded-lg text-xs transition uppercase tracking-wider">Finalizar e Computar Horas</button>
                      </div>
                    )}

                    {/* BOTÃO PRINCIPAL OPERACIONAL (FLEXÍVEL PARA ENTRADA/SAÍDA) */}
                    {!painelAberto && (
                      <button
                        type="button"
                        disabled={feed && feed.tipo === 'processando'}
                        onClick={() => processarFrequenciaComGps(ev.id)}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-black py-2.5 rounded-xl text-xs transition uppercase tracking-wider shadow-sm"
                      >
                        {feed && feed.tipo === 'processando' ? 'Processando...' : 'Registrar Presença neste Evento'}
                      </button>
                    )}

                    {/* RENDERIZADOR DE FEEDBACK DE EVENTOS EM TEMPO REAL */}
                    {feed && (
                      <div className={`p-2.5 rounded-xl text-[11px] font-medium border ${
                        feed.tipo === 'sucesso' ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20' :
                        feed.tipo === 'erro' ? 'bg-red-500/5 text-red-400 border-red-500/20' :
                        feed.tipo === 'alerta' ? 'bg-amber-500/5 text-amber-400 border-amber-500/20' :
                        'bg-blue-500/5 text-blue-400 border-blue-500/20 animate-pulse'
                      }`}>
                        {feed.mensagem}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <footer className="p-4 border-t border-slate-900/40 text-center">
        <p className="text-[9px] text-slate-600 uppercase font-mono tracking-widest">Sincronização de Fluxo Contínuo PostgreSQL</p>
      </footer>
    </div>
  );
}