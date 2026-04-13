
import React, { useState, useEffect } from 'react';
import { Printer, FileText, Calendar, Search, Download, Package, DollarSign, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Order, OrderStatus, FinancialAccount, Transaction } from '../types';
import { getAllOrders, getTransactions } from '../services/mockData';

const parseDateToComparable = (dateStr?: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('/')) {
        const [d, m, y] = dateStr.split('/');
        return `${y}-${m}-${d}`;
    }
    return dateStr || '';
};

export const ReportsModule: React.FC = () => {
    const [reportType, setReportType] = useState<'orders' | 'finance'>('orders');
    const [dateStart, setDateStart] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [dateEnd, setDateEnd] = useState(() => new Date().toISOString().split('T')[0]);
    
    // Orders Report State
    const [orders, setOrders] = useState<Order[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(false);
    
    // Finance Report State
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [ordersMap, setOrdersMap] = useState<Record<string, Order>>({});
    const [financeFilter, setFinanceFilter] = useState<'all' | 'paid' | 'receivable'>('all');
    const [loadingFinance, setLoadingFinance] = useState(false);

    const fetchOrdersReport = async () => {
        setLoadingOrders(true);
        try {
            const allOrders = await getAllOrders();
            // Filter by date and EXCLUDE quotes
            const filtered = allOrders.filter(o => {
                const isQuote = o.currentStatus === OrderStatus.ORCAMENTO;
                if (isQuote) return false;
                
                const orderDate = parseDateToComparable(o.orderDate);
                return orderDate >= dateStart && orderDate <= dateEnd;
            });
            setOrders(filtered);
        } catch (err) {
            console.error("Error fetching orders for report:", err);
        } finally {
            setLoadingOrders(false);
        }
    };

    const fetchFinanceReport = async () => {
        setLoadingFinance(true);
        try {
            const [trans, allOrders] = await Promise.all([
                getTransactions(dateStart, dateEnd),
                getAllOrders()
            ]);
            
            // Create map for easy lookup
            const map: Record<string, Order> = {};
            allOrders.forEach(o => { map[o.id] = o; });
            setOrdersMap(map);

            // Filter transactions: if linked to an order, it must NOT be a quote
            const filteredTrans = trans.filter(t => {
                if (t.orderId && map[t.orderId]) {
                    return map[t.orderId].currentStatus !== OrderStatus.ORCAMENTO;
                }
                return true; // Keep expenses or unlinked transactions
            });

            setTransactions(filteredTrans);
        } catch (err) {
            console.error("Error fetching finance report:", err);
        } finally {
            setLoadingFinance(false);
        }
    };

    useEffect(() => {
        if (reportType === 'orders') fetchOrdersReport();
        else fetchFinanceReport();
    }, [reportType, dateStart, dateEnd, financeFilter]);

    const handlePrint = () => {
        window.print();
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        if (dateStr.includes('/')) return dateStr;
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const [y, m, d] = parts;
            return `${d}/${m}/${y}`;
        }
        return dateStr;
    };

    return (
        <div className="space-y-6">
            {/* Header & Type Selector */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm no-print">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setReportType('orders')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${reportType === 'orders' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Relatório de Pedidos
                    </button>
                    <button 
                        onClick={() => setReportType('finance')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${reportType === 'finance' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Relatório Financeiro
                    </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                        <Calendar size={16} className="text-gray-400" />
                        <input 
                            type="date" 
                            className="bg-transparent border-none text-sm focus:ring-0 p-0"
                            value={dateStart}
                            onChange={e => setDateStart(e.target.value)}
                        />
                        <span className="text-gray-400">até</span>
                        <input 
                            type="date" 
                            className="bg-transparent border-none text-sm focus:ring-0 p-0"
                            value={dateEnd}
                            onChange={e => setDateEnd(e.target.value)}
                        />
                    </div>
                    
                    <button 
                        onClick={handlePrint}
                        className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm"
                    >
                        <Printer size={18} /> Imprimir / PDF
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:border-none print:shadow-none print-section">
                {reportType === 'orders' ? (
                    <div className="p-6">
                        <div className="mb-6 flex justify-between items-end">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Relatório de Pedidos por Período</h2>
                                <p className="text-sm text-gray-500">Período: {formatDate(dateStart)} a {formatDate(dateEnd)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-medium text-gray-600">Total de Pedidos: {orders.length}</p>
                                <p className="text-sm font-medium text-gray-600">Total em Peças: {orders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.quantity, 0), 0)}</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Cliente / Tel</th>
                                        <th className="px-2 py-2 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider">Peças</th>
                                        <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Datas (Ped/Ent)</th>
                                        <th className="px-2 py-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Valor Pago</th>
                                        <th className="px-2 py-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Restante</th>
                                        <th className="px-2 py-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {loadingOrders ? (
                                        <tr><td colSpan={6} className="p-4 text-center text-gray-400 text-xs">Carregando...</td></tr>
                                    ) : orders.length === 0 ? (
                                        <tr><td colSpan={6} className="p-4 text-center text-gray-400 text-xs">Nenhum pedido encontrado no período.</td></tr>
                                    ) : (
                                        orders.map(order => (
                                            <tr key={order.id} className="hover:bg-gray-50 transition">
                                                <td className="px-2 py-2">
                                                    <div className="text-xs font-bold text-gray-900 leading-tight">{order.customerName}</div>
                                                    <div className="text-[10px] text-gray-500">{order.customerPhone}</div>
                                                </td>
                                                <td className="px-2 py-2 text-center text-xs text-gray-600">
                                                    {order.items.reduce((acc, i) => acc + i.quantity, 0)}
                                                </td>
                                                <td className="px-2 py-2">
                                                    <div className="text-[10px] text-gray-600 leading-tight">P: {formatDate(order.orderDate)}</div>
                                                    <div className="text-[10px] text-blue-600 font-medium leading-tight">E: {formatDate(order.estimatedDelivery)}</div>
                                                </td>
                                                <td className="px-2 py-2 text-right text-xs text-green-600 font-bold">
                                                    {formatCurrency(order.downPayment)}
                                                </td>
                                                <td className="px-2 py-2 text-right text-xs text-red-600 font-bold">
                                                    {formatCurrency(order.total - order.downPayment)}
                                                </td>
                                                <td className="px-2 py-2 text-right text-xs font-black text-gray-900">
                                                    {formatCurrency(order.total)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                <tfoot className="bg-gray-50 font-bold">
                                    <tr>
                                        <td className="px-2 py-2 text-xs text-gray-900">TOTAIS</td>
                                        <td className="px-2 py-2 text-center text-xs text-gray-900">
                                            {orders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.quantity, 0), 0)}
                                        </td>
                                        <td></td>
                                        <td className="px-2 py-2 text-right text-xs text-green-700">
                                            {formatCurrency(orders.reduce((acc, o) => acc + o.downPayment, 0))}
                                        </td>
                                        <td className="px-2 py-2 text-right text-xs text-red-700">
                                            {formatCurrency(orders.reduce((acc, o) => acc + (o.total - o.downPayment), 0))}
                                        </td>
                                        <td className="px-2 py-2 text-right text-xs text-gray-900">
                                            {formatCurrency(orders.reduce((acc, o) => acc + o.total, 0))}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="p-6">
                        <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Relatório Financeiro</h2>
                                <p className="text-sm text-gray-500">Período: {formatDate(dateStart)} a {formatDate(dateEnd)}</p>
                            </div>
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button 
                                    onClick={() => setFinanceFilter('all')}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${financeFilter === 'all' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Todos
                                </button>
                                <button 
                                    onClick={() => setFinanceFilter('paid')}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${financeFilter === 'paid' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Pagos (Receitas)
                                </button>
                                <button 
                                    onClick={() => setFinanceFilter('receivable')}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${financeFilter === 'receivable' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    A Receber
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Data</th>
                                        <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Pedido #</th>
                                        <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nome / Contato</th>
                                        <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tipo / Status</th>
                                        <th className="px-2 py-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {loadingFinance ? (
                                        <tr><td colSpan={5} className="p-4 text-center text-gray-400 text-xs">Carregando...</td></tr>
                                    ) : (
                                        <>
                                            {/* Render Transactions (Pagos/Despesas) */}
                                            {(financeFilter === 'all' || financeFilter === 'paid') && transactions.map(t => {
                                                const linkedOrder = t.orderId ? ordersMap[t.orderId] : null;
                                                return (
                                                    <tr key={t.id} className="hover:bg-gray-50 transition">
                                                        <td className="px-2 py-2 text-xs text-gray-600">{t.date}</td>
                                                        <td className="px-2 py-2 text-xs text-gray-600">
                                                            {t.orderId ? `#${t.orderId}` : '-'}
                                                        </td>
                                                        <td className="px-2 py-2">
                                                            {linkedOrder ? (
                                                                <div>
                                                                    <div className="text-xs font-bold text-gray-900 leading-tight">{linkedOrder.customerName}</div>
                                                                    <div className="text-[10px] text-gray-500 font-normal">{linkedOrder.customerPhone}</div>
                                                                </div>
                                                            ) : <div className="text-xs font-medium text-gray-900">{t.description}</div>}
                                                        </td>
                                                        <td className="px-2 py-2">
                                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${t.type === 'revenue' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                {t.type === 'revenue' ? <ArrowUpRight size={10} /> : <ArrowDownLeft size={10} />}
                                                                {t.type === 'revenue' ? 'Receita' : 'Despesa'}
                                                            </span>
                                                        </td>
                                                        <td className={`px-2 py-2 text-right text-xs font-bold ${t.type === 'revenue' ? 'text-green-600' : 'text-red-600'}`}>
                                                            {t.type === 'revenue' ? '+' : '-'}{formatCurrency(t.amount)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}

                                            {/* Render Receivables (A Receber) */}
                                            {(financeFilter === 'all' || financeFilter === 'receivable') && (
                                                <ReceivablesList dateStart={dateStart} dateEnd={dateEnd} formatCurrency={formatCurrency} formatDate={formatDate} />
                                            )}
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Print Styles */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page {
                        margin: 1cm;
                        size: portrait;
                    }
                    body {
                        background: white !important;
                        color: black !important;
                    }
                    .no-print { 
                        display: none !important; 
                    }
                    .print-section { 
                        display: block !important;
                        position: static !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                    }
                    /* Reset container constraints for print */
                    .max-w-7xl, .mx-auto, .px-4, .sm\\:px-6, .lg\\:px-8, .py-8 {
                        max-width: none !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                    }
                    th, td {
                        border-bottom: 1px solid #eee !important;
                    }
                    .bg-gray-50 { background-color: #f9fafb !important; }
                    .text-primary { color: #2563eb !important; }
                    .text-green-600 { color: #16a34a !important; }
                    .text-red-600 { color: #dc2626 !important; }
                }
            `}} />
        </div>
    );
};

const ReceivablesList: React.FC<{ dateStart: string, dateEnd: string, formatCurrency: (v: number) => string, formatDate: (d: string) => string }> = ({ dateStart, dateEnd, formatCurrency, formatDate }) => {
    const [receivables, setReceivables] = useState<Order[]>([]);

    useEffect(() => {
        const fetch = async () => {
            const all = await getAllOrders();
            const filtered = all.filter(o => {
                const isQuote = o.currentStatus === OrderStatus.ORCAMENTO;
                if (isQuote) return false;

                const balance = o.total - o.downPayment;
                // Filter by delivery date for receivables
                const compareDate = parseDateToComparable(o.estimatedDelivery); 
                return balance > 0 && compareDate >= dateStart && compareDate <= dateEnd;
            });
            setReceivables(filtered);
        };
        fetch();
    }, [dateStart, dateEnd]);

    return (
        <>
            {receivables.map(o => (
                <tr key={`rec-${o.id}`} className="hover:bg-gray-50 transition bg-blue-50/30">
                    <td className="px-2 py-2 text-xs text-gray-600">{formatDate(o.estimatedDelivery)}</td>
                    <td className="px-2 py-2 text-xs text-gray-600">#{o.id}</td>
                    <td className="px-2 py-2">
                        <div className="text-xs font-bold text-gray-900 leading-tight">{o.customerName}</div>
                        <div className="text-[10px] text-gray-500 font-normal">{o.customerPhone}</div>
                    </td>
                    <td className="px-2 py-2">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                            <DollarSign size={10} />
                            A Receber
                        </span>
                    </td>
                    <td className="px-2 py-2 text-right text-xs font-bold text-blue-600">
                        {formatCurrency(o.total - o.downPayment)}
                    </td>
                </tr>
            ))}
        </>
    );
};
