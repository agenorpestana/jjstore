
import React, { useState } from 'react';
import { Order, AppSettings } from '../types';
import { MapPin, Calendar, CreditCard, Camera, X, ShoppingCart, Building } from 'lucide-react';

interface OrderDetailsProps {
  order: Order;
  appSettings: AppSettings;
}

export const OrderDetails: React.FC<OrderDetailsProps> = ({ order, appSettings }) => {
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const remainingBalance = order.total - (order.downPayment || 0);

  const getSizeSummary = () => {
      const summary: Record<string, number> = {};
      let totalItems = 0;

      order.items.forEach(item => {
          const size = item.size ? item.size.toUpperCase().trim() : 'UN';
          summary[size] = (summary[size] || 0) + item.quantity;
          totalItems += item.quantity;
      });

      return { summary, totalItems };
  };

  const { summary, totalItems } = getSizeSummary();

  const formatDatePTBR = (dateStr?: string) => {
      if (!dateStr) return '';
      
      // 1. Prioridade: Se for formato YYYY-MM-DD (padrão do input date), faz split manual
      // Isso evita problemas de Timezone (ex: 01/02 virar 31/01 21:00)
      if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const [y, m, d] = dateStr.split('-');
          return `${d}/${m}/${y}`;
      }

      try {
          // If already in PT-BR format or simple string with slash
          if (dateStr.includes('/')) return dateStr;
          
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
              return date.toLocaleDateString('pt-BR');
          }
      } catch (e) { }
      return dateStr;
  }

  return (
    <div className="space-y-6">
      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Address */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4">
            <div className="bg-blue-50 p-3 rounded-lg text-primary">
                <MapPin size={24} />
            </div>
            <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Entrega para</h4>
                <p className="text-gray-800 font-medium">{order.customerName}</p>
                <p className="text-gray-600 text-sm mt-1">{order.shippingAddress}</p>
                {order.customerPhone && (
                   <p className="text-gray-400 text-xs mt-1">{order.customerPhone}</p>
                )}
            </div>
        </div>

        {/* Dates */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4">
            <div className="bg-purple-50 p-3 rounded-lg text-purple-600">
                <Calendar size={24} />
            </div>
            <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Datas</h4>
                <div className="flex flex-col gap-1">
                    <p className="text-gray-600 text-sm">Pedido: <span className="text-gray-800 font-medium">{order.orderDate}</span></p>
                    <p className="text-gray-600 text-sm">Entrega: <span className="text-gray-800 font-medium">{order.estimatedDelivery}</span></p>
                    {order.printingDate && (
                        <p className="text-gray-600 text-sm">Impressão: <span className="text-gray-800 font-medium">{formatDatePTBR(order.printingDate)}</span></p>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* Photos Section */}
      {order.photos && order.photos.length > 0 && (
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
             <div className="flex items-center gap-3 mb-4">
                 <div className="bg-orange-50 p-2 rounded-lg text-orange-600">
                     <Camera size={20} />
                 </div>
                 <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Fotos do Pedido</h4>
             </div>
             <div className="grid grid-cols-3 gap-3">
                 {order.photos.map((photo, idx) => (
                     <div 
                        key={idx} 
                        className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:opacity-90 transition"
                        onClick={() => setExpandedImage(photo)}
                     >
                         <img src={photo} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                     </div>
                 ))}
             </div>
          </div>
      )}

      {/* Financial Summary */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
         <div className="flex items-center gap-3 mb-4">
             <div className="bg-green-50 p-2 rounded-lg text-green-600">
                 <CreditCard size={20} />
             </div>
             <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Informações de Pagamento</h4>
         </div>
         
         <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
             <div className="flex justify-between">
                 <span className="text-gray-600">Forma de Pagamento</span>
                 <span className="text-gray-900 font-medium">{order.paymentMethod || 'Não informada'}</span>
             </div>
             <div className="border-t border-gray-200 my-2"></div>
             <div className="flex justify-between">
                 <span className="text-gray-600">Valor Total do Pedido</span>
                 <span className="text-gray-900 font-bold">
                     {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}
                 </span>
             </div>
             <div className="flex justify-between text-green-600">
                 <span>Entrada / Pago</span>
                 <span className="font-medium">
                     - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.downPayment || 0)}
                 </span>
             </div>
             <div className="flex justify-between text-lg pt-2 border-t border-gray-200">
                 <span className="text-gray-900 font-bold">Saldo Restante</span>
                 <span className={`${remainingBalance > 0.01 ? 'text-red-600' : 'text-green-600'} font-bold`}>
                     {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(remainingBalance)}
                 </span>
             </div>
         </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800">Itens do Pedido</h3>
        </div>
        <div className="divide-y divide-gray-100">
            {order.items.map((item) => (
                <div key={item.id} className="p-6 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                    {/* Imagem do Item: Prioriza Logo da Empresa, senão ícone de Carrinho */}
                    <div className="w-16 h-16 rounded-lg border border-gray-200 bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                        {appSettings.logoUrl ? (
                            <img src={appSettings.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                        ) : (
                            <ShoppingCart className="text-gray-400" size={24} />
                        )}
                    </div>

                    <div className="flex-1">
                        <h4 className="text-gray-900 font-medium">{item.name}</h4>
                        {item.size && (
                             <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded">
                                Tamanho: {item.size}
                             </span>
                        )}
                        <p className="text-gray-500 text-sm mt-1">Qtd: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-gray-900 font-semibold">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
                        </p>
                    </div>
                </div>
            ))}
        </div>
        
        {/* Total Summary */}
        <div className="bg-gray-50 p-4 border-t border-gray-200">
             <div className="mb-2">
                 <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Total por Tamanho</h4>
                 <div className="grid grid-cols-2 gap-2">
                     {Object.entries(summary).map(([size, qty]) => (
                         <div key={size} className="flex justify-between text-sm bg-white px-3 py-1.5 rounded border border-gray-100">
                             <span className="text-gray-600 font-medium">{size}</span>
                             <span className="text-gray-900 font-bold">{qty}</span>
                         </div>
                     ))}
                 </div>
             </div>
             <div className="flex justify-between items-center pt-3 border-t border-gray-200 mt-2">
                 <span className="text-sm font-bold text-gray-800">TOTAL DE ITENS</span>
                 <span className="text-lg font-bold text-gray-900 bg-white px-4 py-1 rounded border border-gray-200 shadow-sm">{totalItems}</span>
             </div>
        </div>
      </div>

      {/* Company Address Block (New) */}
      {(appSettings.address || appSettings.city) && (
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="bg-gray-100 p-3 rounded-lg text-gray-600">
                  <Building size={24} />
              </div>
              <div>
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Endereço de Retirada</h4>
                  <p className="text-gray-800 font-medium">{appSettings.businessName || appSettings.appName}</p>
                  <p className="text-gray-600 text-sm">{appSettings.address}</p>
                  <p className="text-gray-500 text-xs">{appSettings.city}</p>
              </div>
          </div>
      )}

      {/* Lightbox Modal */}
      {expandedImage && (
        <div 
            className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setExpandedImage(null)}
        >
            <button 
                className="absolute top-4 right-4 text-white hover:text-gray-300"
                onClick={() => setExpandedImage(null)}
            >
                <X size={32} />
            </button>
            <img 
                src={expandedImage} 
                alt="Ampliada" 
                className="max-w-full max-h-[90vh] object-contain rounded-md"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
            />
        </div>
      )}
    </div>
  );
};
