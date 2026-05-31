/**
 * SOG - Ouvidoria v2.0
 * Scripts Globais de Comportamento e Interface
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Auto-ocultar mensagens de feedback (Mensagens de Sucesso do CRUD)
    const alertas = document.querySelectorAll('.bg-emerald-50, .bg-red-50');
    alertas.forEach(alerta => {
        setTimeout(() => {
            alerta.style.transition = 'all 0.5s ease';
            alerta.style.opacity = '0';
            alerta.style.transform = 'translateY(-10px)';
            setTimeout(() => alerta.remove(), 500);
        }, 5000); // Desaparece automaticamente após 5 segundos
    });

    // 2. Máscara de CPF Dinâmica (Executada se o campo existir na tela atual)
    const cpfInput = document.querySelector('input[name="cpf"]');
    if (cpfInput) {
        cpfInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, ''); // Remove tudo o que não for número
            
            // Aplica a formatação 000.000.000-00
            if (value.length <= 11) {
                value = value.replace(/(\d{3})(\d)/, '$1.$2');
                value = value.replace(/(\d{3})(\d)/, '$1.$2');
                value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            }
            
            e.target.value = value;
        });
    }
});

/**
 * Inicialização de funções auxiliares do AlpineJS (se necessário expandir)
 * O estado 'sidebarOpen' já está injetado inline no HTML via x-data,
 * centralizando o controle de abertura e fechamento de forma nativa.
 */
function escopoGlobal() {
    return {
        // Espaço reservado para lógicas complexas futuras da Ouvidoria
    }
}