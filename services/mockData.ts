
import { Order, OrderStatus, NewOrderInput, Employee, NewEmployeeInput, AppSettings, Plan, Company, SaasSettings } from '../types';

// Detecta se estamos rodando localmente ou em produção
const getBaseUrl = () => {
    if (typeof window !== "undefined") {
        if (window.location.hostname === 'localhost') {
            return 'http://localhost:3002/api';
        }
        return '/api'; 
    }
    return 'http://localhost:3002/api';
}

const API_URL = getBaseUrl();
console.log("Connecting to Backend API at:", API_URL);

// --- State to hold current company context (set after login) ---
let currentCompanyId: string | null = null;

export const setCompanyContext = (companyId: string | null) => {
    currentCompanyId = companyId;
};

const getHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (currentCompanyId) {
        headers['x-company-id'] = currentCompanyId;
    }
    return headers;
}

// --- Helper for Errors ---
const handleResponse = async (response: Response) => {
  if (!response.ok) {
    let errorMessage = `Erro ${response.status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch (e) {
      // Not a JSON error or empty
    }
    throw new Error(errorMessage);
  }
  
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }
  return null;
};

// --- Settings ---
export const getAppSettings = async (): Promise<AppSettings> => {
    const response = await fetch(`${API_URL}/settings`, {
        headers: getHeaders()
    });
    return handleResponse(response);
};

export const updateAppSettings = async (settings: AppSettings): Promise<void> => {
    const response = await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(settings)
    });
    await handleResponse(response);
};

// --- Plans (SaaS) ---
export const getPlans = async (): Promise<Plan[]> => {
    const response = await fetch(`${API_URL}/plans`);
    return handleResponse(response);
};

export const createPlan = async (plan: Omit<Plan, 'id'>): Promise<void> => {
    const response = await fetch(`${API_URL}/plans`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(plan)
    });
    await handleResponse(response);
};

export const updatePlan = async (id: number, plan: Omit<Plan, 'id'>): Promise<void> => {
    const response = await fetch(`${API_URL}/plans/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(plan)
    });
    await handleResponse(response);
};

export const togglePlanVisibility = async (id: number, visible: boolean): Promise<void> => {
    const response = await fetch(`${API_URL}/plans/${id}/visibility`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ visible })
    });
    await handleResponse(response);
};

export const deletePlan = async (id: number): Promise<void> => {
    const response = await fetch(`${API_URL}/plans/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    await handleResponse(response);
};

// --- Companies (SaaS) ---
export const getCompanies = async (): Promise<Company[]> => {
    const response = await fetch(`${API_URL}/saas/companies`, {
        headers: getHeaders()
    });
    return handleResponse(response);
};

export const updateCompanyStatus = async (id: string, status: 'active' | 'inactive'): Promise<void> => {
    const response = await fetch(`${API_URL}/saas/companies/${id}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status })
    });
    await handleResponse(response);
};

export const manualRenewCompany = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/saas/companies/${id}/renew`, {
        method: 'POST',
        headers: getHeaders()
    });
    await handleResponse(response);
}

export const deleteCompany = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/saas/companies/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    await handleResponse(response);
}

// --- SaaS Settings (Super Admin) ---
export const getSaasSettings = async (): Promise<SaasSettings> => {
    const response = await fetch(`${API_URL}/saas/settings`, {
        headers: getHeaders()
    });
    return handleResponse(response);
}

export const saveSaasSettings = async (settings: SaasSettings): Promise<void> => {
    const response = await fetch(`${API_URL}/saas/settings`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(settings)
    });
    await handleResponse(response);
}

export const createCheckoutSession = async (companyId: string): Promise<string> => {
    const response = await fetch(`${API_URL}/saas/checkout/${companyId}`, {
        method: 'POST',
        headers: getHeaders()
    });
    const data = await handleResponse(response);
    return data.checkoutUrl;
}

// --- Authentication & Registration ---
export const authenticateUser = async (login: string, pass: string): Promise<Employee | null> => {
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password: pass })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "Authentication failed");
        }
        const user = await response.json();
        // Set context for future requests
        if (user.companyId) {
            setCompanyContext(user.companyId);
        } else {
            setCompanyContext('null'); // for super admin
        }
        return user;
    } catch (e: any) {
        console.error("Login error:", e.message);
        throw e;
    }
}

export const registerCompany = async (data: any): Promise<void> => {
    const response = await fetch(`${API_URL}/register-company`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    await handleResponse(response);
}

// --- Order Functions ---

export const getOrderById = async (id: string): Promise<Order> => {
    const response = await fetch(`${API_URL}/orders/${id}`);
    return handleResponse(response);
};

export const getAllOrders = async (): Promise<Order[]> => {
    const response = await fetch(`${API_URL}/orders`, {
        headers: getHeaders()
    });
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
    companyId: currentCompanyId || '', // Backend validation will catch if empty
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
      image: '' // No random image, will use logo/default icon
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
      headers: getHeaders(),
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
            image: '' // No random image
        }))
    };

    const response = await fetch(`${API_URL}/orders/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(updatedData)
    });

    await handleResponse(response);
    return getOrderById(id);
};

export const deleteOrder = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/orders/${id}`, { 
        method: 'DELETE',
        headers: getHeaders()
    });
    await handleResponse(response);
};

export const registerPayment = async (id: string, amount: number, method: string): Promise<Order> => {
    const response = await fetch(`${API_URL}/orders/${id}/payment`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ amount, method })
    });
    await handleResponse(response);
    return getOrderById(id);
};

// NOVO: Atualiza a lista completa de pagamentos e o valor total pago
export const updateOrderPayments = async (id: string, downPayment: number, paymentMethod: string): Promise<Order> => {
    const response = await fetch(`${API_URL}/orders/${id}/payment-update`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ downPayment, paymentMethod })
    });
    await handleResponse(response);
    return getOrderById(id);
};

export const updateOrderStatus = async (orderId: string, newStatus: OrderStatus, location?: string): Promise<Order> => {
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
        headers: getHeaders(),
        body: JSON.stringify({ currentStatus: newStatus, timeline: newTimeline })
    });

    await handleResponse(response);
    return getOrderById(orderId);
};

// --- Employee Functions ---

export const getEmployees = async (): Promise<Employee[]> => {
    const response = await fetch(`${API_URL}/employees`, {
        headers: getHeaders()
    });
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
        headers: getHeaders(),
        body: JSON.stringify(newEmployee)
    });
    return handleResponse(response);
};

export const deleteEmployee = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/employees/${id}`, { 
        method: 'DELETE',
        headers: getHeaders() 
    });
    await handleResponse(response);
}
