
export enum OrderStatus {
  PEDIDO_FEITO = 'PEDIDO_FEITO',
  EM_PRODUCAO = 'EM_PRODUCAO',
  CONCLUIDO = 'CONCLUIDO',
  CANCELADO = 'CANCELADO'
}

export interface OrderItem {
  id: string;
  name: string;
  size: string;
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
  companyId: string;
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
  pressingDate?: string;
  printingDate?: string; // Novo campo
  seamstress?: string;
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
  printingDate?: string; // Novo campo
  seamstress?: string;
  items: Omit<OrderItem, 'id' | 'image'>[];
}

export type AccessLevel = 'admin' | 'user' | 'saas_admin';

export interface Employee {
  id: string;
  companyId: string | null;
  name: string;
  role: string;
  contact: string;
  admittedDate: string;
  login?: string;
  password?: string;
  accessLevel: AccessLevel;
  // Auxiliar para frontend
  companyStatus?: 'active' | 'inactive' | 'trial' | 'pending_payment';
  plan?: string;
  trial_ends_at?: string;
  next_payment_due?: string;
}

export interface NewEmployeeInput {
  name: string;
  role: string;
  contact: string;
  login: string;
  password?: string;
  accessLevel: AccessLevel;
}

export interface AppSettings {
  appName: string;
  logoUrl: string | null;
  businessName?: string;
  cnpj?: string;
  city?: string;
}

export interface Plan {
  id: number;
  name: string;
  price: number;
  description: string;
  features: string; // JSON string ou lista separada por virgula
  visible: boolean;
}

export interface Company {
  id: string;
  name: string;
  plan: string;
  status: 'active' | 'inactive' | 'trial' | 'pending_payment';
  created_at: string;
  trial_ends_at?: string;
  next_payment_due?: string;
  // Campos auxiliares vindos do join com employees (admin)
  adminName?: string;
  contact?: string;
  login?: string;
}

export interface SaasSettings {
  mpAccessToken: string;
  mpPublicKey: string;
}
