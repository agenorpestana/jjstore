
import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Package, TrendingUp, Calendar, CheckCircle, Clock, DollarSign, ArrowUpRight, ArrowDownRight, Wallet } from 'lucide-react';
import { DashboardData, OrderStatus } from '../types';
import { getDashboardData } from '../services/mockData';

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const Dashboard: React.FC = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const result = await getDashboardData();
                setData(result);
            } catch (err) {
                console.error("Error loading dashboard data:", err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!data) return null;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const statusMap: Record<string, { label: string, color: string, icon: any }> = {
        [OrderStatus.PEDIDO_FEITO]: { label: 'Feito', color: 'bg-blue-100 text-blue-700', icon: Package },
        [OrderStatus.EM_PRODUCAO]: { label: 'Em Produção', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
        [OrderStatus.CONCLUIDO]: { label: 'Concluído', color: 'bg-green-100 text-green-700', icon: CheckCircle },
        [OrderStatus.CANCELADO]: { label: 'Cancelado', color: 'bg-red-100 text-red-700', icon: TrendingUp },
        [OrderStatus.ORCAMENTO]: { label: 'Orçamento', color: 'bg-gray-100 text-gray-700', icon: TrendingUp },
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Production Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <Calendar className="w-6 h-6 text-blue-600" />
                        </div>
                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Este Mês</span>
                    </div>
                    <h3 className="text-gray-500 text-sm font-medium">Pedidos no Mês</h3>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{data.ordersPerMonth}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-green-50 rounded-lg">
                            <TrendingUp className="w-6 h-6 text-green-600" />
                        </div>
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">Hoje</span>
                    </div>
                    <h3 className="text-gray-500 text-sm font-medium">Pedidos Hoje</h3>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{data.ordersPerDay}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-purple-50 rounded-lg">
                            <Clock className="w-6 h-6 text-purple-600" />
                        </div>
                    </div>
                    <h3 className="text-gray-500 text-sm font-medium">Em Produção</h3>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{data.statusCounts[OrderStatus.EM_PRODUCAO] || 0}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-emerald-50 rounded-lg">
                            <CheckCircle className="w-6 h-6 text-emerald-600" />
                        </div>
                    </div>
                    <h3 className="text-gray-500 text-sm font-medium">Concluídos</h3>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{data.statusCounts[OrderStatus.CONCLUIDO] || 0}</p>
                </div>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <ArrowUpRight className="w-12 h-12 text-green-600" />
                        </div>
                        <h3 className="text-gray-500 text-sm font-medium">Receita Total</h3>
                        <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(data.finance.totalRevenue)}</p>
                        <div className="mt-4 flex items-center text-xs text-green-600">
                            <DollarSign className="w-3 h-3 mr-1" />
                            <span>Entradas confirmadas</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <ArrowDownRight className="w-12 h-12 text-red-600" />
                        </div>
                        <h3 className="text-gray-500 text-sm font-medium">Despesas Totais</h3>
                        <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(data.finance.totalExpenses)}</p>
                        <div className="mt-4 flex items-center text-xs text-red-600">
                            <Wallet className="w-3 h-3 mr-1" />
                            <span>Saídas registradas</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Clock className="w-12 h-12 text-blue-600" />
                        </div>
                        <h3 className="text-gray-500 text-sm font-medium">A Receber</h3>
                        <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(data.finance.totalReceivable)}</p>
                        <div className="mt-4 flex items-center text-xs text-blue-600">
                            <Package className="w-3 h-3 mr-1" />
                            <span>Saldos de pedidos ativos</span>
                        </div>
                    </div>

                    {/* Status Summary List */}
                    <div className="md:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-gray-900 font-semibold mb-4">Resumo por Status</h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {Object.entries(statusMap).map(([status, config]) => (
                                <div key={status} className={`p-4 rounded-xl ${config.color} flex flex-col items-center justify-center text-center`}>
                                    <config.icon className="w-5 h-5 mb-2" />
                                    <span className="text-xs font-bold uppercase tracking-wider">{config.label}</span>
                                    <span className="text-lg font-black mt-1">{data.statusCounts[status as OrderStatus] || 0}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Pie Chart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                    <h3 className="text-gray-900 font-semibold mb-4">Formas de Pagamento</h3>
                    <div className="flex-1 min-h-[300px]">
                        {data.finance.paymentMethods.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data.finance.paymentMethods}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {data.finance.paymentMethods.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        formatter={(value: number) => formatCurrency(value)}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36}/>
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <DollarSign className="w-12 h-12 mb-2 opacity-20" />
                                <p className="text-sm">Nenhum pagamento registrado</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
