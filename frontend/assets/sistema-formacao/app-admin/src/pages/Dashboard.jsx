import React from 'react';

export default function Dashboard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-slate-500 text-sm font-medium">Total de Professores</h3>
        <p className="text-3xl font-bold text-blue-600">1,240</p>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-slate-500 text-sm font-medium">Formações este Mês</h3>
        <p className="text-3xl font-bold text-green-600">12</p>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-slate-500 text-sm font-medium">Horas Certificadas</h3>
        <p className="text-3xl font-bold text-orange-600">4,800h</p>
      </div>
      
      <div className="md:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold mb-4 text-slate-800">Próximos Eventos</h3>
        <table className="w-full text-left">
          <thead>
            <tr className="text-slate-400 text-sm border-b">
              <th className="pb-3">Evento</th>
              <th className="pb-3">Data</th>
              <th className="pb-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b last:border-0">
              <td className="py-4 font-medium">Formação de Alfabetização</td>
              <td className="py-4 text-slate-600">20/05/2026</td>
              <td className="py-4 text-blue-500 font-bold cursor-pointer">Gerar QR Code</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}