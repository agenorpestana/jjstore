
import React, { useState } from 'react';
import { CreditCard, LogOut, ShieldAlert, CheckCircle } from 'lucide-react';
import { Employee } from '../types';
import { createCheckoutSession } from '../services/mockData';

interface SubscriptionBlockProps {
  currentUser: Employee;
  onLogout: () => void;
}

export const SubscriptionBlock: React.FC<SubscriptionBlockProps> = ({ currentUser, onLogout }) => {
    const [loading, setLoading] = useState(false);

    const handlePay = async () => {
        if (!currentUser.companyId) return;
        setLoading(true);
        try {
            const url = await createCheckoutSession(currentUser.companyId);
            window.location.href = url; // Redirect to Mercado Pago
        } catch (e: any) {
            alert("Erro ao iniciar pagamento: " + e.message);
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white max-w-lg w-full rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-red-50 p-6 flex flex-col items-center border-b border-red-100">
                    <div className="bg-red-100 p-3 rounded-full mb-3">
                        <ShieldAlert className="text-red-600" size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-red-700">Acesso Bloqueado</h2>
                    <p className="text-red-600 mt-1 font-medium">Pagamento Pendente</p>
                </div>
                
                <div className="p-8 space-y-6">
                    <p className="text-gray-600 text-center leading-relaxed">
                        Olá, <strong>{currentUser.name}</strong>. O período de uso do seu plano expirou ou o pagamento não foi identificado.
                        Para continuar acessando o painel de pedidos, por favor regularize sua assinatura.
                    </p>

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Benefícios ao Regularizar:</h3>
                        <ul className="space-y-2 text-sm text-gray-600">
                            <li className="flex items-center gap-2"><CheckCircle size={16} className="text-green-500"/> Acesso imediato ao sistema</li>
                            <li className="flex items-center gap-2"><CheckCircle size={16} className="text-green-500"/> Manutenção de todos os dados</li>
                            <li className="flex items-center gap-2"><CheckCircle size={16} className="text-green-500"/> Suporte contínuo</li>
                        </ul>
                    </div>

                    <button 
                        onClick={handlePay}
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 transition transform hover:-translate-y-1 flex items-center justify-center gap-3"
                    >
                        {loading ? 'Processando...' : (
                            <>
                                <CreditCard size={20} />
                                Pagar Agora com Mercado Pago
                            </>
                        )}
                    </button>
                    
                    <button 
                        onClick={onLogout}
                        className="w-full text-gray-500 text-sm hover:text-gray-700 flex items-center justify-center gap-2"
                    >
                        <LogOut size={16} /> Sair do sistema
                    </button>
                </div>
            </div>
        </div>
    );
};
