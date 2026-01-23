import React, { useState, useEffect } from 'react';
import { Check, Package, Shirt, CheckCircle, ClipboardList } from 'lucide-react';
import { OrderStatus, StatusEvent } from '../types';

interface StatusTimelineProps {
  timeline: StatusEvent[];
  currentStatus: OrderStatus;
}

export const StatusTimeline: React.FC<StatusTimelineProps> = ({ timeline }) => {
  const getIcon = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PEDIDO_FEITO: return <ClipboardList size={20} />;
      case OrderStatus.EM_PRODUCAO: return <Shirt size={20} />;
      case OrderStatus.CONCLUIDO: return <CheckCircle size={20} />;
      default: return <ClipboardList size={20} />;
    }
  };

  const getStatusLabel = (status: OrderStatus) => {
      switch (status) {
          case OrderStatus.PEDIDO_FEITO: return 'Pedido Feito';
          case OrderStatus.EM_PRODUCAO: return 'Em Produção';
          case OrderStatus.CONCLUIDO: return 'Concluído';
          case OrderStatus.CANCELADO: return 'Cancelado';
          default: return status;
      }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
      <h3 className="text-lg font-semibold text-gray-800 mb-6">Linha do Tempo</h3>
      <div className="relative">
        {/* Vertical Line for mobile, Horizontal for desktop could be implemented, but vertical is safer for all screens */}
        <div className="absolute left-4 md:left-6 top-2 bottom-6 w-0.5 bg-gray-200"></div>

        <div className="space-y-8">
          {timeline.map((event, index) => (
            <div key={index} className="relative flex items-start group">
              {/* Icon Bubble */}
              <div
                className={`relative z-10 flex items-center justify-center w-8 h-8 md:w-12 md:h-12 rounded-full border-4 transition-colors duration-300
                  ${event.completed
                    ? 'bg-green-500 border-green-100 text-white shadow-green-100 shadow-lg'
                    : 'bg-white border-gray-200 text-gray-400'
                  }`}
              >
                {event.completed ? <Check size={16} strokeWidth={3} /> : getIcon(event.status)}
              </div>

              {/* Content */}
              <div className="ml-4 md:ml-6 flex-1 pt-1">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-1">
                  <h4 className={`font-semibold text-base md:text-lg ${event.completed ? 'text-gray-900' : 'text-gray-500'}`}>
                    {getStatusLabel(event.status)}
                  </h4>
                  <span className="text-sm text-gray-500 font-medium bg-gray-50 px-2 py-1 rounded-md inline-block mt-1 md:mt-0 w-fit">
                    {event.timestamp}
                  </span>
                </div>
                <p className="text-gray-600 text-sm">{event.description}</p>
                {event.location && (
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    📍 {event.location}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};