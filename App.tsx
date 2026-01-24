import React, { useState, useEffect } from 'react';
import { Search, PackageOpen, ArrowLeft, Lock, User, LogIn, X, Download } from 'lucide-react';
import { Order, Employee } from './types';
import { getOrderById, authenticateUser } from './services/mockData';
import { StatusTimeline } from './components/StatusTimeline';
import { OrderDetails } from './components/OrderDetails';
import { SupportChat } from './components/SupportChat';
import { AdminDashboard } from './components/AdminDashboard';

function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ login: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // PWA Install State
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // Customer View State
  const [orderId, setOrderId] = useState('');
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle PWA Install Prompt
  useEffect(() => {
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
      
      const user = await authenticateUser(loginForm.login, loginForm.password);
      if (user) {
          setCurrentUser(user);
          setShowLoginModal(false);
          setLoginForm({ login: '', password: '' });
      } else {
          setLoginError('Login ou senha inválidos.');
      }
  };

  // If Logged In, Render Dashboard
  if (currentUser) {
    return <AdminDashboard currentUser={currentUser} onLogout={() => setCurrentUser(null)} />;
  }

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={clearSearch}>
            <div className="bg-primary p-2 rounded-lg text-white">
              <PackageOpen size={24} />
            </div>
            <span className="font-bold text-xl text-gray-900 tracking-tight">Rastreaê</span>
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Timeline */}
              <div className="lg:col-span-2 space-y-8">
                <StatusTimeline
                  timeline={currentOrder.timeline}
                  currentStatus={currentOrder.currentStatus}
                />
              </div>

              {/* Right Column: Details */}
              <div className="lg:col-span-1">
                <OrderDetails order={currentOrder} />
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
                    
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 text-center border border-gray-100">
                        <p className="font-semibold mb-1">Dados de Teste:</p>
                        <p>Admin: admin / 123</p>
                        <p>Usuário: user / 123</p>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}

export default App;