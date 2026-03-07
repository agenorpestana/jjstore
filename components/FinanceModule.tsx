
import React, { useEffect, useState } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign, Calendar, FileText, Search, Filter, Edit2, X, Wallet, ArrowRightLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { Transaction, FinancialAccount } from '../types';
import { getTransactions, createTransaction, deleteTransaction, updateTransaction, getAccounts, createAccount, deleteAccount, updateAccount, transferBetweenAccounts } from '../services/mockData';

export const FinanceModule: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'transactions' | 'accounts'>('transactions');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'revenue' | 'expense'>('all');
    const [accountFilter, setAccountFilter] = useState<string>('all');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Date Range State
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });

    const [form, setForm] = useState({
        type: 'revenue' as 'revenue' | 'expense',
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'Pix',
        accountId: ''
    });

    const [accountForm, setAccountForm] = useState({
        name: '',
        balance: '',
        active: true
    });

    const [transferForm, setTransferForm] = useState({
        fromAccountId: '',
        toAccountId: '',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0]
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const [transData, accData] = await Promise.all([
                getTransactions(startDate, endDate, accountFilter),
                getAccounts()
            ]);
            setTransactions(transData);
            setAccounts(accData);
            
            // Set default account in form if not set
            if (accData.length > 0 && !form.accountId) {
                const defaultAcc = accData.find(a => a.is_default) || accData[0];
                setForm(prev => ({ ...prev, accountId: defaultAcc.id }));
            }
        } catch (err) {
            console.error("Error loading finance data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [startDate, endDate, accountFilter]);

    const handleOpenModal = (transaction?: Transaction) => {
        if (transaction) {
            setEditingTransaction(transaction);
            const [d, m, y] = transaction.date.split('/');
            setForm({
                type: transaction.type,
                description: transaction.description,
                amount: transaction.amount.toString(),
                date: `${y}-${m}-${d}`,
                paymentMethod: transaction.paymentMethod || 'Pix',
                accountId: transaction.accountId || ''
            });
        } else {
            setEditingTransaction(null);
            const defaultAcc = accounts.find(a => a.is_default) || accounts[0];
            setForm({ 
                type: 'revenue', 
                description: '', 
                amount: '', 
                date: new Date().toISOString().split('T')[0],
                paymentMethod: 'Pix',
                accountId: defaultAcc?.id || ''
            });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.description || !form.amount || !form.date || !form.accountId) return;

        try {
            const transactionData = {
                type: form.type,
                description: form.description,
                amount: Number(form.amount),
                date: form.date.split('-').reverse().join('/'),
                paymentMethod: form.paymentMethod,
                accountId: form.accountId
            };

            if (editingTransaction) {
                await updateTransaction(editingTransaction.id, transactionData);
            } else {
                await createTransaction(transactionData);
            }
            
            setShowModal(false);
            loadData();
        } catch (err: any) {
            alert("Erro ao salvar transação: " + (err.message || "Erro desconhecido"));
        }
    };

    const handleOpenAccountModal = (account?: FinancialAccount) => {
        if (account) {
            setEditingAccount(account);
            setAccountForm({
                name: account.name,
                balance: account.balance.toString(),
                active: account.active
            });
        } else {
            setEditingAccount(null);
            setAccountForm({
                name: '',
                balance: '',
                active: true
            });
        }
        setShowAccountModal(true);
    };

    const handleCreateAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!accountForm.name) return;
        try {
            if (editingAccount) {
                await updateAccount(editingAccount.id, {
                    name: accountForm.name,
                    balance: Number(accountForm.balance) || 0,
                    active: accountForm.active
                });
            } else {
                await createAccount(accountForm.name, Number(accountForm.balance) || 0);
            }
            setShowAccountModal(false);
            setAccountForm({ name: '', balance: '', active: true });
            loadData();
        } catch (err: any) {
            alert("Erro ao salvar conta: " + (err.message || "Erro desconhecido"));
        }
    };

    const handleTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!transferForm.fromAccountId || !transferForm.toAccountId || !transferForm.amount) return;
        if (transferForm.fromAccountId === transferForm.toAccountId) {
            alert("Selecione contas diferentes para transferência");
            return;
        }
        try {
            await transferBetweenAccounts({
                ...transferForm,
                amount: Number(transferForm.amount),
                date: transferForm.date.split('-').reverse().join('/')
            });
            setShowTransferModal(false);
            setTransferForm({ fromAccountId: '', toAccountId: '', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
            loadData();
        } catch (err) {
            alert("Erro ao realizar transferência");
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Deseja realmente excluir esta transação?")) return;
        try {
            await deleteTransaction(id);
            loadData();
        } catch (err) {
            alert("Erro ao excluir transação");
        }
    };

    const handleDeleteAccount = async (id: string) => {
        const acc = accounts.find(a => a.id === id);
        if (acc?.is_default) {
            alert("A conta padrão não pode ser excluída.");
            return;
        }
        if (!window.confirm("Deseja realmente excluir esta conta?")) return;
        try {
            await deleteAccount(id);
            loadData();
        } catch (err: any) {
            alert(err.message || "Erro ao excluir conta. Se ela possui movimentações, você deve apenas inativá-la.");
        }
    };

    const filteredTransactions = React.useMemo(() => {
        return transactions.filter(t => {
            const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                   (t.orderId && t.orderId.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesType = typeFilter === 'all' || t.type === typeFilter;
            return matchesSearch && matchesType;
        });
    }, [transactions, searchTerm, typeFilter]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
    const paginatedTransactions = React.useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredTransactions.slice(start, start + itemsPerPage);
    }, [filteredTransactions, currentPage]);

    const totalRevenue = React.useMemo(() => 
        transactions.filter(t => t.type === 'revenue').reduce((acc, t) => acc + Number(t.amount), 0)
    , [transactions]);

    const totalExpenses = React.useMemo(() => 
        transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0)
    , [transactions]);
    
    const balance = totalRevenue - totalExpenses;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl w-fit">
                <button
                    onClick={() => setActiveTab('transactions')}
                    className={`px-6 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'transactions' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Transações
                </button>
                <button
                    onClick={() => setActiveTab('accounts')}
                    className={`px-6 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'accounts' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Contas Bancárias
                </button>
            </div>

            {activeTab === 'transactions' ? (
                <>
                    {/* Date Range Picker & Account Filter */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-600">Período:</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="date" 
                                className="bg-gray-50 border-none rounded-xl text-sm px-3 py-2 focus:ring-2 focus:ring-primary/20"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                            <span className="text-gray-400">até</span>
                            <input 
                                type="date" 
                                className="bg-gray-50 border-none rounded-xl text-sm px-3 py-2 focus:ring-2 focus:ring-primary/20"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                        
                        <div className="h-6 w-px bg-gray-100 mx-2 hidden md:block" />
                        
                        <div className="flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-600">Conta:</span>
                            <select
                                value={accountFilter}
                                onChange={(e) => setAccountFilter(e.target.value)}
                                className="bg-gray-50 border-none rounded-xl text-sm px-3 py-2 focus:ring-2 focus:ring-primary/20"
                            >
                                <option value="all">Todas as Contas</option>
                                {accounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name} {!acc.active && '(Inativa)'}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-green-50 rounded-2xl">
                                    <TrendingUp className="w-6 h-6 text-green-600" />
                                </div>
                                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">Receitas</span>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</h3>
                            <p className="text-sm text-gray-500 mt-1">Total recebido no período</p>
                        </div>

                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-red-50 rounded-2xl">
                                    <TrendingDown className="w-6 h-6 text-red-600" />
                                </div>
                                <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">Despesas</span>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(totalExpenses)}</h3>
                            <p className="text-sm text-gray-500 mt-1">Total gasto no período</p>
                        </div>

                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-blue-50 rounded-2xl">
                                    <DollarSign className="w-6 h-6 text-blue-600" />
                                </div>
                                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Saldo</span>
                            </div>
                            <h3 className={`text-2xl font-bold ${balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                                {formatCurrency(balance)}
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">Resultado líquido</p>
                        </div>
                    </div>

                    {/* Actions & Search */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => handleOpenModal()}
                                className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                            >
                                <Plus size={20} />
                                Nova Transação
                            </button>
                            <button 
                                onClick={() => setShowTransferModal(true)}
                                className="flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-6 py-3 rounded-2xl font-medium hover:bg-gray-50 transition-all"
                            >
                                <ArrowRightLeft size={20} />
                                Transferir
                            </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="Buscar transação..."
                                    className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex bg-white border border-gray-200 rounded-2xl p-1">
                                <button 
                                    onClick={() => setTypeFilter('all')}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${typeFilter === 'all' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                                >
                                    Todas
                                </button>
                                <button 
                                    onClick={() => setTypeFilter('revenue')}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${typeFilter === 'revenue' ? 'bg-green-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                                >
                                    Receitas
                                </button>
                                <button 
                                    onClick={() => setTypeFilter('expense')}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${typeFilter === 'expense' ? 'bg-red-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                                >
                                    Despesas
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Transactions Table */}
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Data</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Descrição</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Conta</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Método</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Valor</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500">Carregando transações...</td>
                                        </tr>
                                    ) : paginatedTransactions.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500">Nenhuma transação encontrada.</td>
                                        </tr>
                                    ) : (
                                        paginatedTransactions.map((t) => (
                                            <tr key={t.id} className="hover:bg-gray-50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar size={14} className="text-gray-400" />
                                                        <span className="text-sm text-gray-600">{t.date}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-gray-900">{t.description}</span>
                                                        {t.orderId && (
                                                            <span className="text-xs text-primary font-medium">Pedido #{t.orderId}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-sm text-gray-600">{t.accountName || 'Não vinculada'}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                                                        {t.paymentMethod}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={`text-sm font-bold ${t.type === 'revenue' ? 'text-green-600' : 'text-red-600'}`}>
                                                        {t.type === 'revenue' ? '+' : '-'} {formatCurrency(t.amount)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => handleOpenModal(t)}
                                                            className="p-2 text-gray-400 hover:text-primary hover:bg-blue-50 rounded-xl transition-all"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(t.id)}
                                                            disabled={!!t.orderId}
                                                            className={`p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all ${t.orderId ? 'opacity-30 cursor-not-allowed' : ''}`}
                                                            title={t.orderId ? "Pagamentos de pedidos devem ser excluídos no histórico do pedido" : "Excluir transação"}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        
                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                                <span className="text-sm text-gray-500">
                                    Mostrando {Math.min(filteredTransactions.length, (currentPage - 1) * itemsPerPage + 1)} a {Math.min(filteredTransactions.length, currentPage * itemsPerPage)} de {filteredTransactions.length} transações
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-all"
                                    >
                                        <ChevronLeft size={18} />
                                    </button>
                                    {[...Array(totalPages)].map((_, i) => (
                                        <button
                                            key={i + 1}
                                            onClick={() => setCurrentPage(i + 1)}
                                            className={`w-10 h-10 rounded-xl text-sm font-medium transition-all ${currentPage === i + 1 ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-all"
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                /* Accounts Tab Content */
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-gray-900">Gerenciar Contas</h2>
                        <button 
                            onClick={() => handleOpenAccountModal()}
                            className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                        >
                            <Plus size={20} />
                            Nova Conta
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {accounts.map(acc => (
                            <div key={acc.id} className={`bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative group transition-all ${!acc.active ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`p-3 rounded-2xl ${acc.active ? 'bg-blue-50' : 'bg-gray-100'}`}>
                                        <Wallet className={`w-6 h-6 ${acc.active ? 'text-blue-600' : 'text-gray-400'}`} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!acc.active && (
                                            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Inativa</span>
                                        )}
                                        {acc.is_default && (
                                            <span className="text-[10px] uppercase tracking-wider font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Padrão</span>
                                        )}
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold text-gray-900">{acc.name}</h3>
                                <div className="mt-4">
                                    <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Saldo Atual</span>
                                    <p className={`text-2xl font-bold ${acc.balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                                        {formatCurrency(acc.balance)}
                                    </p>
                                </div>
                                
                                <div className="absolute top-6 right-6 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                    <button 
                                        onClick={() => handleOpenAccountModal(acc)}
                                        className="p-2 text-gray-400 hover:text-primary hover:bg-blue-50 rounded-xl transition-all"
                                        title="Editar conta"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    {!acc.is_default && (
                                        <button 
                                            onClick={() => handleDeleteAccount(acc.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                            title="Excluir conta"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Transaction Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h3 className="text-xl font-bold text-gray-900">
                                {editingTransaction ? 'Editar Transação' : 'Nova Transação'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white rounded-xl transition-all">
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                    <div className="flex bg-gray-100 p-1 rounded-2xl">
                                         <button
                                             type="button"
                                             disabled={!!editingTransaction?.orderId}
                                             onClick={() => setForm({ ...form, type: 'revenue' })}
                                             className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${form.type === 'revenue' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'} ${editingTransaction?.orderId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                         >
                                             Receita
                                         </button>
                                         <button
                                             type="button"
                                             disabled={!!editingTransaction?.orderId}
                                             onClick={() => setForm({ ...form, type: 'expense' })}
                                             className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${form.type === 'expense' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'} ${editingTransaction?.orderId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                         >
                                             Despesa
                                         </button>
                                     </div>

                                     <div className="space-y-1">
                                         <label className="text-sm font-medium text-gray-700 ml-1">Descrição</label>
                                         <input
                                             type="text"
                                             required
                                             disabled={!!editingTransaction?.orderId}
                                             className={`w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all ${editingTransaction?.orderId ? 'opacity-70 cursor-not-allowed' : ''}`}
                                             placeholder="Ex: Aluguel, Venda de Camisetas..."
                                             value={form.description}
                                             onChange={e => setForm({ ...form, description: e.target.value })}
                                         />
                                         {editingTransaction?.orderId && (
                                             <p className="text-[10px] text-amber-600 font-medium ml-1">Vínculo com pedido: descrição não editável.</p>
                                         )}
                                     </div>

                                     <div className="grid grid-cols-2 gap-4">
                                         <div className="space-y-1">
                                             <label className="text-sm font-medium text-gray-700 ml-1">Valor</label>
                                             <div className="relative">
                                                 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                                                 <input
                                                     type="number"
                                                     step="0.01"
                                                     required
                                                     disabled={!!editingTransaction?.orderId}
                                                     className={`w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all ${editingTransaction?.orderId ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                     value={form.amount}
                                                     onChange={e => setForm({ ...form, amount: e.target.value })}
                                                 />
                                             </div>
                                         </div>
                                         <div className="space-y-1">
                                             <label className="text-sm font-medium text-gray-700 ml-1">Data</label>
                                             <input
                                                 type="date"
                                                 required
                                                 disabled={!!editingTransaction?.orderId}
                                                 className={`w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all ${editingTransaction?.orderId ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                 value={form.date}
                                                 onChange={e => setForm({ ...form, date: e.target.value })}
                                             />
                                         </div>
                                     </div>

                                     <div className="grid grid-cols-2 gap-4">
                                         <div className="space-y-1">
                                             <label className="text-sm font-medium text-gray-700 ml-1">Conta</label>
                                             <select
                                                 required
                                                 className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all"
                                                 value={form.accountId}
                                                 onChange={e => setForm({ ...form, accountId: e.target.value })}
                                             >
                                                 <option value="">Selecione...</option>
                                                 {accounts.filter(acc => acc.active || acc.id === form.accountId).map(acc => (
                                                     <option key={acc.id} value={acc.id}>{acc.name} {!acc.active && '(Inativa)'}</option>
                                                 ))}
                                             </select>
                                         </div>
                                         <div className="space-y-1">
                                             <label className="text-sm font-medium text-gray-700 ml-1">Método</label>
                                             <select
                                                 disabled={!!editingTransaction?.orderId}
                                                 className={`w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all ${editingTransaction?.orderId ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                 value={form.paymentMethod}
                                                 onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                                             >
                                                 <option value="Pix">Pix</option>
                                                 <option value="Dinheiro">Dinheiro</option>
                                                 <option value="Cartão de Crédito">Cartão de Crédito</option>
                                                 <option value="Cartão de Débito">Cartão de Débito</option>
                                                 <option value="Transferência">Transferência</option>
                                             </select>
                                         </div>
                                     </div>

                            <button
                                type="submit"
                                className="w-full bg-primary text-white py-4 rounded-2xl font-bold mt-4 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                            >
                                {editingTransaction ? 'Salvar Alterações' : 'Confirmar Transação'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Account Modal */}
            {showAccountModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-gray-900">
                                {editingAccount ? 'Editar Conta Bancária' : 'Nova Conta Bancária'}
                            </h3>
                            <button onClick={() => setShowAccountModal(false)} className="p-2 hover:bg-gray-50 rounded-xl transition-all">
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateAccount} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700 ml-1">Nome da Conta</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all"
                                    placeholder="Ex: Banco do Brasil, Cofre, Nubank..."
                                    value={accountForm.name}
                                    onChange={e => setAccountForm({ ...accountForm, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700 ml-1">Saldo {editingAccount ? 'Atual' : 'Inicial'}</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all"
                                        value={accountForm.balance}
                                        onChange={e => setAccountForm({ ...accountForm, balance: e.target.value })}
                                    />
                                </div>
                            </div>

                            {editingAccount && !editingAccount.is_default && (
                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-gray-900">Status da Conta</span>
                                        <span className="text-xs text-gray-500">Contas inativas não aparecem em novos lançamentos</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setAccountForm({ ...accountForm, active: !accountForm.active })}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${accountForm.active ? 'bg-green-500' : 'bg-gray-300'}`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${accountForm.active ? 'translate-x-6' : 'translate-x-1'}`}
                                        />
                                    </button>
                                </div>
                            )}

                            <button
                                type="submit"
                                className="w-full bg-primary text-white py-4 rounded-2xl font-bold mt-4 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                            >
                                {editingAccount ? 'Salvar Alterações' : 'Criar Conta'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Transfer Modal */}
            {showTransferModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-gray-900">Transferir entre Contas</h3>
                            <button onClick={() => setShowTransferModal(false)} className="p-2 hover:bg-gray-50 rounded-xl transition-all">
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>
                        <form onSubmit={handleTransfer} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Origem</label>
                                    <select
                                        required
                                        className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                                        value={transferForm.fromAccountId}
                                        onChange={e => setTransferForm({ ...transferForm, fromAccountId: e.target.value })}
                                    >
                                        <option value="">Selecione...</option>
                                        {accounts.filter(acc => acc.active || acc.id === transferForm.fromAccountId).map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance)}) {!acc.active && '(Inativa)'}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Destino</label>
                                    <select
                                        required
                                        className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                                        value={transferForm.toAccountId}
                                        onChange={e => setTransferForm({ ...transferForm, toAccountId: e.target.value })}
                                    >
                                        <option value="">Selecione...</option>
                                        {accounts.filter(acc => acc.active || acc.id === transferForm.toAccountId).map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.name} {!acc.active && '(Inativa)'}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Valor</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all"
                                            value={transferForm.amount}
                                            onChange={e => setTransferForm({ ...transferForm, amount: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Data</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all"
                                        value={transferForm.date}
                                        onChange={e => setTransferForm({ ...transferForm, date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700 ml-1">Observação</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all"
                                    placeholder="Ex: Depósito em dinheiro, Ajuste de saldo..."
                                    value={transferForm.description}
                                    onChange={e => setTransferForm({ ...transferForm, description: e.target.value })}
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-primary text-white py-4 rounded-2xl font-bold mt-4 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                            >
                                Confirmar Transferência
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
