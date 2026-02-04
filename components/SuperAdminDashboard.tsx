
import React, { useState, useEffect } from 'react';
import { Building, X, Search, Shield, LogOut, LayoutList, Plus, Edit2, Trash2, CheckCircle, Ban, Phone, User, Calendar, CreditCard, Settings, Save, DollarSign, Eye, EyeOff, Minus } from 'lucide-react';
import { Employee, Company, Plan } from '../types';
import { getCompanies, updateCompanyStatus, getPlans, createPlan, updatePlan, deletePlan, registerCompany, getSaasSettings, saveSaasSettings, manualRenewCompany, deleteCompany, togglePlanVisibility, revokeCompanyMonth } from '../services/mockData';

interface SuperAdminDashboardProps {
  currentUser: Employee;
  onLogout: () => void;
}

type Tab = 'companies' | 'plans' | 'settings';

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ currentUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState<Tab>('companies');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);

  // Settings State
  const [mpAccessToken, setMpAccessToken] = useState('');
  const [mpPublicKey, setMpPublicKey] = useState('');

  // Modals
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [showCompanyModal, setShowCompanyModal] = useState(false); 

  // Plan Form State
  const [planForm, setPlanForm] = useState({ name: '', price: '', description: '', features: '' });

  // Company Form State
  const [companyForm, setCompanyForm] = useState({
      companyName: '',
      adminName: '',
      contact: '',
      login: '',
      password: '',
      plan: 'Básico'
  });

  useEffect(() => {
    if (activeTab === 'companies') fetchCompanies();
    if (activeTab === 'plans') fetchPlans();
    if (activeTab === 'settings') fetchSettings();
  }, [activeTab]);

  const fetchCompanies = async () => {
      setLoading(true);
      const data = await getCompanies();
      setCompanies(data);
      setLoading(false);
  };

  const fetchPlans = async () => {
      setLoading(true);
      const data = await getPlans();
      setPlans(data);
      setLoading(false);
  };

  const fetchSettings = async () => {
      setLoading(true);
      const settings = await getSaasSettings();
      setMpAccessToken(settings.mpAccessToken || '');
      setMpPublicKey(settings.mpPublicKey || '');
      setLoading(false);
  }

  const handleSaveSettings = async () => {
      try {
          await saveSaasSettings({ mpAccessToken, mpPublicKey });
          alert('Chaves API salvas com sucesso!');
      } catch (err) {
          alert('Erro ao salvar');
      }
  }

  const handleToggleStatus = async (id: string, currentStatus: string) => {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      if (window.confirm(`Deseja realmente ${newStatus === 'active' ? 'ativar' : 'suspender'} esta empresa?`)) {
          await updateCompanyStatus(id, newStatus);
          fetchCompanies();
      }
  };

  const handleManualRenew = async (id: string, name: string) => {
      if (window.confirm(`Confirmar pagamento manual (dinheiro/outros) para a empresa ${name}?\n\nIsso adicionará 30 dias à assinatura.`)) {
          try {
              await manualRenewCompany(id);
              alert('Assinatura renovada com sucesso!');
              fetchCompanies();
          } catch (e: any) {
              alert(e.message || 'Erro ao renovar.');
          }
      }
  }

  const handleRevokeMonth = async (id: string, name: string) => {
      if (window.confirm(`ATENÇÃO: Deseja REMOVER 30 dias da assinatura de ${name}?\n\nUse apenas em caso de erro.`)) {
          try {
              await revokeCompanyMonth(id);
              alert('1 mês removido com sucesso!');
              fetchCompanies();
          } catch (e: any) {
              alert(e.message || 'Erro ao remover mês.');
          }
      }
  }

  const handleDeleteCompany = async (id: string, name: string) => {
      if (window.confirm(`ATENÇÃO: Deseja excluir a empresa ${name}?\n\nEsta ação é irreversível. Só é possível excluir se a empresa NÃO tiver pedidos vinculados.`)) {
          try {
              await deleteCompany(id);
              alert('Empresa excluída com sucesso!');
              fetchCompanies();
          } catch (e: any) {
              alert(e.message || 'Erro ao excluir. Verifique se existem pedidos.');
          }
      }
  }

  // --- Plan Logic ---
  const handleOpenPlanModal = (plan?: Plan) => {
      if (plan) {
          setEditingPlan(plan);
          setPlanForm({ 
              name: plan.name, 
              price: plan.price.toString(), 
              description: plan.description, 
              features: plan.features 
          });
      } else {
          setEditingPlan(null);
          setPlanForm({ name: '', price: '', description: '', features: '' });
      }
      setShowPlanModal(true);
  };

  const handleSubmitPlan = async () => {
      const payload = {
          name: planForm.name,
          price: parseFloat(planForm.price),
          description: planForm.description,
          features: planForm.features,
          visible: editingPlan ? editingPlan.visible : true
      };

      if (editingPlan) {
          await updatePlan(editingPlan.id, payload);
      } else {
          await createPlan(payload);
      }
      setShowPlanModal(false);
      fetchPlans();
  };

  const handleDeletePlan = async (id: number) => {
      if (window.confirm('Tem certeza? Isso não afetará empresas que já usam este plano.')) {
          await deletePlan(id);
          fetchPlans();
      }
  }

  const handleTogglePlanVisibility = async (id: number, currentVisible: boolean) => {
      await togglePlanVisibility(id, !currentVisible);
      fetchPlans();
  }

  // --- Company Registration Logic ---
  const handleSubmitCompany = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          await registerCompany(companyForm);
          alert('Empresa cadastrada com sucesso!');
          setShowCompanyModal(false);
          setCompanyForm({ companyName: '', adminName: '', contact: '', login: '', password: '', plan: 'Básico' });
          fetchCompanies();
      } catch (err: any) {
          alert(err.message || 'Erro ao cadastrar');
      }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navbar */}
      <div className="bg-gray-900 text-white shadow-md">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <Shield className="text-green-400" />
                  <span className="font-bold text-xl tracking-tight">Rastreaê <span className="text-green-400">SaaS Admin</span></span>
              </div>
              <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-300">Olá, Suporte</span>
                  <button onClick={onLogout} className="flex items-center gap-2 text-sm hover:text-red-400 transition">
                      <LogOut size={16} /> Sair
                  </button>
              </div>
          </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
          
          {/* Tabs */}
          <div className="flex gap-4 mb-6">
              <button 
                onClick={() => setActiveTab('companies')}
                className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition ${activeTab === 'companies' ? 'bg-white text-gray-900 shadow-sm' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
              >
                  <Building size={18} /> Empresas
              </button>
              <button 
                onClick={() => setActiveTab('plans')}
                className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition ${activeTab === 'plans' ? 'bg-white text-gray-900 shadow-sm' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
              >
                  <LayoutList size={18} /> Planos
              </button>
              <button 
                onClick={() => setActiveTab('settings')}
                className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition ${activeTab === 'settings' ? 'bg-white text-gray-900 shadow-sm' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
              >
                  <Settings size={18} /> Configurações
              </button>
          </div>

          {/* Companies Tab */}
          {activeTab === 'companies' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                      <h2 className="font-bold text-gray-800">Empresas Cadastradas</h2>
                      <button 
                          onClick={() => setShowCompanyModal(true)}
                          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 flex items-center gap-2"
                      >
                          <Plus size={16} /> Nova Empresa
                      </button>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                              <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empresa</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admin / Contato</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plano</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                              {companies.map(company => (
                                  <tr key={company.id} className="hover:bg-gray-50">
                                      <td className="px-6 py-4">
                                          <div className="text-sm font-medium text-gray-900">{company.name}</div>
                                          <div className="text-xs text-gray-400">ID: {company.id}</div>
                                          {company.trial_ends_at && (
                                              <div className="text-xs text-blue-500 mt-1">Trial até: {new Date(company.trial_ends_at).toLocaleDateString()}</div>
                                          )}
                                          {company.next_payment_due && (
                                              <div className="text-xs text-gray-500 mt-1">Vence: {new Date(company.next_payment_due).toLocaleDateString()}</div>
                                          )}
                                      </td>
                                      <td className="px-6 py-4">
                                          <div className="flex flex-col text-sm">
                                              <span className="font-medium text-gray-800">{company.adminName || 'N/A'}</span>
                                              <span className="text-gray-500 flex items-center gap-1"><Phone size={12}/> {company.contact}</span>
                                              <span className="text-gray-400 text-xs">Login: {company.login}</span>
                                          </div>
                                      </td>
                                      <td className="px-6 py-4">
                                          <span className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold">
                                              {company.plan}
                                          </span>
                                      </td>
                                      <td className="px-6 py-4">
                                          {company.status === 'active' && (
                                              <span className="flex items-center gap-1 text-green-600 text-sm font-medium"><CheckCircle size={16} /> Ativo</span>
                                          )}
                                          {company.status === 'inactive' && (
                                              <span className="flex items-center gap-1 text-red-600 text-sm font-medium"><Ban size={16} /> Suspenso</span>
                                          )}
                                          {company.status === 'trial' && (
                                              <span className="flex items-center gap-1 text-blue-600 text-sm font-medium"><CreditCard size={16} /> Trial</span>
                                          )}
                                          {company.status === 'pending_payment' && (
                                              <span className="flex items-center gap-1 text-orange-600 text-sm font-medium"><CreditCard size={16} /> Pagamento Pendente</span>
                                          )}
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                          <div className="flex justify-end gap-2">
                                              <button
                                                  onClick={() => handleManualRenew(company.id, company.name)}
                                                  title="Adicionar 1 Mês (Renovar Manualmente)"
                                                  className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition"
                                              >
                                                  <DollarSign size={16} />
                                              </button>

                                               <button
                                                  onClick={() => handleRevokeMonth(company.id, company.name)}
                                                  title="Remover 1 Mês (Correção)"
                                                  className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
                                              >
                                                  <Minus size={16} />
                                              </button>
                                              
                                              <button 
                                                  onClick={() => handleToggleStatus(company.id, company.status)}
                                                  title={company.status === 'inactive' ? 'Ativar' : 'Suspender'}
                                                  className={`p-1.5 rounded-lg transition ${
                                                      company.status === 'inactive' 
                                                      ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                                                      : 'text-orange-600 bg-orange-50 hover:bg-orange-100' 
                                                  }`}
                                              >
                                                  <Ban size={16} />
                                              </button>

                                              <button
                                                  onClick={() => handleDeleteCompany(company.id, company.name)}
                                                  title="Excluir Empresa"
                                                  className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                                              >
                                                  <Trash2 size={16} />
                                              </button>
                                          </div>
                                      </td>
                                  </tr>
                              ))}
                              {companies.length === 0 && (
                                  <tr><td colSpan={5} className="p-8 text-center text-gray-500">Nenhuma empresa encontrada.</td></tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}

          {/* Plans Tab */}
          {activeTab === 'plans' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Add New Card */}
                  <button 
                      onClick={() => handleOpenPlanModal()}
                      className="border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center p-8 hover:border-gray-900 hover:bg-gray-50 transition min-h-[250px]"
                  >
                      <Plus size={32} className="text-gray-400 mb-2" />
                      <span className="font-medium text-gray-600">Criar Novo Plano</span>
                  </button>

                  {plans.map(plan => (
                      <div key={plan.id} className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col ${!plan.visible ? 'opacity-75 bg-gray-50' : ''}`}>
                          <div className="flex justify-between items-start mb-4">
                              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                  {plan.name}
                                  {!plan.visible && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Oculto</span>}
                              </h3>
                              <span className="text-lg font-semibold text-green-600">
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(plan.price)}
                                  <span className="text-sm text-gray-400 font-normal">/mês</span>
                              </span>
                          </div>
                          <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
                          <div className="flex-1 space-y-2 mb-6">
                              {plan.features.split(',').map((feat, i) => (
                                  <div key={i} className="flex items-start gap-2 text-sm text-gray-500">
                                      <CheckCircle size={14} className="text-green-500 mt-0.5" />
                                      <span>{feat.trim()}</span>
                                  </div>
                              ))}
                          </div>
                          <div className="flex gap-2 border-t border-gray-100 pt-4">
                              <button onClick={() => handleOpenPlanModal(plan)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium text-sm hover:bg-gray-200">Editar</button>
                              <button 
                                onClick={() => handleTogglePlanVisibility(plan.id, plan.visible)} 
                                title={plan.visible ? "Ocultar para novos clientes" : "Mostrar para novos clientes"}
                                className={`px-3 rounded-lg ${plan.visible ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                              >
                                  {plan.visible ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                              <button onClick={() => handleDeletePlan(plan.id)} className="px-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 size={16} /></button>
                          </div>
                      </div>
                  ))}
              </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
              <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <CreditCard className="text-blue-600" /> Integração Mercado Pago
                  </h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Access Token (Produção)</label>
                          <input 
                              type="text" 
                              className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
                              value={mpAccessToken}
                              onChange={e => setMpAccessToken(e.target.value)}
                              placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Public Key</label>
                          <input 
                              type="text" 
                              className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
                              value={mpPublicKey}
                              onChange={e => setMpPublicKey(e.target.value)}
                              placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          />
                      </div>
                      <div className="pt-4 flex justify-end">
                          <button 
                              onClick={handleSaveSettings}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2"
                          >
                              <Save size={18} /> Salvar Chaves
                          </button>
                      </div>
                  </div>
              </div>
          )}
      </div>

      {/* MODAL: PLAN MANAGE */}
      {showPlanModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl w-full max-w-md shadow-xl p-6 relative">
                  <button onClick={() => setShowPlanModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
                  <h3 className="text-lg font-bold text-gray-800 mb-4">{editingPlan ? 'Editar Plano' : 'Novo Plano'}</h3>
                  <div className="space-y-3">
                      <input 
                          type="text" placeholder="Nome do Plano (ex: Pro)" 
                          className="w-full border border-gray-300 rounded-lg p-2.5"
                          value={planForm.name} onChange={e => setPlanForm({...planForm, name: e.target.value})}
                      />
                      <input 
                          type="number" placeholder="Preço Mensal (ex: 99.90)" 
                          className="w-full border border-gray-300 rounded-lg p-2.5"
                          value={planForm.price} onChange={e => setPlanForm({...planForm, price: e.target.value})}
                      />
                      <textarea 
                          placeholder="Descrição Curta" 
                          className="w-full border border-gray-300 rounded-lg p-2.5"
                          value={planForm.description} onChange={e => setPlanForm({...planForm, description: e.target.value})}
                      />
                      <textarea 
                          placeholder="Funcionalidades (separadas por vírgula)" 
                          className="w-full border border-gray-300 rounded-lg p-2.5 h-24"
                          value={planForm.features} onChange={e => setPlanForm({...planForm, features: e.target.value})}
                      />
                      <button 
                          onClick={handleSubmitPlan}
                          className="w-full bg-gray-900 text-white py-2.5 rounded-lg font-medium hover:bg-gray-800"
                      >
                          Salvar Plano
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL: COMPANY REGISTRATION (INTERNAL) */}
      {showCompanyModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl w-full max-w-md shadow-xl p-6 relative max-h-[90vh] overflow-y-auto">
                  <button onClick={() => setShowCompanyModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Cadastrar Nova Empresa</h3>
                  <form onSubmit={handleSubmitCompany} className="space-y-3">
                       <input 
                          type="text" placeholder="Nome da Empresa" required
                          className="w-full border border-gray-300 rounded-lg p-2.5"
                          value={companyForm.companyName} onChange={e => setCompanyForm({...companyForm, companyName: e.target.value})}
                      />
                      <input 
                          type="text" placeholder="Nome do Admin" required
                          className="w-full border border-gray-300 rounded-lg p-2.5"
                          value={companyForm.adminName} onChange={e => setCompanyForm({...companyForm, adminName: e.target.value})}
                      />
                       <input 
                          type="text" placeholder="Contato" required
                          className="w-full border border-gray-300 rounded-lg p-2.5"
                          value={companyForm.contact} onChange={e => setCompanyForm({...companyForm, contact: e.target.value})}
                      />
                      <select 
                          className="w-full border border-gray-300 rounded-lg p-2.5 bg-white"
                          value={companyForm.plan} onChange={e => setCompanyForm({...companyForm, plan: e.target.value})}
                      >
                          {plans.filter(p => p.visible).map(p => <option key={p.id} value={p.name}>{p.name} - R$ {p.price}</option>)}
                      </select>
                      <hr className="my-2"/>
                      <input 
                          type="text" placeholder="Login Admin" required
                          className="w-full border border-gray-300 rounded-lg p-2.5"
                          value={companyForm.login} onChange={e => setCompanyForm({...companyForm, login: e.target.value})}
                      />
                      <input 
                          type="password" placeholder="Senha" required
                          className="w-full border border-gray-300 rounded-lg p-2.5"
                          value={companyForm.password} onChange={e => setCompanyForm({...companyForm, password: e.target.value})}
                      />
                      <button type="submit" className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700">
                          Confirmar Cadastro
                      </button>
                  </form>
              </div>
          </div>
      )}

    </div>
  );
};
