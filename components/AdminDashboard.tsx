
import React, { useState, useEffect } from 'react';
import { Plus, Search, Truck, CheckCircle, Package, MapPin, X, Users, Briefcase, Trash2, Calendar, Phone, DollarSign, CreditCard, Eye, Edit2, Camera, Upload, Image as ImageIcon, Shirt, Scissors, ClipboardList, Printer, ChevronLeft, ChevronRight, Lock, Key, Shield, Settings, Save, AlertTriangle, AlertCircle, ShoppingCart, Copy, Check, FileText, ArrowRight } from 'lucide-react';
import { Order, OrderStatus, NewOrderInput, Employee, NewEmployeeInput, AppSettings } from '../types';
import { getAllOrders, createOrder, updateOrderStatus, getEmployees, createEmployee, deleteEmployee, updateOrderFull, registerPayment, deleteOrder, updateAppSettings, createCheckoutSession, updateOrderPayments, convertQuoteToOrder } from '../services/mockData';

interface AdminDashboardProps {
  currentUser: Employee;
  onLogout: () => void;
  appSettings: AppSettings;
  onUpdateSettings: () => void;
}

type Tab = 'orders' | 'quotes' | 'employees' | 'settings' | 'subscription';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, onLogout, appSettings, onUpdateSettings }) => {
  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Check Permissions
  const isAdmin = currentUser.accessLevel === 'admin';

  // Subscription Warning Logic
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  useEffect(() => {
      if (isAdmin && (currentUser.next_payment_due || currentUser.trial_ends_at)) {
          const dueDateStr = currentUser.companyStatus === 'trial' ? currentUser.trial_ends_at : currentUser.next_payment_due;
          if (dueDateStr) {
              const dueDate = new Date(dueDateStr);
              const now = new Date();
              const diffTime = dueDate.getTime() - now.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              setDaysRemaining(diffDays);
          }
      }
  }, [currentUser, isAdmin]);


  // Search, Filter & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL'); // NEW: Status Filter
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals
  const [showOrderModal, setShowOrderModal] = useState(false); // Used for New AND Edit
  const [isEditingFullOrder, setIsEditingFullOrder] = useState<string | null>(null); // ID of order being edited
  const [showNewEmployeeModal, setShowNewEmployeeModal] = useState(false);
  
  // Loading state specifically for submitting the order form (to handle big images)
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Status & View Modals
  const [managingStatusOrder, setManagingStatusOrder] = useState<Order | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  
  // Payment State for View Modal
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethodRemaining, setPaymentMethodRemaining] = useState('Pix');

  // Settings State
  const [settingsForm, setSettingsForm] = useState<AppSettings>(appSettings);

  // --- Data Loading ---
  const refreshOrders = async () => {
    setLoading(true);
    try {
        const data = await getAllOrders();
        setOrders(data);
    } catch (err) {
        console.error("Erro ao carregar pedidos:", err);
    } finally {
        setLoading(false);
    }
  };

  const refreshEmployees = async () => {
      if (!isAdmin) return; // Users cannot see employees
      setLoading(true);
      try {
          const data = await getEmployees();
          setEmployees(data);
      } catch (err) {
          console.error("Erro ao carregar funcionários:", err);
      } finally {
          setLoading(false);
      }
  }

  useEffect(() => {
    if (activeTab === 'orders' || activeTab === 'quotes') refreshOrders();
    else if (activeTab === 'employees') refreshEmployees();
    else if (activeTab === 'settings') setSettingsForm(appSettings);
  }, [activeTab, appSettings]);

  // --- Order Filtering & Pagination Logic ---
  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          order.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Logic for Tabs
    let matchesTab = true;
    if (activeTab === 'orders') {
        matchesTab = order.currentStatus !== OrderStatus.ORCAMENTO;
    } else if (activeTab === 'quotes') {
        matchesTab = order.currentStatus === OrderStatus.ORCAMENTO;
    }

    const matchesStatus = statusFilter === 'ALL' || order.currentStatus === statusFilter;

    return matchesSearch && matchesStatus && matchesTab;
  });

  // Reverse to show newest first (Last 10 orders)
  const sortedOrders = [...filteredOrders].reverse();

  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentOrders = sortedOrders.slice(startIndex, startIndex + itemsPerPage);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(e.target.value);
      setCurrentPage(1); // Reset to page 1 on search
  };

  const goToNextPage = () => {
      if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
  };

  const goToPrevPage = () => {
      if (currentPage > 1) setCurrentPage(prev => prev - 1);
  };

  const handleDeleteOrder = async (id: string) => {
      if (!isAdmin) return;
      if (window.confirm('Tem certeza que deseja excluir este item permanentemente?')) {
          await deleteOrder(id);
          refreshOrders();
      }
  };

  const handleConvertQuote = async (id: string) => {
      if (!window.confirm("Deseja converter este orçamento em um pedido oficial?\nIsso moverá o item para a aba de Pedidos e iniciará a linha do tempo.")) return;
      
      try {
          await convertQuoteToOrder(id);
          alert('Orçamento convertido com sucesso!');
          refreshOrders();
      } catch (err: any) {
          alert('Erro ao converter: ' + err.message);
      }
  }

  // --- Subscription Payment Logic ---
  const handlePaySubscription = async () => {
      if (!currentUser.companyId) return;
      try {
          const url = await createCheckoutSession(currentUser.companyId);
          window.location.href = url;
      } catch (e: any) {
          alert('Erro ao gerar pagamento: ' + e.message);
      }
  }

  // --- Order Form Logic (New & Edit) ---
  const [orderForm, setOrderForm] = useState<NewOrderInput>({
    customerName: '',
    customerPhone: '',
    shippingAddress: '',
    orderDate: new Date().toISOString().split('T')[0],
    estimatedDelivery: '',
    paymentMethod: 'Pix',
    downPayment: 0,
    photos: [],
    items: [],
    pressingDate: '',
    printingDate: '', // Initialize
    seamstress: '',
    // Novos campos
    isQuote: false,
    quoteValidity: '',
    notes: ''
  });
  
  // Item Editing State
  const [tempItem, setTempItem] = useState({ name: '', size: '', price: '', quantity: '1' });
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  const resetOrderForm = () => {
      setOrderForm({
        customerName: '', customerPhone: '', shippingAddress: '', 
        orderDate: new Date().toISOString().split('T')[0], estimatedDelivery: '',
        paymentMethod: 'Pix', downPayment: 0, photos: [], items: [],
        pressingDate: '', printingDate: '', seamstress: '',
        isQuote: activeTab === 'quotes', // Default to true if in quotes tab
        quoteValidity: '', notes: ''
    });
    setTempItem({ name: '', size: '', price: '', quantity: '1' });
    setEditingItemIndex(null);
    setIsEditingFullOrder(null);
    setIsSubmitting(false);
  }

  const handleOpenNewOrder = () => {
      resetOrderForm();
      setShowOrderModal(true);
  }

  const handleOpenEditOrder = (order: Order) => {
      // Parse dates back to YYYY-MM-DD for input fields if possible
      const parseDateToInput = (dateStr?: string) => {
          if (!dateStr) return '';
          if (dateStr.includes('/')) {
              const [d, m, y] = dateStr.split('/');
              return `${y}-${m}-${d}`;
          }
          return dateStr || '';
      };

      setOrderForm({
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          shippingAddress: order.shippingAddress,
          orderDate: parseDateToInput(order.orderDate),
          estimatedDelivery: parseDateToInput(order.estimatedDelivery),
          paymentMethod: order.paymentMethod, // Assuming this is string
          downPayment: order.downPayment,
          photos: order.photos || [],
          pressingDate: order.pressingDate || '',
          printingDate: order.printingDate || '',
          seamstress: order.seamstress || '',
          items: order.items.map(i => ({ name: i.name, size: i.size, price: i.price, quantity: i.quantity })),
          isQuote: order.currentStatus === OrderStatus.ORCAMENTO,
          quoteValidity: order.quoteValidity || '',
          notes: order.notes || ''
      });
      setIsEditingFullOrder(order.id);
      setShowOrderModal(true);
  }

  // --- NOVO: Função para Duplicar Pedido ---
  const handleDuplicateOrder = (order: Order) => {
      setOrderForm({
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          shippingAddress: order.shippingAddress,
          orderDate: new Date().toISOString().split('T')[0], // Data de hoje
          estimatedDelivery: '', // Limpa previsão
          paymentMethod: 'Pix', // Reset financeiro
          downPayment: 0, // Reset financeiro
          photos: order.photos || [],
          pressingDate: '',
          printingDate: '',
          seamstress: '',
          items: order.items.map(i => ({ name: i.name, size: i.size, price: i.price, quantity: i.quantity })),
          isQuote: order.currentStatus === OrderStatus.ORCAMENTO,
          quoteValidity: order.quoteValidity || '', // Mantém validade se for orçamento
          notes: order.notes || ''
      });
      setIsEditingFullOrder(null); // Trata como um NOVO pedido
      setShowOrderModal(true);
  }

  const handleSaveItem = () => {
    if (!tempItem.name || !tempItem.price) return;
    
    const newItem = { 
        name: tempItem.name, 
        size: tempItem.size, 
        price: Number(tempItem.price), 
        quantity: Number(tempItem.quantity) 
    };

    setOrderForm(prev => {
        const currentItems = [...prev.items];
        if (editingItemIndex !== null) {
            // Update existing
            currentItems[editingItemIndex] = newItem;
        } else {
            // Add new
            currentItems.push(newItem);
        }
        return { ...prev, items: currentItems };
    });

    // Reset input states
    setTempItem({ name: '', size: '', price: '', quantity: '1' });
    setEditingItemIndex(null);
  };

  const handleEditItem = (index: number) => {
      const itemToEdit = orderForm.items[index];
      setTempItem({
          name: itemToEdit.name,
          size: itemToEdit.size || '',
          price: itemToEdit.price.toString(),
          quantity: itemToEdit.quantity.toString()
      });
      setEditingItemIndex(index);
  }

  const handleCancelEditItem = () => {
      setTempItem({ name: '', size: '', price: '', quantity: '1' });
      setEditingItemIndex(null);
  }

  const handleRemoveItem = (index: number) => {
      setOrderForm(prev => ({
          ...prev,
          items: prev.items.filter((_, i) => i !== index)
      }));
      // Se estiver editando o item que foi excluído, cancela a edição
      if (editingItemIndex === index) {
          handleCancelEditItem();
      }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files[0]) {
          // Check file size (e.g., limit to 10MB per file client-side)
          if (files[0].size > 10 * 1024 * 1024) {
              alert('A imagem é muito grande (Máx 10MB). Por favor, comprima a imagem antes de enviar.');
              e.target.value = '';
              return;
          }

          // Increase limit to 6
          if (orderForm.photos.length >= 6) {
              alert('Máximo de 6 fotos permitidas.');
              return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
              if (typeof reader.result === 'string') {
                  setOrderForm(prev => ({...prev, photos: [...prev.photos, reader.result as string]}));
              }
          };
          reader.readAsDataURL(files[0]);
      }
      // Reset input
      e.target.value = '';
  }

  const handleRemovePhoto = (index: number) => {
      setOrderForm(prev => ({
          ...prev,
          photos: prev.photos.filter((_, i) => i !== index)
      }));
  }

  const handleSubmitOrder = async () => {
    // Validate Mandatory Fields
    if (!orderForm.customerName || !orderForm.customerPhone || !orderForm.orderDate || orderForm.items.length === 0) {
        alert("Por favor, preencha os campos obrigatórios: Nome, Contato, Data e adicione pelo menos um produto.");
        return;
    }
    
    // Validate Down Payment
    const total = orderForm.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    if (orderForm.downPayment > total) {
        alert("O valor de entrada não pode ser maior que o valor total dos produtos.");
        return;
    }

    // Helper to format money for saving
    const formatMoney = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    let finalOrderForm = { ...orderForm };

    // Se for criação de novo pedido E tiver entrada, formata o método para incluir o valor
    if (!isEditingFullOrder && orderForm.downPayment > 0) {
        // Se o método ainda não tiver sido formatado (previne dupla formatação se editar algo antes de salvar)
        if (!orderForm.paymentMethod.includes('(')) {
             finalOrderForm.paymentMethod = `${orderForm.paymentMethod} (${formatMoney(orderForm.downPayment)})`;
        }
    }

    setIsSubmitting(true);
    try {
        if (isEditingFullOrder) {
            await updateOrderFull(isEditingFullOrder, finalOrderForm);
        } else {
            await createOrder(finalOrderForm);
        }
        setShowOrderModal(false);
        resetOrderForm();
        refreshOrders();
    } catch (err: any) {
        alert("Erro ao salvar. Se estiver enviando muitas fotos, tente enviar menos ou em menor resolução.\n\nDetalhes: " + err.message);
    } finally {
        setIsSubmitting(false);
    }
  };

  // ... (New Employee Logic & Settings Logic omitted for brevity as they haven't changed much but are included in the full block below) ...
  const [newEmployeeForm, setNewEmployeeForm] = useState<NewEmployeeInput>({
      name: '', role: '', contact: '', login: '', password: '', accessLevel: 'user'
  });

  const handleSubmitEmployee = async () => {
      if (!isAdmin) return;
      if (!newEmployeeForm.name || !newEmployeeForm.role || !newEmployeeForm.login || !newEmployeeForm.password) {
          alert('Preencha todos os campos obrigatórios.');
          return;
      }
      await createEmployee(newEmployeeForm);
      setShowNewEmployeeModal(false);
      setNewEmployeeForm({ name: '', role: '', contact: '', login: '', password: '', accessLevel: 'user' });
      refreshEmployees();
  }

  const handleDeleteEmployee = async (id: string) => {
      if (!isAdmin) return;
      if(window.confirm('Tem certeza que deseja remover este funcionário?')) {
          await deleteEmployee(id);
          refreshEmployees();
      }
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files[0]) {
          const reader = new FileReader();
          reader.onloadend = () => {
              if (typeof reader.result === 'string') {
                  setSettingsForm(prev => ({...prev, logoUrl: reader.result as string}));
              }
          };
          reader.readAsDataURL(files[0]);
      }
  }

  const handleSaveSettings = async () => {
      if (!isAdmin) return;
      await updateAppSettings(settingsForm);
      onUpdateSettings(); // Refresh app level state
      alert('Configurações salvas com sucesso!');
  }

  const [updateStatusLocation, setUpdateStatusLocation] = useState('');
  
  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    await updateOrderStatus(orderId, newStatus, updateStatusLocation || undefined);
    setUpdateStatusLocation('');
    setManagingStatusOrder(null);
    refreshOrders();
  };

  const handleRegisterPayment = async () => {
      if (!viewingOrder || !paymentAmount) return;

      const remaining = viewingOrder.total - (viewingOrder.downPayment || 0);
      const amount = Number(paymentAmount);

      if (amount > remaining + 0.01) { // 1 cent threshold
          alert("O valor informado é maior que o saldo restante.");
          return;
      }
      
      const formattedAmount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
      const methodWithAmount = `${paymentMethodRemaining} (${formattedAmount})`;

      await registerPayment(viewingOrder.id, amount, methodWithAmount);
      setPaymentAmount('');
      setPaymentMethodRemaining('Pix'); 
      
      const updatedList = await getAllOrders();
      setOrders(updatedList);
      const updatedOrder = updatedList.find(o => o.id === viewingOrder.id) || null;
      setViewingOrder(updatedOrder);
  }

  const handleRemovePayment = async (index: number) => {
      if (!viewingOrder || !isAdmin) return;
      if (!window.confirm("Deseja realmente remover este registro de pagamento? O saldo do pedido será recalculado.")) return;

      const methods = viewingOrder.paymentMethod ? viewingOrder.paymentMethod.split(' + ') : [];
      if (index >= methods.length) return;

      methods.splice(index, 1);
      const newPaymentMethod = methods.join(' + ');

      let newDownPayment = 0;
      methods.forEach(m => {
          const match = m.match(/R\$\s?([\d.,]+)/);
          if (match && match[1]) {
              const valStr = match[1].replace(/\./g, '').replace(',', '.');
              newDownPayment += parseFloat(valStr);
          }
      });

      try {
          await updateOrderPayments(viewingOrder.id, newDownPayment, newPaymentMethod);
          
          const updatedList = await getAllOrders();
          setOrders(updatedList);
          const updatedOrder = updatedList.find(o => o.id === viewingOrder.id) || null;
          setViewingOrder(updatedOrder);
      } catch (err: any) {
          alert("Erro ao remover pagamento: " + err.message);
      }
  };

  const getSizeSummary = (items: { size: string; quantity: number }[]) => {
      const summary: Record<string, number> = {};
      let totalItems = 0;

      items.forEach(item => {
          const size = item.size ? item.size.toUpperCase().trim() : 'UN';
          summary[size] = (summary[size] || 0) + item.quantity;
          totalItems += item.quantity;
      });

      return { summary, totalItems };
  };

  const handlePrintOrder = () => {
    if (!viewingOrder) return;
    const { summary, totalItems } = getSizeSummary(viewingOrder.items);
    const printWindow = window.open('', '', 'width=900,height=800');
    if (!printWindow) return;

    const summaryRows = Object.entries(summary).map(([size, qty]) => `
        <tr>
            <td style="text-align: left; padding: 5px;">${size}</td>
            <td style="text-align: center; padding: 5px;">${qty}</td>
        </tr>
    `).join('');

    const isQuote = viewingOrder.currentStatus === OrderStatus.ORCAMENTO;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${isQuote ? 'Orçamento' : 'Pedido'} #${viewingOrder.id}</title>
        <style>
          @page { size: A4; margin: 0.5cm; }
          body { font-family: 'Segoe UI', sans-serif; color: #1f2937; line-height: 1.2; font-size: 13px; }
          .header { border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
          .logo { font-size: 20px; font-weight: bold; color: #2563eb; display:flex; align-items:center; gap: 10px; }
          .logo img { height: 35px; }
          .order-id { font-size: 16px; color: #4b5563; }
          .section { margin-bottom: 10px; }
          .section-title { font-size: 13px; font-weight: bold; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #eee; padding-bottom: 3px; margin-bottom: 5px; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
          .info-group { margin-bottom: 3px; }
          .label { font-weight: 600; color: #374151; font-size: 12px; }
          .value { color: #111827; font-size: 13px; }
          .photos-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 5px; }
          .photo-container { border: 1px solid #e5e7eb; border-radius: 4px; overflow: hidden; height: 100px; background: #f9fafb; display: flex; align-items: center; justify-content: center; }
          .photo-container img { width: 100%; height: 100%; object-fit: contain; }
          table { width: 100%; border-collapse: collapse; margin-top: 5px; }
          th { background-color: #f3f4f6; text-align: left; padding: 5px; font-size: 11px; font-weight: bold; color: #4b5563; border-bottom: 1px solid #e5e7eb; }
          td { padding: 5px; border-bottom: 1px solid #f3f4f6; font-size: 12px; color: #1f2937; }
          tbody tr:nth-child(even) { background-color: #f9fafb; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .summary-box { margin-top: 10px; width: 50%; border: 1px solid #e5e7eb; }
          .total-row { background-color: #f9fafb; font-weight: bold; border-top: 2px solid #e5e7eb; }
          .print-footer { margin-top: 40px; border-top: 1px dashed #ccc; padding-top: 20px; page-break-inside: avoid; }
          .declaration-title { font-weight: bold; text-align: center; font-size: 14px; margin-bottom: 15px; text-transform: uppercase; }
          .declaration-text { font-size: 12px; line-height: 1.6; text-align: justify; margin-bottom: 30px; }
          .date-line { text-align: right; margin-bottom: 50px; font-size: 12px; }
          .signature-line { text-align: center; font-size: 11px; font-weight: bold; border-top: 1px solid #000; width: 80%; margin: 0 auto; padding-top: 5px; }
          .finance-total-box { margin-top: 20px; padding: 10px; background: #f3f4f6; border-radius: 4px; text-align: right; font-size: 14px; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">
             ${appSettings.logoUrl ? `<img src="${appSettings.logoUrl}" />` : ''}
             ${appSettings.appName}
          </div>
          <div class="order-id">${isQuote ? 'Orçamento' : 'Pedido'} #${viewingOrder.id}</div>
        </div>

        <div class="section">
          <div class="grid-2">
            <div>
              <div class="section-title">Dados do Cliente</div>
              <div class="info-group">
                <span class="label">Nome:</span> <span class="value">${viewingOrder.customerName}</span>
              </div>
              <div class="info-group">
                <span class="label">Telefone:</span> <span class="value">${viewingOrder.customerPhone}</span>
              </div>
              <div class="info-group">
                <span class="label">Endereço:</span> <span class="value">${viewingOrder.shippingAddress}</span>
              </div>
            </div>
            <div>
              <div class="section-title">${isQuote ? 'Detalhes' : 'Datas & Produção'}</div>
              <div class="info-group">
                <span class="label">Data:</span> <span class="value">${viewingOrder.orderDate}</span>
              </div>
              <div class="info-group">
                <span class="label">${isQuote ? 'Prazo de Entrega:' : 'Previsão Entrega:'}</span> <span class="value">${viewingOrder.estimatedDelivery}</span>
              </div>
              
              ${!isQuote ? `
              <div class="info-group">
                <span class="label">Prensagem:</span> <span class="value">${formatDatePTBR(viewingOrder.pressingDate) || '-'}</span>
              </div>
              <div class="info-group">
                <span class="label">Impressão:</span> <span class="value">${formatDatePTBR(viewingOrder.printingDate) || '-'}</span>
              </div>
              <div class="info-group">
                <span class="label">Costureira:</span> <span class="value">${viewingOrder.seamstress || '-'}</span>
              </div>` : ''}
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Produtos</div>
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th class="text-center">Tamanho</th>
                <th class="text-center">Qtd</th>
                ${isQuote ? `
                <th class="text-right">V. Unit</th>
                <th class="text-right">Total</th>
                ` : ''}
              </tr>
            </thead>
            <tbody>
              ${viewingOrder.items.map(item => `
                <tr>
                  <td>${item.name}</td>
                  <td class="text-center">${item.size || '-'}</td>
                  <td class="text-center">${item.quantity}</td>
                  ${isQuote ? `
                  <td class="text-right">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}</td>
                  <td class="text-right">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price * item.quantity)}</td>
                  ` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
            <div class="summary-box">
                <div class="section-title" style="border:none; padding: 8px; margin:0; background:#f3f4f6;">Resumo por Tamanho</div>
                <table style="margin:0;">
                    <thead>
                        <tr>
                            <th style="padding: 5px;">Tamanho</th>
                            <th style="padding: 5px; text-align: center;">Qtd</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${summaryRows}
                        <tr class="total-row">
                            <td style="padding: 8px;">TOTAL DE ITENS</td>
                            <td style="padding: 8px; text-align: center;">${totalItems}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        ${isQuote ? `
        <div class="finance-total-box">
            <strong>TOTAL GERAL: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(viewingOrder.total)}</strong>
        </div>
        ` : ''}

        ${viewingOrder.photos && viewingOrder.photos.length > 0 ? `
          <div class="section">
            <div class="section-title">Fotos</div>
            <div class="photos-grid">
              ${viewingOrder.photos.map(photo => `
                <div class="photo-container">
                  <img src="${photo}" />
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${(viewingOrder.notes || (isQuote && viewingOrder.quoteValidity)) ? `
        <div class="section" style="margin-top: 20px;">
            <div class="section-title">Observações & Condições</div>
            <div style="border: 1px solid #e5e7eb; padding: 10px; font-size: 12px; background: #fcfcfc;">
                ${isQuote && viewingOrder.quoteValidity ? `
                <div style="margin-bottom: 8px;">
                    <strong>Validade da Proposta:</strong> ${viewingOrder.quoteValidity}
                </div>` : ''}
                
                ${viewingOrder.notes ? `
                <div>
                    <strong>Notas:</strong> ${viewingOrder.notes}
                </div>` : ''}
            </div>
        </div>
        ` : ''}

        ${!isQuote ? `
        <div class="print-footer">
            <div class="declaration-title">DECLARAÇÃO DE RECEBIMENTO DE MERCADORIA</div>
            <div class="declaration-text">
                Recebi da Empresa <b>${appSettings.businessName || appSettings.appName}</b>, CNPJ: <b>${appSettings.cnpj || '____________________'}</b>,
                o pedido <b>#${viewingOrder.id}</b> em conformidade com o pedido solicitado e em perfeito estado.
                Confirmo que recebi todos os itens citados acima.
            </div>
            <div class="date-line">
                ${appSettings.city || '________________'}, ____ de ____________________ de 20____.
            </div>
            <div class="signature-line">
                ASSINATURA E CPF DO RECEBEDOR
            </div>
        </div>` : ''}

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch(status) {
        case OrderStatus.ORCAMENTO:
            return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">Orçamento</span>;
        case OrderStatus.PEDIDO_FEITO:
            return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">Pedido Feito</span>;
        case OrderStatus.EM_PRODUCAO:
            return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Em Produção</span>;
        case OrderStatus.CONCLUIDO:
            return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Concluído</span>;
        case OrderStatus.CANCELADO:
            return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">Cancelado</span>;
        default:
            return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const formatDatePTBR = (dateStr?: string) => {
      if (!dateStr) return '-';
      if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const [y, m, d] = dateStr.split('-');
          return `${d}/${m}/${y}`;
      }
      try {
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
              return date.toLocaleDateString('pt-BR');
          }
      } catch (e) { }
      return dateStr;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2">
                 {appSettings.logoUrl ? (
                     <img src={appSettings.logoUrl} alt="Logo" className="h-8 w-auto" />
                 ) : (
                    <Package className="text-primary" /> 
                 )}
                 <h1 className="text-xl font-bold text-gray-800">{appSettings.appName}</h1>
             </div>
             <span className={`px-2 py-0.5 rounded-md text-xs font-semibold uppercase ${isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                 {isAdmin ? 'Admin' : 'Usuário'}
             </span>
          </div>
          <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500 hidden sm:inline">Olá, {currentUser.name}</span>
              <button onClick={onLogout} className="text-gray-500 hover:text-red-600 text-sm font-medium flex items-center gap-1">
                <X size={16} /> Sair
              </button>
          </div>
        </div>
      </div>

      {/* Subscription Alert Banner */}
      {daysRemaining !== null && daysRemaining <= 3 && daysRemaining >= 0 && (
          <div className="bg-orange-50 border-b border-orange-100 p-3">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-orange-800 text-sm font-medium">
                      <AlertTriangle size={18} />
                      Atenção: Sua assinatura vence em {daysRemaining} dia(s). Evite o bloqueio do sistema.
                  </div>
                  <button 
                    onClick={() => setActiveTab('subscription')} 
                    className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-3 py-1.5 rounded-md transition"
                  >
                      Renovar Agora
                  </button>
              </div>
          </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Tabs & Actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm flex-wrap">
                <button 
                    onClick={() => setActiveTab('orders')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'orders' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    <Package size={16} /> Pedidos
                </button>
                <button 
                    onClick={() => setActiveTab('quotes')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'quotes' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    <FileText size={16} /> Orçamentos
                </button>
                {isAdmin && (
                    <button 
                        onClick={() => setActiveTab('employees')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'employees' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Users size={16} /> Funcionários
                    </button>
                )}
                {isAdmin && (
                     <button 
                        onClick={() => setActiveTab('settings')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'settings' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Settings size={16} /> Configurações
                    </button>
                )}
                {isAdmin && (
                     <button 
                        onClick={() => setActiveTab('subscription')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'subscription' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <CreditCard size={16} /> Minha Assinatura
                    </button>
                )}
            </div>

            {/* Only show 'New Employee' button if in employees tab AND is admin */}
            {activeTab === 'employees' && isAdmin && (
                <button 
                    onClick={() => setShowNewEmployeeModal(true)} 
                    className="bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-sm"
                >
                    <Plus size={16} /> Novo Funcionário
                </button>
            )}

            {(activeTab === 'orders' || activeTab === 'quotes') && (
                 <button 
                 onClick={() => handleOpenNewOrder()} 
                 className="bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-sm"
                >
                    <Plus size={16} /> {activeTab === 'quotes' ? 'Novo Orçamento' : 'Novo Pedido'}
                </button>
            )}
        </div>

        {/* --- ORDERS & QUOTES TAB --- */}
        {(activeTab === 'orders' || activeTab === 'quotes') && (
            <div className="space-y-4">
                {/* Search Bar & Filter */}
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input 
                            type="text" 
                            placeholder={`Buscar ${activeTab === 'quotes' ? 'orçamento' : 'pedido'} por ID ou Nome...`} 
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                            value={searchTerm}
                            onChange={handleSearchChange}
                        />
                    </div>
                    {/* Status Filter - Only show relevant filters */}
                    <div className="w-full md:w-48">
                        <select 
                            className="w-full h-full border border-gray-200 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm"
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                        >
                            <option value="ALL">Todos os Status</option>
                            {activeTab === 'orders' && (
                                <>
                                    <option value={OrderStatus.PEDIDO_FEITO}>Pedido Feito</option>
                                    <option value={OrderStatus.EM_PRODUCAO}>Em Produção</option>
                                    <option value={OrderStatus.CONCLUIDO}>Concluído</option>
                                    <option value={OrderStatus.CANCELADO}>Cancelado</option>
                                </>
                            )}
                            {activeTab === 'quotes' && (
                                <option value={OrderStatus.ORCAMENTO}>Orçamento</option>
                            )}
                        </select>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Datas</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Financeiro</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {currentOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        Nenhum {activeTab === 'quotes' ? 'orçamento' : 'pedido'} encontrado.
                                    </td>
                                </tr>
                            ) : (
                                currentOrders.map((order) => (
                                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">#{order.id}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">{order.customerName}</div>
                                    <div className="text-xs text-gray-500">{order.customerPhone}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-xs text-gray-500">Data: {order.orderDate}</div>
                                        {activeTab === 'quotes' ? (
                                            <div className="text-xs text-purple-600 font-medium">Validade: {order.quoteValidity || '-'}</div>
                                        ) : (
                                            <div className="text-xs text-gray-900 font-medium">Ent: {order.estimatedDelivery}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                    {getStatusBadge(order.currentStatus)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div>Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}</div>
                                        {order.downPayment > 0 && (
                                            <div className="text-xs text-green-600">Pago: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.downPayment)}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end gap-2">
                                            {activeTab === 'quotes' && (
                                                <button 
                                                    onClick={() => handleConvertQuote(order.id)}
                                                    title="Converter em Pedido"
                                                    className="text-gray-500 hover:text-green-600 bg-gray-100 hover:bg-green-50 p-2 rounded-lg transition"
                                                >
                                                    <ArrowRight size={18} />
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => setViewingOrder(order)}
                                                title="Visualizar"
                                                className="text-gray-500 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 p-2 rounded-lg transition"
                                            >
                                                <Eye size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handleOpenEditOrder(order)}
                                                title="Editar"
                                                className="text-gray-500 hover:text-orange-600 bg-gray-100 hover:bg-orange-50 p-2 rounded-lg transition"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handleDuplicateOrder(order)}
                                                title={activeTab === 'quotes' ? "Duplicar Orçamento" : "Duplicar Pedido"}
                                                className="text-gray-500 hover:text-purple-600 bg-gray-100 hover:bg-purple-50 p-2 rounded-lg transition"
                                            >
                                                <Copy size={18} />
                                            </button>
                                            {activeTab === 'orders' && (
                                                <button 
                                                    onClick={() => setManagingStatusOrder(order)}
                                                    title="Alterar Status"
                                                    className="text-gray-500 hover:text-green-600 bg-gray-100 hover:bg-green-50 p-2 rounded-lg transition"
                                                >
                                                    <Truck size={18} />
                                                </button>
                                            )}
                                            {isAdmin && (
                                                <button 
                                                    onClick={() => handleDeleteOrder(order.id)}
                                                    title="Excluir"
                                                    className="text-gray-500 hover:text-red-600 bg-gray-100 hover:bg-red-50 p-2 rounded-lg transition"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                                ))
                            )}
                        </tbody>
                        </table>
                    </div>
                    
                    {/* Pagination Controls */}
                    {totalPages > 0 && (
                        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
                            <div className="text-sm text-gray-500">
                                Mostrando <span className="font-medium">{Math.min(filteredOrders.length, (currentPage - 1) * itemsPerPage + 1)}</span> a <span className="font-medium">{Math.min(filteredOrders.length, currentPage * itemsPerPage)}</span> de <span className="font-medium">{filteredOrders.length}</span> resultados
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={goToPrevPage}
                                    disabled={currentPage === 1}
                                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white text-gray-600"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <span className="flex items-center px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700">
                                    Página {currentPage} de {totalPages}
                                </span>
                                <button
                                    onClick={goToNextPage}
                                    disabled={currentPage === totalPages}
                                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white text-gray-600"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* ... (Existing Employees Tab Code) ... */}
        {activeTab === 'employees' && isAdmin && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="overflow-x-auto">
                 <table className="min-w-full divide-y divide-gray-200">
                 <thead className="bg-gray-50">
                     <tr>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cargo / Tipo</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contato / Login</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Admissão</th>
                     <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                     </tr>
                 </thead>
                 <tbody className="bg-white divide-y divide-gray-200">
                     {employees.length === 0 && (
                         <tr><td colSpan={5} className="p-8 text-center text-gray-500">Nenhum funcionário cadastrado.</td></tr>
                     )}
                     {employees.map((emp) => (
                     <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                         <td className="px-6 py-4 whitespace-nowrap">
                             <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                                     {emp.name.charAt(0)}
                                 </div>
                                 <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                             </div>
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap">
                             <div className="flex flex-col">
                                <span className="text-sm text-gray-900">{emp.role}</span>
                                <span className={`text-xs font-semibold uppercase ${emp.accessLevel === 'admin' ? 'text-purple-600' : 'text-gray-500'}`}>
                                    {emp.accessLevel}
                                </span>
                             </div>
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div>{emp.contact}</div>
                            <div className="text-xs text-gray-400">Login: {emp.login}</div>
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                         {emp.admittedDate}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                         <button 
                             onClick={() => handleDeleteEmployee(emp.id)}
                             className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition"
                         >
                             <Trash2 size={16} />
                         </button>
                         </td>
                     </tr>
                     ))}
                 </tbody>
                 </table>
             </div>
         </div>
        )}

        {/* ... (Existing Settings Tab Code) ... */}
        {activeTab === 'settings' && isAdmin && (
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <Settings className="text-primary" size={20} /> Configurações do Sistema
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Personalize a identidade visual e dados da sua empresa.</p>
                    </div>
                    <div className="p-8 space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Aplicativo</label>
                            <input 
                                type="text" 
                                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-primary focus:outline-none"
                                value={settingsForm.appName}
                                onChange={e => setSettingsForm({...settingsForm, appName: e.target.value})}
                                placeholder="Ex: Minha Empresa"
                            />
                        </div>

                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Razão Social</label>
                            <input 
                                type="text" 
                                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-primary focus:outline-none"
                                value={settingsForm.businessName || ''}
                                onChange={e => setSettingsForm({...settingsForm, businessName: e.target.value})}
                                placeholder="Ex: Minha Empresa LTDA"
                            />
                        </div>

                         <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">CNPJ</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-primary focus:outline-none"
                                    value={settingsForm.cnpj || ''}
                                    onChange={e => setSettingsForm({...settingsForm, cnpj: e.target.value})}
                                    placeholder="00.000.000/0000-00"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Cidade</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-primary focus:outline-none"
                                    value={settingsForm.city || ''}
                                    onChange={e => setSettingsForm({...settingsForm, city: e.target.value})}
                                    placeholder="Ex: São Paulo"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Logo do Aplicativo</label>
                            <div className="flex items-center gap-6">
                                <div className="w-24 h-24 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                                    {settingsForm.logoUrl ? (
                                        <img src={settingsForm.logoUrl} alt="Logo Preview" className="w-full h-full object-contain" />
                                    ) : (
                                        <ImageIcon className="text-gray-300" size={32} />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                                        <Upload size={16} /> Escolher Imagem
                                        <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                                    </label>
                                    <p className="text-xs text-gray-500 mt-2">Recomendado: Imagem PNG com fundo transparente.</p>
                                    {settingsForm.logoUrl && (
                                        <button 
                                            onClick={() => setSettingsForm({...settingsForm, logoUrl: ''})}
                                            className="mt-2 text-xs text-red-500 hover:text-red-700 font-medium"
                                        >
                                            Remover Logo
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100 flex justify-end">
                            <button 
                                onClick={handleSaveSettings}
                                className="bg-primary hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 font-medium transition shadow-sm"
                            >
                                <Save size={18} /> Salvar Alterações
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* ... (Existing Subscription Tab Code) ... */}
        {activeTab === 'subscription' && isAdmin && (
            <div className="max-w-3xl mx-auto">
                {/* ... (Subscription UI code omitted for brevity as it is unchanged) ... */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white">
                        <div className="flex justify-between items-start">
                             <div>
                                <h2 className="text-2xl font-bold mb-1">Minha Assinatura</h2>
                                <p className="text-blue-100">Gerencie os detalhes do seu plano Rastreaê.</p>
                             </div>
                             <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
                                 <CreditCard size={32} />
                             </div>
                        </div>
                    </div>
                    
                    <div className="p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Plano Atual</label>
                                    <div className="text-3xl font-bold text-gray-800 mt-1">{currentUser.plan || 'Plano Básico'}</div>
                                    <span className={`inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium 
                                        ${currentUser.companyStatus === 'active' ? 'bg-green-100 text-green-700' : 
                                          currentUser.companyStatus === 'trial' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                        {currentUser.companyStatus === 'active' && 'Assinatura Ativa'}
                                        {currentUser.companyStatus === 'trial' && 'Período de Teste'}
                                        {currentUser.companyStatus === 'pending_payment' && 'Pagamento Pendente'}
                                        {currentUser.companyStatus === 'inactive' && 'Suspenso'}
                                    </span>
                                </div>
                                
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                                            <Calendar size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">Próximo Vencimento</p>
                                            <p className="text-xs text-gray-500">Mantenha em dia para evitar bloqueios.</p>
                                        </div>
                                    </div>
                                    <div className="text-xl font-bold text-gray-800 pl-11">
                                        {currentUser.companyStatus === 'trial' 
                                            ? formatDatePTBR(currentUser.trial_ends_at) 
                                            : formatDatePTBR(currentUser.next_payment_due)
                                        }
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col justify-center items-center bg-gray-50 rounded-xl border border-gray-200 p-6 text-center">
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">Precisa renovar?</h3>
                                <p className="text-sm text-gray-500 mb-6">Realize o pagamento de forma segura via Mercado Pago e libere o acesso instantaneamente.</p>
                                <button 
                                    onClick={handlePaySubscription}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl shadow-md transition transform hover:-translate-y-1 flex items-center justify-center gap-2"
                                >
                                    <CreditCard size={20} />
                                    Pagar Fatura
                                </button>
                                <p className="text-xs text-gray-400 mt-4 flex items-center gap-1">
                                    <Lock size={12} /> Pagamento seguro e criptografado
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

      </div>

      {/* ... (Existing New Employee Modal) ... */}
      {showNewEmployeeModal && isAdmin && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg text-gray-800">Novo Funcionário</h3>
                    <button onClick={() => setShowNewEmployeeModal(false)}><X className="text-gray-400 hover:text-gray-600" /></button>
                </div>
                <div className="p-6 space-y-4">
                    {/* ... (Content of employee modal unchanged) ... */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                        <input 
                            type="text" 
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary focus:outline-none"
                            value={newEmployeeForm.name}
                            onChange={e => setNewEmployeeForm({...newEmployeeForm, name: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                        <div className="relative">
                            <Briefcase className="absolute left-3 top-3 text-gray-400" size={18} />
                            <input 
                                type="text" 
                                className="w-full border border-gray-300 rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-primary focus:outline-none"
                                value={newEmployeeForm.role}
                                onChange={e => setNewEmployeeForm({...newEmployeeForm, role: e.target.value})}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Contato (Email/Tel)</label>
                        <input 
                            type="text" 
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary focus:outline-none"
                            value={newEmployeeForm.contact}
                            onChange={e => setNewEmployeeForm({...newEmployeeForm, contact: e.target.value})}
                        />
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                        <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <Lock size={16} /> Credenciais de Acesso
                        </h4>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                             <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Login</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-primary focus:outline-none text-sm"
                                    value={newEmployeeForm.login}
                                    onChange={e => setNewEmployeeForm({...newEmployeeForm, login: e.target.value})}
                                />
                             </div>
                             <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Senha</label>
                                <input 
                                    type="password" 
                                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-primary focus:outline-none text-sm"
                                    value={newEmployeeForm.password}
                                    onChange={e => setNewEmployeeForm({...newEmployeeForm, password: e.target.value})}
                                />
                             </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Nível de Acesso</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="accessLevel"
                                        checked={newEmployeeForm.accessLevel === 'user'}
                                        onChange={() => setNewEmployeeForm({...newEmployeeForm, accessLevel: 'user'})}
                                        className="text-primary focus:ring-primary"
                                    />
                                    <span className="text-sm text-gray-700">Usuário (Restrito)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="accessLevel"
                                        checked={newEmployeeForm.accessLevel === 'admin'}
                                        onChange={() => setNewEmployeeForm({...newEmployeeForm, accessLevel: 'admin'})}
                                        className="text-primary focus:ring-primary"
                                    />
                                    <span className="text-sm text-gray-700 font-semibold text-purple-700">Administrador</span>
                                </label>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                * Usuários não podem excluir pedidos nem gerenciar funcionários.
                            </p>
                        </div>
                    </div>

                    <button 
                        onClick={handleSubmitEmployee} 
                        className="w-full bg-primary text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 mt-2"
                    >
                        Cadastrar Funcionário
                    </button>
                </div>
            </div>
          </div>
      )}

      {/* ... (Order Modal - UPDATED for Quote Logic) ... */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800">
                  {isEditingFullOrder ? `Editar ${activeTab === 'quotes' ? 'Orçamento' : 'Pedido'}` : `Cadastrar Novo ${activeTab === 'quotes' ? 'Orçamento' : 'Pedido'}`}
              </h3>
              <button onClick={() => setShowOrderModal(false)}><X className="text-gray-400 hover:text-gray-600" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Cliente & Contato */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Cliente <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary focus:outline-none"
                      value={orderForm.customerName}
                      onChange={e => setOrderForm({...orderForm, customerName: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Celular / Contato <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <Phone size={18} className="absolute left-3 top-3 text-gray-400" />
                        <input 
                        type="text" 
                        className="w-full border border-gray-300 rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-primary focus:outline-none"
                        value={orderForm.customerPhone}
                        onChange={e => setOrderForm({...orderForm, customerPhone: e.target.value})}
                        placeholder="(00) 00000-0000"
                        />
                    </div>
                  </div>
              </div>

              {/* Endereço */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço de Entrega</label>
                <div className="relative">
                    <MapPin size={18} className="absolute left-3 top-3 text-gray-400" />
                    <input 
                    type="text" 
                    className="w-full border border-gray-300 rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-primary focus:outline-none"
                    value={orderForm.shippingAddress}
                    onChange={e => setOrderForm({...orderForm, shippingAddress: e.target.value})}
                    />
                </div>
              </div>

              {/* Datas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data {orderForm.isQuote ? 'do Orçamento' : 'do Pedido'} <span className="text-red-500">*</span></label>
                    <input 
                      type="date" 
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary focus:outline-none"
                      value={orderForm.orderDate}
                      onChange={e => setOrderForm({...orderForm, orderDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{orderForm.isQuote ? 'Prazo de Entrega' : 'Data de Entrega Prevista'}</label>
                    <input 
                      type="date" 
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary focus:outline-none"
                      value={orderForm.estimatedDelivery}
                      onChange={e => setOrderForm({...orderForm, estimatedDelivery: e.target.value})}
                    />
                  </div>
              </div>

              {/* Campos Extras para Orçamento */}
              {orderForm.isQuote && (
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Validade do Orçamento</label>
                      <input 
                          type="text" 
                          placeholder="Ex: 5 dias úteis"
                          className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary focus:outline-none"
                          value={orderForm.quoteValidity || ''}
                          onChange={e => setOrderForm({...orderForm, quoteValidity: e.target.value})}
                      />
                  </div>
              )}

              {/* Seção de Produção - Apenas para Edição de PEDIDOS (não orçamentos) */}
              {isEditingFullOrder && !orderForm.isQuote && (
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                          <Shirt size={18} /> Dados de Produção
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Data de Prensagem</label>
                            <input 
                            type="date" 
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary focus:outline-none"
                            value={orderForm.pressingDate || ''}
                            onChange={e => setOrderForm({...orderForm, pressingDate: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Costureira</label>
                            <div className="relative">
                                <Scissors size={18} className="absolute left-3 top-3 text-gray-400" />
                                <input 
                                type="text" 
                                placeholder="Nome da profissional"
                                className="w-full border border-gray-300 rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-primary focus:outline-none"
                                value={orderForm.seamstress || ''}
                                onChange={e => setOrderForm({...orderForm, seamstress: e.target.value})}
                                />
                            </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Data de Impressão</label>
                            <input 
                            type="date" 
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary focus:outline-none"
                            value={orderForm.printingDate || ''}
                            onChange={e => setOrderForm({...orderForm, printingDate: e.target.value})}
                            />
                        </div>
                      </div>
                  </div>
              )}
              
              {/* Fotos */}
              <div className="border-t border-gray-100 pt-4">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Camera size={18} /> Fotos do Pedido (Máx: 6)
                  </h4>
                  <div className="flex gap-4 items-start flex-wrap">
                      {orderForm.photos.map((photo, index) => (
                          <div key={index} className="relative w-20 h-20 rounded-lg border border-gray-300 overflow-hidden group">
                              <img src={photo} alt="Preview" className="w-full h-full object-cover" />
                              <button 
                                onClick={() => handleRemovePhoto(index)}
                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                              >
                                  <X size={12} />
                              </button>
                          </div>
                      ))}
                      
                      {orderForm.photos.length < 6 && (
                          <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:text-primary text-gray-400 transition">
                              <Upload size={20} />
                              <span className="text-xs mt-1">Add</span>
                              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                          </label>
                      )}
                  </div>
              </div>

              {/* Financeiro */}
              <div className="border-t border-gray-100 pt-4">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <DollarSign size={18} /> Financeiro
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pagamento (Entrada)</label>
                        <select 
                            className="w-full border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                            value={orderForm.paymentMethod}
                            onChange={e => setOrderForm({...orderForm, paymentMethod: e.target.value})}
                        >
                            <option value="Pix">Pix</option>
                            <option value="Dinheiro">Dinheiro</option>
                            <option value="Cartão de Crédito">Cartão de Crédito</option>
                            <option value="Cartão de Débito">Cartão de Débito</option>
                            <option value="Boleto">Boleto</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Valor de Entrada (R$)</label>
                        <input 
                        type="number" 
                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary focus:outline-none"
                        value={orderForm.downPayment}
                        onChange={e => setOrderForm({...orderForm, downPayment: Number(e.target.value)})}
                        />
                    </div>
                  </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <label className="block text-sm font-medium text-gray-900 mb-3">Produtos <span className="text-red-500">*</span></label>
                <div className="flex gap-2 mb-2">
                  <input 
                    type="text" 
                    placeholder="Nome do produto" 
                    className="flex-1 border border-gray-300 rounded-lg p-2.5 text-sm"
                    value={tempItem.name}
                    onChange={e => setTempItem({...tempItem, name: e.target.value})}
                  />
                  <input 
                    type="text" 
                    placeholder="Tam" 
                    className="w-28 border border-gray-300 rounded-lg p-2.5 text-sm"
                    value={tempItem.size}
                    onChange={e => setTempItem({...tempItem, size: e.target.value})}
                  />
                  <input 
                    type="number" 
                    placeholder="R$" 
                    className="w-24 border border-gray-300 rounded-lg p-2.5 text-sm"
                    value={tempItem.price}
                    onChange={e => setTempItem({...tempItem, price: e.target.value})}
                  />
                  <input 
                    type="number" 
                    placeholder="Qtd" 
                    className="w-20 border border-gray-300 rounded-lg p-2.5 text-sm"
                    value={tempItem.quantity}
                    onChange={e => setTempItem({...tempItem, quantity: e.target.value})}
                  />
                  <div className="flex gap-1">
                    <button 
                        onClick={handleSaveItem}
                        className={`p-2.5 rounded-lg text-white transition ${editingItemIndex !== null ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                        title={editingItemIndex !== null ? "Salvar Alteração" : "Adicionar Item"}
                    >
                        {editingItemIndex !== null ? <Check size={20} /> : <Plus size={20} />}
                    </button>
                    {editingItemIndex !== null && (
                        <button 
                            onClick={handleCancelEditItem}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-2.5 rounded-lg"
                            title="Cancelar Edição"
                        >
                            <X size={20} />
                        </button>
                    )}
                  </div>
                </div>

                {/* Items List */}
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 max-h-32 overflow-y-auto">
                  {orderForm.items.length === 0 && <p className="text-xs text-center text-gray-400">Nenhum item adicionado</p>}
                  {orderForm.items.map((item, idx) => (
                    <div key={idx} className={`flex justify-between text-sm items-center bg-white p-2 rounded shadow-sm ${editingItemIndex === idx ? 'ring-2 ring-primary ring-offset-1' : ''}`}>
                      <div className="flex items-center gap-2">
                          <span className="text-gray-700">{item.quantity}x {item.name}</span>
                          {item.size && <span className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded font-medium">{item.size}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                          <span className="font-medium mr-2">R$ {(item.price * item.quantity).toFixed(2)}</span>
                          <button 
                            onClick={() => handleEditItem(idx)}
                            className="text-blue-400 hover:text-blue-600 p-1 hover:bg-blue-50 rounded"
                            title="Editar Item"
                          >
                              <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleRemoveItem(idx)} className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded">
                              <X size={14} />
                          </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Observação Geral */}
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações Gerais</label>
                  <textarea 
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary focus:outline-none h-24"
                      placeholder="Detalhes adicionais, instruções de produção, etc."
                      value={orderForm.notes || ''}
                      onChange={e => setOrderForm({...orderForm, notes: e.target.value})}
                  />
              </div>

            </div>
            <div className="p-4 bg-gray-50 flex justify-end gap-2 border-t border-gray-100">
              <button onClick={() => setShowOrderModal(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg">Cancelar</button>
              <button 
                onClick={handleSubmitOrder} 
                disabled={isSubmitting}
                className={`px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                  {isSubmitting ? (
                    <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processando...
                    </>
                  ) : (
                    isEditingFullOrder ? `Atualizar ${orderForm.isQuote ? 'Orçamento' : 'Pedido'}` : `Criar ${orderForm.isQuote ? 'Orçamento' : 'Pedido'}`
                  )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ... (Restante do componente permanece igual) ... */}
      {managingStatusOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
             {/* ... header ... */}
             <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="font-bold text-lg text-gray-800">Alterar Status</h3>
                <p className="text-xs text-gray-500">#{managingStatusOrder.id}</p>
              </div>
              <button onClick={() => setManagingStatusOrder(null)}><X className="text-gray-400 hover:text-gray-600" /></button>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Status Atual</h4>
                {getStatusBadge(managingStatusOrder.currentStatus)}
              </div>

              <h4 className="text-sm font-medium text-gray-900 mb-3">Atualizar para:</h4>
              <div className="space-y-2">
                {[OrderStatus.PEDIDO_FEITO, OrderStatus.EM_PRODUCAO, OrderStatus.CONCLUIDO].map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                        handleStatusChange(managingStatusOrder.id, status);
                    }}
                    disabled={status === managingStatusOrder.currentStatus}
                    className={`w-full text-left px-4 py-3 rounded-xl border flex items-center justify-between transition-all
                      ${status === managingStatusOrder.currentStatus 
                        ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed' 
                        : 'bg-white border-gray-200 hover:border-primary hover:bg-blue-50'}`}
                  >
                    <span className="font-medium text-gray-700">
                       {status === OrderStatus.PEDIDO_FEITO && '📋 Pedido Feito'}
                       {status === OrderStatus.EM_PRODUCAO && '👕 Em Produção'}
                       {status === OrderStatus.CONCLUIDO && '✅ Concluído'}
                    </span>
                    {status === managingStatusOrder.currentStatus && <CheckCircle size={16} className="text-green-500" />}
                  </button>
                ))}
              </div>
              {/* ... observation input ... */}
              <div className="mt-4">
                <label className="block text-xs text-gray-500 mb-1">Observação de Status (Opcional)</label>
                <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Ex: Pronto para retirada"
                      className="flex-1 border-b border-gray-300 py-1 text-sm focus:outline-none focus:border-primary"
                      value={updateStatusLocation}
                      onChange={e => setUpdateStatusLocation(e.target.value)}
                    />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ... (View Order Modal and Lightbox - Included in file content above) ... */}
      {viewingOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            {/* ... Modal content rendered above in full block ... */}
            <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg text-primary">
                            <Package size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-gray-800">{viewingOrder.currentStatus === OrderStatus.ORCAMENTO ? 'Orçamento' : 'Pedido'} #{viewingOrder.id}</h3>
                        </div>
                    </div>
                    <button onClick={() => setViewingOrder(null)}><X className="text-gray-400 hover:text-gray-600" /></button>
                </div>
                {/* ... The rest of the modal logic is identical to the provided full code block ... */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* ... Content ... */}
                    {/* Just ensuring the modal rendering logic is consistent with the full block provided in the change tag */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="space-y-1">
                            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Cliente</p>
                            <p className="text-lg font-medium text-gray-900">{viewingOrder.customerName}</p>
                            <p className="text-sm text-gray-600">{viewingOrder.customerPhone}</p>
                            <p className="text-sm text-gray-600 mt-1">{viewingOrder.shippingAddress}</p>
                        </div>
                        <div className="space-y-1 md:text-right">
                             <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Detalhes</p>
                             <div className="flex justify-between md:justify-end gap-2 text-sm text-gray-700">
                                 <span>Data:</span>
                                 <span className="font-medium">{viewingOrder.orderDate}</span>
                             </div>
                             <div className="flex justify-between md:justify-end gap-2 text-sm text-gray-700">
                                 <span>{viewingOrder.currentStatus === OrderStatus.ORCAMENTO ? 'Prazo:' : 'Previsão:'}</span>
                                 <span className="font-medium">{viewingOrder.estimatedDelivery}</span>
                             </div>
                             
                             {viewingOrder.currentStatus !== OrderStatus.ORCAMENTO && (
                                <>
                                 {(viewingOrder.pressingDate) && (
                                    <div className="flex justify-between md:justify-end gap-2 text-sm text-gray-700">
                                        <span>Prensagem:</span>
                                        <span className="font-medium">{formatDatePTBR(viewingOrder.pressingDate)}</span>
                                    </div>
                                 )}
                                 {(viewingOrder.printingDate) && (
                                    <div className="flex justify-between md:justify-end gap-2 text-sm text-gray-700">
                                        <span>Impressão:</span>
                                        <span className="font-medium">{formatDatePTBR(viewingOrder.printingDate)}</span>
                                    </div>
                                 )}
                                  {(viewingOrder.seamstress) && (
                                    <div className="flex justify-between md:justify-end gap-2 text-sm text-gray-700">
                                        <span>Costureira:</span>
                                        <span className="font-medium">{viewingOrder.seamstress}</span>
                                    </div>
                                 )}
                                </>
                             )}

                             {viewingOrder.currentStatus === OrderStatus.ORCAMENTO && viewingOrder.quoteValidity && (
                                 <div className="flex justify-between md:justify-end gap-2 text-sm text-purple-700">
                                     <span>Validade:</span>
                                     <span className="font-medium">{viewingOrder.quoteValidity}</span>
                                 </div>
                             )}

                             <div className="mt-2 flex md:justify-end">
                                 {getStatusBadge(viewingOrder.currentStatus)}
                             </div>
                        </div>
                    </div>
                    {/* ... Rest of modal content (Photos, Table, Financials) ... */}
                    {/* Photos */}
                    {viewingOrder.photos && viewingOrder.photos.length > 0 && (
                        <div className="mb-4">
                            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Fotos Anexadas</p>
                            <div className="grid grid-cols-4 gap-2">
                                {viewingOrder.photos.map((photo, idx) => (
                                    <div 
                                        key={idx} 
                                        className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:opacity-80 transition"
                                        onClick={() => setExpandedImage(photo)}
                                    >
                                        <img src={photo} alt="Miniatura" className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {viewingOrder.notes && (
                        <div className="mb-4 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                            <p className="text-xs font-bold text-yellow-800 uppercase mb-1">Observações</p>
                            <p className="text-sm text-yellow-900">{viewingOrder.notes}</p>
                        </div>
                    )}

                    <div className="bg-gray-50 rounded-xl overflow-hidden mb-4 border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Tam</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Qtd</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor Un.</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {viewingOrder.items.map((item, idx) => (
                                    <tr key={idx} className="even:bg-white odd:bg-gray-50/50">
                                        <td className="px-4 py-3 text-sm text-gray-900 flex items-center gap-2">
                                            <div className="w-8 h-8 rounded border border-gray-200 bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                                                {appSettings.logoUrl ? (
                                                    <img src={appSettings.logoUrl} alt="Logo" className="w-full h-full object-contain p-0.5" />
                                                ) : (
                                                    <ShoppingCart className="text-gray-400" size={16} />
                                                )}
                                            </div>
                                            {item.name}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-center text-gray-600">{item.size || '-'}</td>
                                        <td className="px-4 py-3 text-sm text-center text-gray-600">{item.quantity}</td>
                                        <td className="px-4 py-3 text-sm text-right text-gray-600">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price * item.quantity)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end mb-6">
                        <div className="w-full md:w-1/2 bg-white rounded-xl border border-gray-200 overflow-hidden">
                             <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                                 <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total por Tamanho</h4>
                             </div>
                             <table className="min-w-full divide-y divide-gray-100">
                                <tbody>
                                    {Object.entries(getSizeSummary(viewingOrder.items).summary).map(([size, qty]) => (
                                        <tr key={size}>
                                            <td className="px-4 py-2 text-sm text-gray-600">{size}</td>
                                            <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">{qty}</td>
                                        </tr>
                                    ))}
                                     <tr className="bg-gray-50 font-bold">
                                         <td className="px-4 py-2 text-sm text-gray-800">TOTAL DE ITENS</td>
                                         <td className="px-4 py-2 text-sm text-gray-800 text-right">{getSizeSummary(viewingOrder.items).totalItems}</td>
                                     </tr>
                                </tbody>
                             </table>
                        </div>
                    </div>

                    {/* Financials (Same logic) */}
                    <div className="border-t border-gray-100 pt-6">
                        <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                             <DollarSign size={18} /> Resumo Financeiro
                        </h4>
                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 space-y-4">
                             <div className="flex flex-col md:flex-row justify-between gap-6">
                                 <div className="flex-1 space-y-2">
                                     <div className="flex justify-between items-center text-sm">
                                         <span className="text-gray-600">Total:</span>
                                         <span className="font-bold text-lg text-gray-900">
                                             {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(viewingOrder.total)}
                                         </span>
                                     </div>
                                     <div className="flex justify-between items-center text-sm">
                                         <span className="text-gray-600">Pago:</span>
                                         <span className="font-medium text-green-600">
                                             {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(viewingOrder.downPayment || 0)}
                                         </span>
                                     </div>
                                     <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                                         <span className="font-medium text-gray-800">Restante:</span>
                                         <span className={`font-bold text-lg ${(viewingOrder.total - viewingOrder.downPayment) > 0.01 ? 'text-red-600' : 'text-green-600'}`}>
                                             {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.max(0, viewingOrder.total - viewingOrder.downPayment))}
                                         </span>
                                     </div>
                                 </div>
                                 
                                 <div className="flex-1 border-l border-gray-200 pl-6">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Histórico de Pagamento</p>
                                    <div className="bg-white p-3 rounded-lg border border-gray-200 text-sm text-gray-700 space-y-1">
                                        {viewingOrder.paymentMethod ? (
                                            viewingOrder.paymentMethod.split(' + ').map((method, i) => (
                                                <div key={i} className="flex items-center justify-between py-1 group">
                                                    <div className="flex items-center gap-2">
                                                        <CreditCard size={14} className="text-gray-400" />
                                                        <span>{method.trim()}</span>
                                                    </div>
                                                    {isAdmin && (
                                                        <button 
                                                            onClick={() => handleRemovePayment(i)}
                                                            className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                                                            title="Excluir este pagamento"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <span className="text-gray-400 italic">Nenhum pagamento registrado</span>
                                        )}
                                    </div>
                                 </div>
                             </div>

                             {(viewingOrder.total - viewingOrder.downPayment) > 0.01 && (
                                 <div className="pt-4 border-t border-gray-200">
                                     <label className="block text-xs font-medium text-blue-800 mb-2">Adicionar Pagamento (Baixa):</label>
                                     <div className="flex flex-col sm:flex-row gap-2">
                                         <select 
                                             className="w-full sm:w-40 border border-blue-200 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                             value={paymentMethodRemaining}
                                             onChange={e => setPaymentMethodRemaining(e.target.value)}
                                         >
                                             <option value="Pix">Pix</option>
                                             <option value="Dinheiro">Dinheiro</option>
                                             <option value="Cartão de Crédito">Cartão de Crédito</option>
                                             <option value="Cartão de Débito">Cartão de Débito</option>
                                         </select>
                                         <div className="flex gap-2 flex-1">
                                            <input 
                                                type="number" 
                                                placeholder="Valor R$"
                                                className="flex-1 border border-blue-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                value={paymentAmount}
                                                onChange={e => setPaymentAmount(e.target.value)}
                                            />
                                            <button 
                                                onClick={handleRegisterPayment}
                                                disabled={!paymentAmount}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 whitespace-nowrap"
                                            >
                                                Confirmar
                                            </button>
                                         </div>
                                     </div>
                                 </div>
                             )}
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 flex justify-end gap-2">
                    <button 
                        onClick={handlePrintOrder} 
                        className="px-6 py-2 bg-gray-100 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-200 flex items-center gap-2"
                    >
                        <Printer size={18} /> Imprimir
                    </button>
                    <button 
                        onClick={() => setViewingOrder(null)} 
                        className="px-6 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                    >
                        Fechar
                    </button>
                </div>
            </div>
            
            {expandedImage && (
                <div 
                    className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"
                    onClick={() => setExpandedImage(null)}
                >
                    <button className="absolute top-4 right-4 text-white hover:text-gray-300"><X size={32}/></button>
                    <img 
                        src={expandedImage} 
                        className="max-h-[80vh] max-w-[90%] object-contain rounded-md" 
                        onClick={e => e.stopPropagation()} 
                    />
                </div>
            )}
        </div>
      )}

    </div>
  );
};
