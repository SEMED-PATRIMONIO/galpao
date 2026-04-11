// Principais estados e funções do Componente
const MedicalPortal = () => {
    const [alunoSelecionado, setAlunoSelecionado] = useState(null);
    const [historico, setHistorico] = useState([]);

    // Busca o histórico completo ao selecionar um aluno 
    const carregarProntuario = async (id) => {
        const res = await fetch(`/api/historico/${id}`);
        const data = await res.json();
        setHistorico(data);
        setAlunoSelecionado(id);
    };

    return (
        <div className="flex h-screen bg-blue-50">
            {/* Lista de Alunos da Especialidade (Esquerda) */}
            <aside className="w-1/4 bg-white border-r border-blue-100 p-4">
                <h2 className="text-blue-900 font-bold mb-4">Meus Pacientes/Alunos</h2>
                {/* Loop de alunos aqui... */}
            </aside>

            {/* Prontuário e Evolução (Centro) */}
            <main className="flex-1 p-6 overflow-y-auto">
                {alunoSelecionado ? (
                    <div className="space-y-6">
                        <header className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-600">
                            <h1 className="text-2xl font-bold">Histórico Clínico Integrado</h1>
                            <p className="text-slate-500">Visualizando toda a vida clínica do aluno</p>
                        </header>

                        {/* Timeline Multidisciplinar */}
                        <div className="space-y-4">
                            {historico.map(atend => (
                                <div key={atend.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-100">
                                    <div className="flex justify-between mb-2">
                                        <span className="font-bold text-blue-700">{atend.nome_especialidade}</span>
                                        <span className="text-sm text-slate-400">{new Date(atend.data_hora).toLocaleString()}</span>
                                    </div>
                                    <p className="text-slate-700 italic">"{atend.evolucao}"</p>
                                    {atend.observacao_clinica && (
                                        <p className="mt-2 text-sm text-slate-500 bg-slate-50 p-2 rounded">
                                            Obs: {atend.observacao_clinica}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex h-full items-center justify-center text-slate-400">
                        Selecione um aluno para ver o histórico clínico completo.
                    </div>
                )}
            </main>

            {/* Ações: Agendar e Registrar (Direita) */}
            <aside className="w-1/4 p-4 space-y-4">
                <button className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold shadow-lg hover:bg-blue-700">
                    ➕ Novo Agendamento
                </button>
                <button className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold shadow-lg hover:bg-emerald-700">
                    📝 Registrar Atendimento
                </button>
                <button className="w-full py-3 bg-red-500 text-white rounded-lg font-bold shadow-lg hover:bg-red-600">
                    ❌ Registrar Falta
                </button>
            </aside>
        </div>
    );
};