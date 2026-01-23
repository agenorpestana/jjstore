export enum OrderStatus {
  PEDIDO_FEITO = 'PEDIDO_FEITO',
  EM_PRODUCAO = 'EM_PRODUCAO',
  CONCLUIDO = 'CONCLUIDO',
  CANCELADO = 'CANCELADO'
}

export interface OrderItem {
  id: string;
  name: string;
  size: string; // Novo: Tamanho (P, M, G, 325ml, etc)
  quantity: number;
  price: number;
  image: string;
}

export interface StatusEvent {
  status: OrderStatus;
  timestamp: string;
  description: string;
  location?: string;
  completed: boolean;
}

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  orderDate: string;
  estimatedDelivery: string;
  items: OrderItem[];
  total: number;
  downPayment: number;
  paymentMethod: string;
  photos: string[];
  currentStatus: OrderStatus;
  timeline: StatusEvent[];
  shippingAddress: string;
  pressingDate?: string; // Data de prensagem (YYYY-MM-DD do input)
  seamstress?: string; // Nome da costureira
}

export interface NewOrderInput {
  customerName: string;
  customerPhone: string;
  orderDate: string;
  estimatedDelivery: string;
  shippingAddress: string;
  paymentMethod: string;
  downPayment: number;
  photos: string[];
  pressingDate?: string;
  seamstress?: string;
  items: Omit<OrderItem, 'id' | 'image'>[];
}

export type AccessLevel = 'admin' | 'user';

export interface Employee {
  id: string;
  name: string;
  role: string;
  contact: string;
  admittedDate: string;
  login?: string;
  password?: string;
  accessLevel: AccessLevel;
}

export interface NewEmployeeInput {
  name: string;
  role: string;
  contact: string;
  login: string;
  password?: string;
  accessLevel: AccessLevel;
}