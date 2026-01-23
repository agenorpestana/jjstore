

import { Order, OrderStatus, NewOrderInput, Employee, NewEmployeeInput } from '../types';

// ATENÇÃO: Se estiver rodando na HostGator, mude esta string para a URL do seu backend.
// Exemplo: 'https://api.seusite.com.br/api' ou 'https://seusite.com.br/api'
// No localhost, ele usa o fallback para 3002 (Porta atualizada).
const getBaseUrl = () => {
    if (typeof window !== "undefined") {
        if (window.location.hostname === 'localhost') {
            return 'http://localhost:3002/api';
        }
        // INSIRA AQUI A URL DO SEU BACKEND NA HOSPEDAGEM
        // Se você usar subdomínio: 'https://api.seudominio.com/api'
        return 'https://api.seusite.com/api'; 
    }
    return 'http://localhost:3002/api';
}

const API_URL = getBaseUrl();
console.log("Connecting to Backend API at:", API_URL);

// --- Helper for Errors ---
const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || response.statusText);
  }
  return response.json();
};

// --- Authentication ---
export const authenticateUser = async (login: string, pass: string): Promise<Employee | null> => {
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password: pass })
        });
        if (!response.ok) {
            console.warn("Authentication failed with status:", response.status);
            return null;
        }
        return await response.json();
    } catch (e) {
        console.error("Login error / Network error. Check if Backend is running on port 3002.", e);
        return null;
    }
}

// --- Order Functions ---

export const getOrderById = async (id: string): Promise<Order> => {
    const response = await fetch(`${API_URL}/orders/${id}`);
    return handleResponse(response);
};

export const getAllOrders = async (): Promise<Order[]> => {
    const response = await fetch(`${API_URL}/orders`);
    return handleResponse(response);
};

export const createOrder = async (input: NewOrderInput): Promise<Order> => {
  const id = Math.floor(10000 + Math.random() * 90000).toString();
  const total = input.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  
  const formatDate = (dateString: string) => {
    if(dateString && dateString.includes('-')) {
        const [y, m, d] = dateString.split('-');
        return `${d}/${m}/${y}`;
    }
    return dateString;
  };

  const newOrder: Order = {
    id,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    orderDate: formatDate(input.orderDate),
    estimatedDelivery: formatDate(input.estimatedDelivery),
    shippingAddress: input.shippingAddress,
    paymentMethod: input.paymentMethod,
    downPayment: input.downPayment,
    currentStatus: OrderStatus.PEDIDO_FEITO,
    total,
    photos: input.photos || [],
    pressingDate: input.pressingDate,
    seamstress: input.seamstress,
    items: input.items.map((item, idx) => ({
      ...item,
      id: `new-${idx}`,
      image: `https://picsum.photos/100/100?random=${Math.random()}`
    })),
    timeline: [
      {
        status: OrderStatus.PEDIDO_FEITO,
        timestamp: new Date().toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' }),
        description: `Pedido criado. Entrada de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(input.downPayment)} recebida via ${input.paymentMethod}.`,
        completed: true
      },
      {
        status: OrderStatus.EM_PRODUCAO,
        timestamp: '-',
        description: 'Aguardando início da produção.',
        completed: false
      },
      {
        status: OrderStatus.CONCLUIDO,
        timestamp: '-',
        description: 'Aguardando conclusão.',
        completed: false
      }
    ]
  };

  const response = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newOrder)
  });

  return handleResponse(response);
};

export const updateOrderFull = async (id: string, input: NewOrderInput): Promise<Order> => {
    const formatDate = (dateString: string) => {
        if(dateString && dateString.includes('-')) {
            const [y, m, d] = dateString.split('-');
            return `${d}/${m}/${y}`;
        }
        return dateString;
    };

    const total = input.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    const updatedData = {
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        orderDate: formatDate(input.orderDate),
        estimatedDelivery: formatDate(input.estimatedDelivery),
        shippingAddress: input.shippingAddress,
        paymentMethod: input.paymentMethod,
        downPayment: input.downPayment,
        photos: input.photos || [],
        pressingDate: input.pressingDate,
        seamstress: input.seamstress,
        total: total,
        items: input.items.map((item, idx) => ({
            ...item,
            // Simple logic to keep ID if it looks like a DB ID, else generate temp one for backend to process
            id: (item as any).id || `temp-${idx}`, 
            image: `https://picsum.photos/100/100?random=${Math.random()}`
        }))
    };

    const response = await fetch(`${API_URL}/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
    });

    // The backend returns a message, so we just fetch the fresh order
    await handleResponse(response);
    return getOrderById(id);
};

export const deleteOrder = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/orders/${id}`, { method: 'DELETE' });
    await handleResponse(response);
};

export const registerPayment = async (id: string, amount: number, method: string): Promise<Order> => {
    const response = await fetch(`${API_URL}/orders/${id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, method })
    });
    await handleResponse(response);
    return getOrderById(id);
};

export const updateOrderStatus = async (orderId: string, newStatus: OrderStatus, location?: string): Promise<Order> => {
    // We first need the current order to calculate timeline logic, OR do it in backend.
    // To match previous logic, let's fetch, calculate timeline, and send patch.
    const order = await getOrderById(orderId);
    
    const timestamp = new Date().toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' });
    let description = '';
    switch(newStatus) {
        case OrderStatus.PEDIDO_FEITO: description = 'Pedido realizado com sucesso.'; break;
        case OrderStatus.EM_PRODUCAO: description = 'Seu pedido entrou em produção (Corte/Estampa/Costura).'; break;
        case OrderStatus.CONCLUIDO: description = 'Pedido concluído e pronto para entrega/retirada.'; break;
        case OrderStatus.CANCELADO: description = 'Pedido cancelado.'; break;
        default: description = 'Status atualizado.';
    }

    const getStatusWeight = (s: OrderStatus) => {
        const weights = {
            [OrderStatus.PEDIDO_FEITO]: 1,
            [OrderStatus.EM_PRODUCAO]: 2,
            [OrderStatus.CONCLUIDO]: 3,
            [OrderStatus.CANCELADO]: 4
        };
        return weights[s] || 0;
    }

    const newTimeline = order.timeline.map(event => {
        if (getStatusWeight(event.status) < getStatusWeight(newStatus)) {
            return { ...event, completed: true };
        }
        if (event.status === newStatus) {
            return { ...event, completed: true, timestamp, description, location };
        }
        return event;
    });

    const exists = newTimeline.find(t => t.status === newStatus);
    if (!exists) {
        newTimeline.push({
            status: newStatus,
            timestamp,
            description,
            location,
            completed: true
        });
    }

    const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStatus: newStatus, timeline: newTimeline })
    });

    await handleResponse(response);
    return getOrderById(orderId);
};

// --- Employee Functions ---

export const getEmployees = async (): Promise<Employee[]> => {
    const response = await fetch(`${API_URL}/employees`);
    return handleResponse(response);
};

export const createEmployee = async (input: NewEmployeeInput): Promise<Employee> => {
    const newEmployee = {
        id: `E${Math.floor(Math.random() * 1000)}`,
        ...input,
        admittedDate: new Date().toLocaleDateString('pt-BR')
    };

    const response = await fetch(`${API_URL}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmployee)
    });
    return handleResponse(response);
};

export const deleteEmployee = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/employees/${id}`, { method: 'DELETE' });
    await handleResponse(response);
}