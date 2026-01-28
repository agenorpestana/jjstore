
import React, { useState, useEffect } from 'react';
import { Search, PackageOpen, ArrowLeft, Lock, User, LogIn, X, Download, Building, Phone as PhoneIcon, UserPlus, CreditCard } from 'lucide-react';
import { Order, Employee, AppSettings, Plan } from './types';
import { getOrderById, authenticateUser, getAppSettings, registerCompany, getPlans } from './services/mockData';
import { StatusTimeline } from './components/StatusTimeline';
import { OrderDetails } from './components/OrderDetails';
import { SupportChat } from './components/SupportChat';
import { AdminDashboard } from './components/AdminDashboard';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { SubscriptionBlock } from './components/SubscriptionBlock';

function App() {
  // Global Settings State
  const [appSettings, setAppSettings] = useState<AppSettings>({ appName: 'Rastreaê', logoUrl: '' });

  // Authentication State
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  
  const [loginForm, setLoginForm] = useState({ login: '', password: '' });
  const [loginError, setLoginError] = useState('');
  
  // Registration State
  const [registerForm, setRegisterForm] = useState({
      companyName: '',
      adminName: '',
      contact: '',
      login: '',
      password: '',
      plan: ''
  });
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [registerError, setRegisterError] = useState('');

  // PWA Install State
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // Customer View State
  const [orderId, setOrderId] = useState('');
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load Settings on Mount
  const loadSettings = async () => {
    try {
        const settings = await getAppSettings();
        setAppSettings(settings);
        document.title = `${settings.appName} - Acompanhamento de Pedidos`;
    } catch (e) {
        console.error("Failed to load settings", e);
    }
  };

  const loadPlans = async () => {
      try {
          const plans = await getPlans();
          setAvailablePlans(plans);
          if (plans.length > 0) {
              setRegisterForm(prev => ({ ...prev, plan: plans[0].name }));
          }
      } catch (e) {
          console.error("Failed to load plans", e);
      }
  }

  useEffect(() => {
    loadSettings();
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === 'accepted') {
        setInstallPrompt(null);
      }
    });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId.trim()) return;

    setLoading(true);
    setError('');
    setCurrentOrder(null);

    try {
      const order = await getOrderById(orderId);
      setCurrentOrder(order);
    } catch (err) {
      setError('Não foi possível encontrar o pedido. Verifique o número e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setCurrentOrder(null);
    setOrderId('');
  };

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoginError('');
      
      try {
          const user = await authenticateUser(loginForm.login, loginForm.password);
          if (user) {
              setCurrentUser(user);
              setShowLoginModal(false);
              setLoginForm({ login: '', password: '' });
              loadSettings();
          }
      } catch (err: any) {
          setLoginError(err.message || 'Login ou senha inválidos.');
      }
  };

  const handleRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      setRegisterError('');

      if (!registerForm.companyName || !registerForm.adminName || !registerForm.login || !registerForm.password || !registerForm.plan) {
          setRegisterError("Preencha todos os campos obrigatórios.");
          return;
      }

      try {
          await registerCompany(registerForm);
          alert("Empresa cadastrada com sucesso! Faça login para continuar.");
          setShowRegisterModal(false);
          setShowLoginModal(true);
          setRegisterForm({ companyName: '', adminName: '', contact: '', login: '', password: '', plan: '' });
      } catch (err: any) {
          setRegisterError(err.message || "Erro ao registrar.");
      }
  }

  // If Logged In, Render Dashboard based on role
  if (currentUser) {
    // Access Control Logic
    if (currentUser.accessLevel === 'saas_admin') {
        return (
            <SuperAdminDashboard 
                currentUser={currentUser}
                onLogout={() => {
                    setCurrentUser(null);
                    window.location.reload();
                }}
            />
        )
    }

    // Block Access if Company is Pending Payment (Trial Expired or Late Payment)
    if (currentUser.companyStatus === 'pending_payment') {
        return (
            <SubscriptionBlock 
                currentUser={currentUser}
                onLogout={() => {
                    setCurrentUser(null);
                    window.location.reload();
                }}
            />
        )
    }

    return (
        <AdminDashboard 
            currentUser={currentUser} 
            onLogout={() => {
                setCurrentUser(null);
                window.location.reload(); // Reset state properly
            }}
            appSettings={appSettings}
            onUpdateSettings={loadSettings}
        />
    );
  }

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={clearSearch}>
            {appSettings.logoUrl ? (
                <img src={appSettings.logoUrl} alt="Logo" className="h-10 w-auto object-contain" />
            ) : (
                <div className="bg-primary p-2 rounded-lg text-white">
                    <PackageOpen size={24} />
                </div>
            )}
            <span className="font-bold text-xl text-gray-900 tracking-tight">{appSettings.appName}</span>
          </div>
          
          <div className="flex items-center gap-4">
            {installPrompt && (
              <button
                onClick={handleInstallClick}
                className="hidden sm:flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-primary px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
              >
                <Download size={16} /> Instalar App
              </button>
            )}

            {currentOrder && (
                <button
                onClick={clearSearch}
                className="text-gray-500 hover:text-primary flex items-center gap-1 text-sm font-medium transition-colors"
                >
                <ArrowLeft size={16} />
                Nova Busca
                </button>
            )}
            {/* Login Toggle */}
            <button 
                onClick={() => setShowLoginModal(true)}
                className="text-gray-400 hover:text-gray-800 transition-colors"
                title="Acesso Administrativo"
            >
                <Lock size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!currentOrder ? (
          /* Landing / Search State */
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-6 tracking-tight">
              Acompanhe seu pedido <br />
              <span className="text-primary bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">em tempo real</span>
            </h1>
            <p className="text-lg text-gray-600 mb-10 max-w-lg">
              Digite o número do seu pedido para ver o status atualizado da sua encomenda.
            </p>

            <form onSubmit={handleSearch} className="w-full max-w-md relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400 group-focus-within:text-primary transition-colors" />
              </div>
              <input
                type="text"
                className="block w-full pl-11 pr-4 py-4 border-2 border-gray-200 rounded-2xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-4 focus:ring-blue-50 transition-all duration-300 shadow-sm"
                placeholder="Ex: 12345"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
              />
              <button
                type="submit"
                disabled={loading}
                className="absolute right-2 top-2 bottom-2 bg-primary text-white px-6 rounded-xl font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? 'Buscando...' : 'Rastrear'}
              </button>
            </form>

            <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-gray-500">
              {installPrompt && (
                <button onClick={handleInstallClick} className="px-3 py-1 bg-blue-50 text-blue-700 font-semibold rounded-full hover:bg-blue-100 transition-colors flex items-center gap-1">
                  <Download size={14} /> Instalar App
                </button>
              )}
              <span className="px-3 py-1 bg-gray-100 rounded-full">🚀 Rastreamento Rápido</span>
              <span className="px-3 py-1 bg-gray-100 rounded-full">💬 Suporte IA</span>
            </div>
            {error && <p className="mt-4 text-red-500 font-medium">{error}</p>}
          </div>
        ) : (
          /* Results State */
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Pedido #{currentOrder.id}</h2>
              </div>
              <div className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-50 text-primary border border-blue-100 font-medium">
                <span className="w-2 h-2 rounded-full bg-primary mr-2 animate-pulse"></span>
                Atualizado agora
              </div>
            </div>

            {/* LAYOUT GRID ALTERADO: 12 COLUNAS PARA MELHOR CONTROLE */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Timeline (Ocupa 5 de 12 colunas no desktop = ~40%) */}
              <div className="lg:col-span-5 space-y-8">
                <StatusTimeline
                  timeline={currentOrder.timeline}
                  currentStatus={currentOrder.currentStatus}
                />
              </div>

              {/* Right Column: Details (Ocupa 7 de 12 colunas no desktop = ~60%) */}
              <div className="lg:col-span-7">
                <OrderDetails order={currentOrder} appSettings={appSettings} />
              </div>
            </div>

            {/* AI Chat Support */}
            <SupportChat order={currentOrder} />
          </div>
        )}
      </main>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 relative">
                <button 
                    onClick={() => setShowLoginModal(false)} 
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                    <X size={20} />
                </button>
                <div className="text-center mb-6">
                    <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-primary">
                        <User size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800">Acesso Restrito</h3>
                    <p className="text-sm text-gray-500">Faça login para gerenciar pedidos.</p>
                </div>
                
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Login</label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 text-gray-400" size={18} />
                            <input 
                                type="text" 
                                className="w-full border border-gray-300 rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-primary focus:outline-none"
                                placeholder="Usuário"
                                value={loginForm.login}
                                onChange={e => setLoginForm({...loginForm, login: e.target.value})}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                            <input 
                                type="password" 
                                className="w-full border border-gray-300 rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-primary focus:outline-none"
                                placeholder="••••••"
                                value={loginForm.password}
                                onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                            />
                        </div>
                    </div>
                    
                    {loginError && <p className="text-sm text-red-500 text-center">{loginError}</p>}

                    <button 
                        type="submit" 
                        className="w-full bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2"
                    >
                        <LogIn size={18} /> Entrar
                    </button>

                    <div className="border-t border-gray-100 pt-4 mt-2">
                         <button 
                            type="button"
                            onClick={() => { 
                                setShowLoginModal(false); 
                                setShowRegisterModal(true); 
                                loadPlans(); // Fetch plans when opening register
                            }}
                            className="w-full bg-green-50 text-green-700 py-2 rounded-lg text-sm font-medium hover:bg-green-100 transition flex items-center justify-center gap-2"
                         >
                             <Building size={16} /> Cadastrar Empresa (SaaS)
                         </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Register SaaS Modal */}
      {showRegisterModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-6 relative">
                  <button 
                      onClick={() => setShowRegisterModal(false)} 
                      className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                  >
                      <X size={20} />
                  </button>
                  <div className="text-center mb-6">
                      <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-green-600">
                          <Building size={24} />
                      </div>
                      <h3 className="text-xl font-bold text-gray-800">Criar Conta Empresarial</h3>
                      <p className="text-sm text-gray-500">Comece a usar o Rastreaê agora mesmo.</p>
                  </div>

                  <form onSubmit={handleRegister} className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa</label>
                          <div className="relative">
                              <Building className="absolute left-3 top-3 text-gray-400" size={18} />
                              <input 
                                  type="text" 
                                  className="w-full border border-gray-300 rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-primary focus:outline-none"
                                  placeholder="Minha Empresa Ltda"
                                  value={registerForm.companyName}
                                  onChange={e => setRegisterForm({...registerForm, companyName: e.target.value})}
                              />
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Administrador</label>
                          <div className="relative">
                              <UserPlus className="absolute left-3 top-3 text-gray-400" size={18} />
                              <input 
                                  type="text" 
                                  className="w-full border border-gray-300 rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-primary focus:outline-none"
                                  placeholder="Seu Nome"
                                  value={registerForm.adminName}
                                  onChange={e => setRegisterForm({...registerForm, adminName: e.target.value})}
                              />
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Celular / Contato</label>
                          <div className="relative">
                              <PhoneIcon className="absolute left-3 top-3 text-gray-400" size={18} />
                              <input 
                                  type="text" 
                                  className="w-full border border-gray-300 rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-primary focus:outline-none"
                                  placeholder="(00) 00000-0000"
                                  value={registerForm.contact}
                                  onChange={e => setRegisterForm({...registerForm, contact: e.target.value})}
                              />
                          </div>
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Escolha seu Plano</label>
                          <div className="relative">
                              <CreditCard className="absolute left-3 top-3 text-gray-400" size={18} />
                              <select 
                                  className="w-full border border-gray-300 rounded-lg p-2.5 pl-10 bg-white focus:ring-2 focus:ring-primary focus:outline-none appearance-none"
                                  value={registerForm.plan}
                                  onChange={e => setRegisterForm({...registerForm, plan: e.target.value})}
                              >
                                  {availablePlans.length === 0 && <option value="">Carregando planos...</option>}
                                  {availablePlans.map(plan => (
                                      <option key={plan.id} value={plan.name}>
                                          {plan.name} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(plan.price)}/mês
                                      </option>
                                  ))}
                              </select>
                          </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Login Admin</label>
                            <input 
                                type="text" 
                                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary focus:outline-none"
                                placeholder="admin.empresa"
                                value={registerForm.login}
                                onChange={e => setRegisterForm({...registerForm, login: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                            <input 
                                type="password" 
                                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary focus:outline-none"
                                placeholder="******"
                                value={registerForm.password}
                                onChange={e => setRegisterForm({...registerForm, password: e.target.value})}
                            />
                        </div>
                      </div>

                      {registerError && <p className="text-sm text-red-500 text-center">{registerError}</p>}

                      <button 
                          type="submit" 
                          className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 transition shadow-sm"
                      >
                          Registrar Empresa
                      </button>
                      <button 
                          type="button"
                          onClick={() => { setShowRegisterModal(false); setShowLoginModal(true); }}
                          className="w-full text-gray-500 py-2 text-sm hover:text-gray-700"
                      >
                          Voltar para Login
                      </button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}

export default App;
