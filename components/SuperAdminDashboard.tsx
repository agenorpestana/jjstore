
import React, { useState, useEffect } from 'react';
import { Building, X, Search, Shield, LogOut, LayoutList, Plus, Edit2, Trash2, CheckCircle, Ban, Phone, User, Calendar, CreditCard } from 'lucide-react';
import { Employee, Company, Plan } from '../types';
import { getCompanies, updateCompanyStatus, getPlans, createPlan, updatePlan, deletePlan, registerCompany } from '../services/mockData';

interface SuperAdminDashboardProps {
  currentUser: Employee;
  onLogout: () => void;
}

type Tab = 'companies' | 'plans';

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ currentUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState<Tab>('companies');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [showCompanyModal, setShowCompanyModal] = useState(false); // Para registrar empresas manualmente

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

  const handleToggleStatus = async (id: string, currentStatus: string) => {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      if (window.confirm(`Deseja realmente ${newStatus === 'active' ? 'ativar' : 'suspender'} esta empresa?`)) {
          await updateCompanyStatus(id, newStatus);
          fetchCompanies();
      }
  };

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
          features: planForm.features
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
                                          {company.status === 'active' ? (
                                              <span className="flex items-center gap-1 text-green-600 text-sm font-medium"><CheckCircle size={16} /> Ativo</span>
                                          ) : (
                                              <span className="flex items-center gap-1 text-red-600 text-sm font-medium"><Ban size={16} /> Suspenso</span>
                                          )}
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                          <button 
                                              onClick={() => handleToggleStatus(company.id, company.status)}
                                              className={`text-sm font-medium px-3 py-1.5 rounded-lg transition ${
                                                  company.status === 'active' 
                                                  ? 'text-red-600 bg-red-50 hover:bg-red-100' 
                                                  : 'text-green-600 bg-green-50 hover:bg-green-100'
                                              }`}
                                          >
                                              {company.status === 'active' ? 'Suspender' : 'Ativar'}
                                          </button>
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
                      <div key={plan.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
                          <div className="flex justify-between items-start mb-4">
                              <h3 className="text-xl font-bold text-gray-800">{plan.name}</h3>
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
                              <button onClick={() => handleDeletePlan(plan.id)} className="px-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 size={16} /></button>
                          </div>
                      </div>
                  ))}
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
                          {plans.map(p => <option key={p.id} value={p.name}>{p.name} - R$ {p.price}</option>)}
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
