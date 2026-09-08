import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingCart, 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  DollarSign, 
  CreditCard, 
  User, 
  UserPlus, 
  CheckCircle2, 
  ArrowLeft, 
  Printer, 
  RefreshCw, 
  X, 
  Barcode, 
  Clock, 
  ShieldCheck, 
  Sliders, 
  Percent, 
  Receipt,
  Store,
  Check,
  AlertCircle
} from 'lucide-react';
import { POSProduct, POSCustomer, POSSale } from '../types';
import { 
  getPOSProducts, 
  getPOSCustomers, 
  createPOSSale, 
  createPOSCustomer, 
  getAppSettings 
} from '../services/mockData';

interface POSModuleProps {
  currentUser?: any;
  onBackToDashboard: () => void;
  onOpenConfig?: () => void;
}

interface CartItem {
  product: POSProduct;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  totalPrice: number;
}

export const POSModule: React.FC<POSModuleProps> = ({ 
  currentUser, 
  onBackToDashboard,
  onOpenConfig
}) => {
  // Products & Customers
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [customers, setCustomers] = useState<POSCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<POSCustomer | null>(null);
  const [companySettings, setCompanySettings] = useState<any>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState<string>('0');

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<string>('Dinheiro');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [sellerName, setSellerName] = useState<string>(currentUser?.name || 'Vendedor');
  const [notes, setNotes] = useState<string>('');

  // Quick Customer Modal
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [showCustomerSelectModal, setShowCustomerSelectModal] = useState(false);
  const [customerModalSearch, setCustomerModalSearch] = useState('');
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    phone: '',
    document: '',
    email: '',
    address: ''
  });

  // Post Sale Confirmation / Receipt Modal
  const [completedSale, setCompletedSale] = useState<POSSale | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('pt-BR'));

  // Search input ref for quick autofocus
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('pt-BR'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    try {
      const [prods, custs, sets] = await Promise.all([
        getPOSProducts(),
        getPOSCustomers(),
        getAppSettings()
      ]);
      setProducts(prods);
      setCustomers(custs);
      setCompanySettings(sets);

      // Select default customer CONSUMIDOR FINAL
      const defaultCust = custs.find(c => c.isDefault) || custs[0];
      if (defaultCust) {
        setSelectedCustomer(defaultCust);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do PDV:', err);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  // Categories
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];
  const filteredProducts = products.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      p.name.toLowerCase().includes(term) ||
      (p.barcode && p.barcode.toLowerCase().includes(term)) ||
      (p.category && p.category.toLowerCase().includes(term));
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Add to Cart
  const handleAddToCart = (product: POSProduct) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => {
          if (item.product.id === product.id) {
            const nextQty = item.quantity + 1;
            return {
              ...item,
              quantity: nextQty,
              totalPrice: nextQty * item.unitPrice
            };
          }
          return item;
        });
      } else {
        return [
          ...prev,
          {
            product,
            quantity: 1,
            unitPrice: product.salePrice,
            costPrice: product.costPrice,
            totalPrice: product.salePrice
          }
        ];
      }
    });
  };

  // Update Cart Qty
  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = Math.max(1, item.quantity + delta);
          return {
            ...item,
            quantity: newQty,
            totalPrice: newQty * item.unitPrice
          };
        }
        return item;
      });
    });
  };

  const handleSetDirectQuantity = (productId: string, val: string) => {
    const parsed = parseFloat(val);
    if (isNaN(parsed) || parsed < 1) return;
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          return {
            ...item,
            quantity: parsed,
            totalPrice: parsed * item.unitPrice
          };
        }
        return item;
      });
    });
  };

  // Remove from Cart
  const handleRemoveFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  // Clear Cart
  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm('Deseja realmente limpar todo o carrinho?')) {
      setCart([]);
      setDiscountValue('0');
      setAmountPaid('');
    }
  };

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + item.totalPrice, 0);
  const rawDiscount = parseFloat(discountValue) || 0;
  const discountAmount = discountType === 'percentage'
    ? subtotal * (rawDiscount / 100)
    : rawDiscount;
  const finalTotal = Math.max(0, subtotal - discountAmount);

  // Change (Troco)
  const paidVal = parseFloat(amountPaid) || 0;
  const changeAmount = paymentMethod === 'Dinheiro' && paidVal > finalTotal
    ? paidVal - finalTotal
    : 0;

  // Barcode / Enter key in search input: if exact barcode or single match, add immediately
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredProducts.length === 1) {
        handleAddToCart(filteredProducts[0]);
        setSearchTerm('');
      } else if (filteredProducts.length > 1) {
        // Exact barcode match?
        const exact = filteredProducts.find(p => p.barcode === searchTerm.trim());
        if (exact) {
          handleAddToCart(exact);
          setSearchTerm('');
        }
      }
    }
  };

  // Finalize Sale
  const handleFinalizeSale = async () => {
    if (cart.length === 0) {
      alert('O carrinho está vazio! Adicione ao menos um produto para continuar.');
      return;
    }

    if (paymentMethod === 'Dinheiro' && paidVal > 0 && paidVal < finalTotal) {
      alert('O valor recebido é menor que o total da venda!');
      return;
    }

    setIsSubmitting(true);
    try {
      const salePayload = {
        customerId: selectedCustomer?.id || '',
        customerName: selectedCustomer?.name || 'CONSUMIDOR FINAL',
        subtotal,
        discount: discountAmount,
        discountType,
        total: finalTotal,
        paymentMethod,
        amountPaid: paymentMethod === 'Dinheiro' ? (paidVal > 0 ? paidVal : finalTotal) : finalTotal,
        changeAmount,
        sellerName,
        notes,
        items: cart.map(item => ({
          productId: item.product.id,
          productName: item.product.name,
          unitPrice: item.unitPrice,
          costPrice: item.costPrice,
          quantity: item.quantity,
          totalPrice: item.totalPrice
        }))
      };

      const result = await createPOSSale(salePayload);
      
      // Open receipt modal
      setCompletedSale({
        ...salePayload,
        id: result.saleId,
        companyId: '',
        status: 'COMPLETED',
        createdAt: new Date().toISOString()
      });

      // Reload products to refresh stock counts
      const updatedProducts = await getPOSProducts();
      setProducts(updatedProducts);

    } catch (err: any) {
      alert('Erro ao finalizar venda: ' + (err.message || 'Erro de conexão'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset for next sale
  const handleStartNewSale = () => {
    setCart([]);
    setDiscountValue('0');
    setAmountPaid('');
    setNotes('');
    setCompletedSale(null);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // Create Quick Customer
  const handleSaveQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.name.trim()) return;

    try {
      const created = await createPOSCustomer({
        name: newCustomerForm.name.trim(),
        phone: newCustomerForm.phone.trim(),
        email: newCustomerForm.email.trim(),
        document: newCustomerForm.document.trim(),
        address: newCustomerForm.address.trim(),
        notes: ''
      });

      const updatedCusts = await getPOSCustomers();
      setCustomers(updatedCusts);
      setSelectedCustomer(created);
      setShowNewCustomerModal(false);
      setNewCustomerForm({ name: '', phone: '', document: '', email: '', address: '' });
    } catch (err: any) {
      alert('Erro ao criar cliente: ' + (err.message || 'Erro'));
    }
  };

  // Filter for customer selection modal
  const filteredModalCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerModalSearch.toLowerCase()) ||
    (c.phone && c.phone.includes(customerModalSearch)) ||
    (c.document && c.document.includes(customerModalSearch))
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none">
      {/* ========================================================= */}
      {/* TOP HEADER: CAIXA / OPERAÇÃO */}
      {/* ========================================================= */}
      <header className="bg-slate-900 text-white px-4 py-3 shadow-md flex items-center justify-between no-print z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
            title="Voltar ao Painel Administrativo"
          >
            <ArrowLeft size={16} />
            Voltar ao Painel
          </button>

          <div className="h-5 w-px bg-slate-700 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-black text-sm">
              <Store size={18} />
            </div>
            <div>
              <div className="text-sm font-bold leading-tight flex items-center gap-2">
                <span>{companySettings?.businessName || companySettings?.appName || 'PDV Frente de Caixa'}</span>
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  CAIXA LIVRE
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Operador: <strong className="text-slate-200">{sellerName}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-300 font-mono bg-slate-800 px-3 py-1.5 rounded-lg">
            <Clock size={14} className="text-slate-400" />
            {currentTime}
          </div>

          {onOpenConfig && (
            <button
              onClick={onOpenConfig}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium transition"
              title="Configurações do PDV (Produtos, Clientes, Relatórios)"
            >
              <Sliders size={15} />
              <span className="hidden sm:inline">Conf. PDV</span>
            </button>
          )}
        </div>
      </header>

      {/* ========================================================= */}
      {/* MAIN SCREEN: 2-COLUMN SPLIT */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-3 gap-3">
        {/* ======================================================= */}
        {/* LEFT COLUMN: PRODUCT CATALOG & SEARCH */}
        {/* ======================================================= */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200/80 overflow-hidden">
          {/* Search & Category Header */}
          <div className="p-4 border-b border-gray-100 space-y-3 bg-gray-50/50">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar produto por nome, código de barras [Pressione Enter para adicionar]..."
                className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition shadow-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                autoFocus
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Category Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                  selectedCategory === 'all'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                Todos ({products.length})
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
                <Barcode className="w-16 h-16 text-gray-200 mb-3" />
                <p className="font-semibold text-gray-600">Nenhum produto encontrado</p>
                <p className="text-xs text-gray-400 mt-1">
                  {products.length === 0 
                    ? 'Cadastre produtos na aba Conf. PDV para começar a vender.' 
                    : 'Tente buscar por outro termo ou categoria.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredProducts.map(product => {
                  const isOutOfStock = product.stockQuantity <= 0;
                  const isLowStock = product.minStock && product.stockQuantity <= product.minStock;

                  return (
                    <button
                      key={product.id}
                      onClick={() => handleAddToCart(product)}
                      className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between group relative ${
                        isOutOfStock
                          ? 'border-red-100 bg-red-50/20 hover:border-red-300'
                          : 'border-gray-200/80 bg-white hover:border-red-500 hover:shadow-md active:scale-95'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            {product.unit || 'UN'}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isOutOfStock
                              ? 'bg-red-100 text-red-700'
                              : isLowStock
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            Estoque: {product.stockQuantity}
                          </span>
                        </div>

                        <div className="font-semibold text-xs text-gray-800 line-clamp-2 mt-1 group-hover:text-red-600 transition">
                          {product.name}
                        </div>

                        {product.barcode && (
                          <div className="text-[10px] font-mono text-gray-400 truncate">
                            {product.barcode}
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-sm font-black text-gray-900">
                          {formatCurrency(product.salePrice)}
                        </span>
                        <span className="w-6 h-6 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs group-hover:bg-red-600 group-hover:text-white transition">
                          +
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ======================================================= */}
        {/* RIGHT COLUMN: CASHIER / CART / CHECKOUT */}
        {/* ======================================================= */}
        <div className="w-full lg:w-[440px] xl:w-[480px] bg-white rounded-2xl shadow-sm border border-gray-200/80 flex flex-col overflow-hidden">
          {/* Cashier Header: Customer Selection */}
          <div className="p-3.5 border-b border-gray-100 bg-gray-50/70 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-gray-600">
              <span className="flex items-center gap-1.5 uppercase tracking-wider">
                <User size={15} className="text-red-600" />
                Cliente Selecionado
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowCustomerSelectModal(true)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline px-1"
                >
                  Trocar
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewCustomerModal(true)}
                  className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 text-[11px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition"
                >
                  <UserPlus size={12} />
                  + Novo
                </button>
              </div>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-gray-200 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                  selectedCustomer?.isDefault ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700'
                }`}>
                  {selectedCustomer?.isDefault ? 'CF' : selectedCustomer?.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-xs text-gray-900 flex items-center gap-1.5">
                    {selectedCustomer?.name || 'CONSUMIDOR FINAL'}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {selectedCustomer?.phone || selectedCustomer?.document || 'Sem identificação'}
                  </div>
                </div>
              </div>

              {selectedCustomer?.isDefault && (
                <span className="text-[10px] bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded">
                  Padrão
                </span>
              )}
            </div>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500 font-semibold px-1">
              <span>ITENS DO CARRINHO ({cart.length})</span>
              {cart.length > 0 && (
                <button
                  onClick={handleClearCart}
                  className="text-red-500 hover:text-red-700 text-[11px] font-bold flex items-center gap-1"
                >
                  <Trash2 size={12} /> Limpar
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-gray-300">
                <ShoppingCart className="w-12 h-12 mb-2" />
                <p className="text-xs font-bold text-gray-400">Carrinho Vazio</p>
                <p className="text-[11px] text-gray-400 text-center px-4 mt-0.5">
                  Clique nos produtos ao lado ou digite o código de barras para adicionar.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {cart.map(item => (
                  <div
                    key={item.product.id}
                    className="p-2.5 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs text-gray-900 truncate">
                        {item.product.name}
                      </div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                        <span>{formatCurrency(item.unitPrice)}/{item.product.unit || 'UN'}</span>
                        <span>•</span>
                        <span className="font-bold text-gray-800">{formatCurrency(item.totalPrice)}</span>
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleUpdateQuantity(item.product.id, -1)}
                        className="w-7 h-7 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 flex items-center justify-center font-bold text-xs"
                      >
                        <Minus size={13} />
                      </button>

                      <input
                        type="number"
                        min="1"
                        className="w-11 h-7 text-center font-bold text-xs bg-white border border-gray-200 rounded-lg outline-none"
                        value={item.quantity}
                        onChange={e => handleSetDirectQuantity(item.product.id, e.target.value)}
                      />

                      <button
                        onClick={() => handleUpdateQuantity(item.product.id, 1)}
                        className="w-7 h-7 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 flex items-center justify-center font-bold text-xs"
                      >
                        <Plus size={13} />
                      </button>

                      <button
                        onClick={() => handleRemoveFromCart(item.product.id)}
                        className="w-7 h-7 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center ml-1 transition"
                        title="Remover item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checkout Controls & Totals */}
          <div className="p-4 border-t border-gray-100 bg-slate-50 space-y-3">
            {/* Discount & Totals Row */}
            <div className="bg-white p-3 rounded-xl border border-gray-200 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>Subtotal:</span>
                <span className="font-bold text-gray-800">{formatCurrency(subtotal)}</span>
              </div>

              {/* Discount Selector */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
                <div className="flex items-center gap-1 text-xs text-gray-600 font-medium">
                  <Percent size={13} className="text-gray-400" />
                  <span>Desconto:</span>
                  <button
                    type="button"
                    onClick={() => setDiscountType(prev => prev === 'fixed' ? 'percentage' : 'fixed')}
                    className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    {discountType === 'percentage' ? '%' : 'R$'}
                  </button>
                </div>

                <div className="w-24">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-right outline-none"
                    value={discountValue}
                    onChange={e => setDiscountValue(e.target.value)}
                  />
                </div>
              </div>

              {/* Grand Total */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-200 text-sm">
                <span className="font-black text-gray-900 uppercase">Total a Pagar:</span>
                <span className="text-xl font-black text-red-600">
                  {formatCurrency(finalTotal)}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                Forma de Pagamento
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'Dinheiro', label: 'Dinheiro' },
                  { id: 'Cartão de Crédito', label: 'Crédito' },
                  { id: 'Cartão de Débito', label: 'Débito' },
                  { id: 'PIX', label: 'PIX' },
                  { id: 'Boleto', label: 'Boleto' },
                  { id: 'Outro', label: 'Outro' }
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                      paymentMethod === m.id
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cash specific: Amount Paid & Change Calculator */}
            {paymentMethod === 'Dinheiro' && (
              <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-900">
                    Valor Recebido em Dinheiro:
                  </label>
                  <span className="text-[11px] text-amber-700 font-semibold">
                    Total: {formatCurrency(finalTotal)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={finalTotal.toFixed(2)}
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-amber-300 rounded-lg text-sm font-black text-gray-900 outline-none"
                      value={amountPaid}
                      onChange={e => setAmountPaid(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setAmountPaid(finalTotal.toFixed(2))}
                    className="px-2.5 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-bold rounded-lg transition shrink-0"
                  >
                    Exato
                  </button>
                </div>

                {/* Quick cash shortcut buttons */}
                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                  {[10, 20, 50, 100].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAmountPaid(val.toString())}
                      className="px-2 py-0.5 bg-white border border-amber-200 rounded text-[11px] font-bold text-amber-800 hover:bg-amber-100"
                    >
                      R$ {val}
                    </button>
                  ))}
                </div>

                {/* Change */}
                {changeAmount > 0 && (
                  <div className="bg-emerald-100 text-emerald-900 p-2 rounded-lg flex items-center justify-between font-bold text-xs">
                    <span>TROCO A DEVOLVER:</span>
                    <span className="text-sm font-black">{formatCurrency(changeAmount)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Finalize Sale Button */}
            <button
              type="button"
              disabled={cart.length === 0 || isSubmitting}
              onClick={handleFinalizeSale}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-base uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              {isSubmitting ? (
                <span>Finalizando Venda...</span>
              ) : (
                <>
                  <CheckCircle2 size={20} />
                  FINALIZAR VENDA ({formatCurrency(finalTotal)})
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL: SELECIONAR CLIENTE CADASTRADO */}
      {/* ========================================================= */}
      {showCustomerSelectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <User size={18} className="text-red-600" />
                Identificar Cliente na Venda
              </h3>
              <button
                onClick={() => setShowCustomerSelectModal(false)}
                className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Buscar por nome, telefone ou CPF..."
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-red-500/20"
                  value={customerModalSearch}
                  onChange={e => setCustomerModalSearch(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1.5 divide-y divide-gray-50">
                {filteredModalCustomers.map(cust => (
                  <button
                    key={cust.id}
                    onClick={() => {
                      setSelectedCustomer(cust);
                      setShowCustomerSelectModal(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between hover:bg-gray-50 ${
                      selectedCustomer?.id === cust.id ? 'bg-red-50/60 border border-red-200' : ''
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs text-gray-900 flex items-center gap-1.5">
                        {cust.name}
                        {cust.isDefault && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 rounded font-semibold">
                            Padrão
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {cust.phone || cust.document || 'Sem telefone'}
                      </div>
                    </div>

                    {selectedCustomer?.id === cust.id && (
                      <Check size={16} className="text-red-600" />
                    )}
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomerSelectModal(false);
                    setShowNewCustomerModal(true);
                  }}
                  className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                >
                  <UserPlus size={14} /> + Cadastrar Novo Cliente
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomerSelectModal(false)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CADASTRO RÁPIDO DE CLIENTE */}
      {/* ========================================================= */}
      {showNewCustomerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <UserPlus size={18} className="text-red-600" />
                Novo Cliente Rápido
              </h3>
              <button
                onClick={() => setShowNewCustomerModal(false)}
                className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveQuickCustomer} className="p-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Nome do Cliente *</label>
                <input
                  type="text"
                  required
                  placeholder="Nome completo"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-red-500/20"
                  value={newCustomerForm.name}
                  onChange={e => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Telefone / Whats</label>
                  <input
                    type="text"
                    placeholder="(00) 00000-0000"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none"
                    value={newCustomerForm.phone}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">CPF / CNPJ</label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none font-mono"
                    value={newCustomerForm.document}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, document: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Endereço</label>
                <input
                  type="text"
                  placeholder="Rua, Número, Bairro"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none"
                  value={newCustomerForm.address}
                  onChange={e => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                />
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewCustomerModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 text-white font-bold text-xs rounded-xl shadow hover:bg-red-700"
                >
                  Salvar e Selecionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: COMPROVANTE NÃO FISCAL / VENDA CONCLUÍDA */}
      {/* ========================================================= */}
      {completedSale && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 my-6">
            {/* Header */}
            <div className="bg-emerald-600 text-white p-4 text-center space-y-1 no-print">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-1">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="font-black text-lg">Venda Concluída!</h3>
              <p className="text-xs text-emerald-100">Estoque atualizado e financeiro integrado</p>
            </div>

            {/* Thermal Slip */}
            <div className="p-5 font-mono text-xs text-gray-800 space-y-3 bg-slate-50 border-y border-dashed border-gray-300">
              <div className="text-center pb-2 border-b border-dashed border-gray-300">
                <div className="font-bold text-sm uppercase">
                  {companySettings?.businessName || companySettings?.appName || 'EMPRESA'}
                </div>
                {companySettings?.cnpj && <div>CNPJ: {companySettings.cnpj}</div>}
                {companySettings?.address && <div>{companySettings.address}</div>}
                <div className="text-[10px] font-sans text-gray-400 font-bold uppercase tracking-widest mt-1">
                  CUPOM NÃO FISCAL
                </div>
              </div>

              <div className="pb-2 border-b border-dashed border-gray-300 space-y-0.5 text-[11px]">
                <div>VENDA: #{completedSale.id}</div>
                <div>DATA: {new Date().toLocaleString('pt-BR')}</div>
                <div>CLIENTE: {completedSale.customerName}</div>
                {completedSale.sellerName && <div>VENDEDOR: {completedSale.sellerName}</div>}
              </div>

              {/* Items */}
              <div className="pb-2 border-b border-dashed border-gray-300 space-y-1">
                <div className="flex justify-between font-bold text-[10px] uppercase text-gray-500">
                  <span>QTD x ITEM</span>
                  <span>TOTAL</span>
                </div>
                {completedSale.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <span className="truncate max-w-[180px]">
                      {item.quantity}x {item.productName}
                    </span>
                    <span className="font-bold">{formatCurrency(item.totalPrice)}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-1 pb-2 border-b border-dashed border-gray-300">
                <div className="flex justify-between">
                  <span>SUBTOTAL:</span>
                  <span>{formatCurrency(completedSale.subtotal)}</span>
                </div>
                {completedSale.discount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>DESCONTO:</span>
                    <span>- {formatCurrency(completedSale.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm text-gray-900 pt-1 border-t border-gray-200">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(completedSale.total)}</span>
                </div>
              </div>

              {/* Payment Details */}
              <div className="space-y-0.5 text-[11px]">
                <div className="flex justify-between">
                  <span>PAGAMENTO:</span>
                  <span className="font-bold">{completedSale.paymentMethod}</span>
                </div>
                {completedSale.amountPaid && completedSale.amountPaid > 0 && (
                  <div className="flex justify-between">
                    <span>VALOR PAGO:</span>
                    <span>{formatCurrency(completedSale.amountPaid)}</span>
                  </div>
                )}
                {completedSale.changeAmount && completedSale.changeAmount > 0 ? (
                  <div className="flex justify-between font-black text-emerald-700">
                    <span>TROCO:</span>
                    <span>{formatCurrency(completedSale.changeAmount)}</span>
                  </div>
                ) : null}
              </div>

              <div className="text-center pt-2 text-[10px] text-gray-400">
                Obrigado pela preferência!
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 bg-white flex flex-col gap-2 no-print">
              <button
                onClick={() => window.print()}
                className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-black transition"
              >
                <Printer size={16} />
                Imprimir Cupom
              </button>

              <button
                onClick={handleStartNewSale}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-md"
              >
                <Plus size={16} />
                Iniciar Nova Venda
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
