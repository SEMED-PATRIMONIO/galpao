document.addEventListener('DOMContentLoaded', () => {
  // Mapeamento dos elementos da DOM
  const sectionLoading = document.getElementById('section-loading');
  const sectionWelcome = document.getElementById('section-welcome');
  const sectionLogin = document.getElementById('section-login');
  const sectionDashboard = document.getElementById('section-dashboard');

  const btnShowLogin = document.getElementById('btn-show-login');
  const btnBackWelcome = document.getElementById('btn-back-welcome');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const userDisplayName = document.getElementById('user-display-name');
  const btnLogout = document.getElementById('btn-logout');

  // Chave para armazenar o token no navegador/celular
  const TOKEN_KEY = 'lifyn_token';

  // Executa a validação assim que o app abre
  inicializarApp();

  // ---------------------------------------------------------------------------
  // FLUXO PRINCIPAL
  // ---------------------------------------------------------------------------
  async function inicializarApp() {
    exibirSecao(sectionLoading);
    const token = localStorage.getItem(TOKEN_KEY);

    if (token) {
      // Se possui token local, tenta autenticar automaticamente no backend
      const usuario = await validarTokenNoServidor(token);
      
      if (usuario) {
        carregarDashboard(usuario);
        return;
      } else {
        // Se o token for inválido/expirado, limpa o armazenamento local
        localStorage.removeItem(TOKEN_KEY);
      }
    }

    // Se não houver token válido, exibe a tela inicial para dispositivos novos
    exibirSecao(sectionWelcome);
  }

  // ---------------------------------------------------------------------------
  // REQUISIÇÕES À API (Porta 3038 via Nginx)
  // ---------------------------------------------------------------------------
  async function validarTokenNoServidor(token) {
    try {
      const response = await fetch('/api/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.user;
      }
      return null;
    } catch (err) {
      console.error('Erro na conexão ao validar token:', err);
      return null;
    }
  }

  async function efetuarLogin(username, password) {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao realizar login.');
      }

      // Grava o token no dispositivo novo para futuros acessos diretos
      localStorage.setItem(TOKEN_KEY, data.token);
      carregarDashboard(data.user);

    } catch (err) {
      exibirErro(err.message);
    }
  }

  // ---------------------------------------------------------------------------
  // EVENTOS E INTERAÇÕES DE TELA
  // ---------------------------------------------------------------------------
  btnShowLogin.addEventListener('click', () => {
    limparErros();
    exibirSecao(sectionLogin);
  });

  btnBackWelcome.addEventListener('click', () => {
    limparErros();
    exibirSecao(sectionWelcome);
  });

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    limparErros();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (username && password) {
      efetuarLogin(username, password);
    }
  });

  btnLogout.addEventListener('click', () => {
    // Remove o acesso persistente deste dispositivo
    localStorage.removeItem(TOKEN_KEY);
    loginForm.reset();
    exibirSecao(sectionWelcome);
  });

  // ---------------------------------------------------------------------------
  // FUNÇÕES AUXILIARES DE INTERFACE
  // ---------------------------------------------------------------------------
  function carregarDashboard(usuario) {
    userDisplayName.textContent = usuario.dadosConta?.nome || usuario.username;
    exibirSecao(sectionDashboard);
  }

  function exibirSecao(secaoParaExibir) {
    [sectionLoading, sectionWelcome, sectionLogin, sectionDashboard].forEach(sec => {
      sec.classList.add('hidden');
    });
    secaoParaExibir.classList.remove('hidden');
  }

  function exibirErro(mensagem) {
    loginError.textContent = mensagem;
    loginError.classList.remove('hidden');
  }

  function limparErros() {
    loginError.textContent = '';
    loginError.classList.add('hidden');
  }
});