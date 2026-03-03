
import React, { useEffect, useState } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign, Calendar, FileText, Search, Filter } from 'lucide-react';
import { Transaction } from '../types';
import { getTransactions, createTransaction, deleteTransaction } from '../services/mockData';

export const FinanceModule: React.FC = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'revenue' | 'expense'>('all');

    const [form, setForm] = useState({
        type: 'revenue' as 'revenue' | 'expense',
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0]
    });

    const loadTransactions = async () => {
        setLoading(true);
        try {
            const data = await getTransactions();
            setTransactions(data);
        } catch (err) {
            console.error("Error loading transactions:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTransactions();
    }, []);

    const handleAddTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.description || !form.amount || !form.date) return;

        try {
            await createTransaction({
                type: form.type,
                description: form.description,
                amount: Number(form.amount),
                date: form.date.split('-').reverse().join('/') // Format to DD/MM/YYYY
            });
            setShowModal(false);
            setForm({ type: 'revenue', description: '', amount: '', date: new Date().toISOString().split('T')[0] });
            loadTransactions();
        } catch (err) {
            alert("Erro ao adicionar transação");
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Deseja realmente excluir esta transação?")) return;
        try {
            await deleteTransaction(id);
            loadTransactions();
        } catch (err) {
            alert("Erro ao excluir transação");
        }
    };

    const filteredTransactions = transactions.filter(t => {
        const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (t.orderId && t.orderId.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesType = typeFilter === 'all' || t.type === typeFilter;
        return matchesSearch && matchesType;
    });

    const totalRevenue = transactions.filter(t => t.type === 'revenue').reduce((acc, t) => acc + Number(t.amount), 0);
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);
    const balance = totalRevenue - totalExpenses;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-500 text-sm font-medium">Receitas</span>
                        <div className="p-2 bg-green-50 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-green-600" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-500 text-sm font-medium">Despesas</span>
                        <div className="p-2 bg-red-50 rounded-lg">
                            <TrendingDown className="w-5 h-5 text-red-600" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-500 text-sm font-medium">Saldo</span>
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <DollarSign className="w-5 h-5 text-blue-600" />
                        </div>
                    </div>
                    <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatCurrency(balance)}
                    </p>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex flex-1 gap-4 w-full">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Buscar por descrição ou pedido..." 
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select 
                        className="bg-gray-50 border-none rounded-xl text-sm px-4 py-2 focus:ring-2 focus:ring-primary/20"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value as any)}
                    >
                        <option value="all">Todos os Tipos</option>
                        <option value="revenue">Receitas</option>
                        <option value="expense">Despesas</option>
                    </select>
                </div>
                <button 
                    onClick={() => setShowModal(true)}
                    className="w-full md:w-auto flex items-center justify-center gap-2 bg-primary text-white px-6 py-2 rounded-xl font-medium hover:bg-primary/90 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nova Transação
                </button>
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Data</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Descrição</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Tipo</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Valor</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">Carregando...</td>
                                </tr>
                            ) : filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">Nenhuma transação encontrada.</td>
                                </tr>
                            ) : filteredTransactions.map((t) => (
                                <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{t.date}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-gray-900">{t.description}</span>
                                            {t.orderId && (
                                                <span className="text-xs text-primary font-medium">Pedido: #{t.orderId}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            t.type === 'revenue' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                            {t.type === 'revenue' ? 'Receita' : 'Despesa'}
                                        </span>
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${
                                        t.type === 'revenue' ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                        {t.type === 'revenue' ? '+' : '-'} {formatCurrency(t.amount)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        {!t.orderId && (
                                            <button 
                                                onClick={() => handleDelete(t.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* New Transaction Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900">Nova Transação</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <Plus className="w-6 h-6 rotate-45" />
                            </button>
                        </div>
                        <form onSubmit={handleAddTransaction} className="p-6 space-y-4">
                            <div className="flex p-1 bg-gray-100 rounded-xl">
                                <button 
                                    type="button"
                                    onClick={() => setForm(f => ({...f, type: 'revenue'}))}
                                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${form.type === 'revenue' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}
                                >
                                    Receita
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setForm(f => ({...f, type: 'expense'}))}
                                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${form.type === 'expense' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
                                >
                                    Despesa
                                </button>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Descrição</label>
                                <div className="relative">
                                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input 
                                        type="text" 
                                        required
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary/20"
                                        placeholder="Ex: Compra de tecidos, Venda avulsa..."
                                        value={form.description}
                                        onChange={(e) => setForm(f => ({...f, description: e.target.value}))}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Valor (R$)</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            required
                                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary/20"
                                            placeholder="0,00"
                                            value={form.amount}
                                            onChange={(e) => setForm(f => ({...f, amount: e.target.value}))}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Data</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input 
                                            type="date" 
                                            required
                                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary/20"
                                            value={form.date}
                                            onChange={(e) => setForm(f => ({...f, date: e.target.value}))}
                                        />
                                    </div>
                                </div>
                            </div>

                            <button 
                                type="submit"
                                className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all mt-4 active:scale-[0.98]"
                            >
                                Salvar Transação
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
