import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Users, 
  ShoppingBag, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Printer, 
  Ban, 
  Barcode, 
  ArrowUpDown, 
  DollarSign, 
  Tag, 
  Layers, 
  FileText, 
  Lock,
  RefreshCw,
  Eye,
  Sliders
} from 'lucide-react';
import { POSProduct, POSCustomer, POSSale, POSSaleItem } from '../types';
import { 
  getPOSProducts, 
  createPOSProduct, 
  updatePOSProduct, 
  deletePOSProduct,
  getPOSCustomers, 
  createPOSCustomer, 
  updatePOSCustomer, 
  deletePOSCustomer,
  getPOSSales, 
  cancelPOSSale,
  getAppSettings
} from '../services/mockData';

interface POSConfigModuleProps {
  onOpenPOS?: () => void;
}

export const POSConfigModule: React.FC<POSConfigModuleProps> = ({ onOpenPOS }) => {
  const [activeSubTab, setActiveSubTab] = useState<'products' | 'customers' | 'sales'>('products');

  // Products State
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<POSProduct | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    barcode: '',
    category: '',
    unit: 'UN',
    costPrice: '',
    salePrice: '',
    stockQuantity: '',
    minStock: ''
  });

  // Customers State
  const [customers, setCustomers] = useState<POSCustomer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<POSCustomer | null>(null);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    phone: '',
    email: '',
    document: '',
    address: '',
    notes: ''
  });

  // Sales State
  const [sales, setSales] = useState<POSSale[]>([]);
  const [salesSearch, setSalesSearch] = useState('');
  const [selectedSaleForView, setSelectedSaleForView] = useState<POSSale | null>(null);
  const [companySettings, setCompanySettings] = useState<any>(null);

  // Loading
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [prods, custs, sls, sets] = await Promise.all([
        getPOSProducts(),
        getPOSCustomers(),
        getPOSSales(),
        getAppSettings()
      ]);
      setProducts(prods);
      setCustomers(custs);
      setSales(sls);
      setCompanySettings(sets);
    } catch (err) {
      console.error('Erro ao carregar dados do PDV:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  // --- Product Handlers ---
  const handleOpenProductModal = (product?: POSProduct) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: product.name,
        barcode: product.barcode || '',
        category: product.category || '',
        unit: product.unit || 'UN',
        costPrice: product.costPrice?.toString() || '0',
        salePrice: product.salePrice?.toString() || '0',
        stockQuantity: product.stockQuantity?.toString() || '0',
        minStock: product.minStock?.toString() || '0'
      });
    } else {
      setEditingProduct(null);
      setProductForm({
        name: '',
        barcode: '',
        category: '',
        unit: 'UN',
        costPrice: '0',
        salePrice: '0',
        stockQuantity: '0',
        minStock: '5'
      });
    }
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) {
      alert('Informe o nome do produto');
      return;
    }

    setSaving(true);
    try {
      const cost = parseFloat(productForm.costPrice) || 0;
      const sale = parseFloat(productForm.salePrice) || 0;
      const stock = parseFloat(productForm.stockQuantity) || 0;
      const minStock = parseFloat(productForm.minStock) || 0;

      if (editingProduct) {
        await updatePOSProduct(editingProduct.id, {
          name: productForm.name.trim(),
          barcode: productForm.barcode.trim(),
          category: productForm.category.trim(),
          unit: productForm.unit.trim(),
          costPrice: cost,
          salePrice: sale,
          stockQuantity: stock,
          minStock: minStock
        });
      } else {
        await createPOSProduct({
          name: productForm.name.trim(),
          barcode: productForm.barcode.trim(),
          category: productForm.category.trim(),
          unit: productForm.unit.trim(),
          costPrice: cost,
          salePrice: sale,
          stockQuantity: stock,
          minStock: minStock
        });
      }

      setShowProductModal(false);
      const updated = await getPOSProducts();
      setProducts(updated);
    } catch (err: any) {
      alert('Erro ao salvar produto: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!window.confirm(`Deseja realmente excluir o produto "${name}"?`)) return;
    try {
      await deletePOSProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      alert('Erro ao excluir produto: ' + (err.message || 'Erro'));
    }
  };

  // --- Customer Handlers ---
  const handleOpenCustomerModal = (customer?: POSCustomer) => {
    if (customer) {
      setEditingCustomer(customer);
      setCustomerForm({
        name: customer.name,
        phone: customer.phone || '',
        email: customer.email || '',
        document: customer.document || '',
        address: customer.address || '',
        notes: customer.notes || ''
      });
    } else {
      setEditingCustomer(null);
      setCustomerForm({
        name: '',
        phone: '',
        email: '',
        document: '',
        address: '',
        notes: ''
      });
    }
    setShowCustomerModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerForm.name.trim()) {
      alert('Informe o nome do cliente');
      return;
    }

    setSaving(true);
    try {
      if (editingCustomer) {
        await updatePOSCustomer(editingCustomer.id, {
          name: editingCustomer.isDefault ? 'CONSUMIDOR FINAL' : customerForm.name.trim(),
          phone: customerForm.phone.trim(),
          email: customerForm.email.trim(),
          document: customerForm.document.trim(),
          address: customerForm.address.trim(),
          notes: customerForm.notes.trim()
        });
      } else {
        await createPOSCustomer({
          name: customerForm.name.trim(),
          phone: customerForm.phone.trim(),
          email: customerForm.email.trim(),
          document: customerForm.document.trim(),
          address: customerForm.address.trim(),
          notes: customerForm.notes.trim()
        });
      }

      setShowCustomerModal(false);
      const updated = await getPOSCustomers();
      setCustomers(updated);
    } catch (err: any) {
      alert('Erro ao salvar cliente: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCustomer = async (customer: POSCustomer) => {
    if (customer.isDefault) {
      alert('O cliente padrão CONSUMIDOR FINAL não pode ser excluído.');
      return;
    }
    if (!window.confirm(`Deseja realmente excluir o cliente "${customer.name}"?`)) return;
    try {
      await deletePOSCustomer(customer.id);
      setCustomers(prev => prev.filter(c => c.id !== customer.id));
    } catch (err: any) {
      alert('Erro ao excluir cliente: ' + (err.message || 'Erro'));
    }
  };

  // --- Sales Handlers ---
  const handleCancelSale = async (sale: POSSale) => {
    if (sale.status === 'CANCELLED') {
      alert('Esta venda já está cancelada.');
      return;
    }
    if (!window.confirm(`Tem certeza que deseja cancelar a venda #${sale.id}? O estoque dos produtos será restaurado e o lançamento financeiro será estornado.`)) {
      return;
    }

    try {
      await cancelPOSSale(sale.id);
      alert('Venda cancelada com sucesso!');
      const [sls, prods] = await Promise.all([getPOSSales(), getPOSProducts()]);
      setSales(sls);
      setProducts(prods);
      if (selectedSaleForView && selectedSaleForView.id === sale.id) {
        setSelectedSaleForView(null);
      }
    } catch (err: any) {
      alert('Erro ao cancelar venda: ' + (err.message || 'Erro desconhecido'));
    }
  };

  // Filtered Products
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];
  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(productSearch.toLowerCase())) ||
      (p.category && p.category.toLowerCase().includes(productSearch.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Filtered Customers
  const filteredCustomers = customers.filter(c => {
    return (
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.phone && c.phone.includes(customerSearch)) ||
      (c.document && c.document.includes(customerSearch))
    );
  });

  // Filtered Sales
  const filteredSales = sales.filter(s => {
    return (
      s.id.toLowerCase().includes(salesSearch.toLowerCase()) ||
      s.customerName.toLowerCase().includes(salesSearch.toLowerCase()) ||
      s.paymentMethod.toLowerCase().includes(salesSearch.toLowerCase()) ||
      (s.sellerName && s.sellerName.toLowerCase().includes(salesSearch.toLowerCase()))
    );
  });

  // Calculated Profit Margin in modal
  const modalCost = parseFloat(productForm.costPrice) || 0;
  const modalSale = parseFloat(productForm.salePrice) || 0;
  const modalProfit = modalSale - modalCost;
  const modalMargin = modalCost > 0 ? ((modalProfit / modalCost) * 100).toFixed(1) : (modalSale > 0 ? '100' : '0');

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick PDV Access */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-red-500 text-white text-xs font-black uppercase px-2 py-0.5 rounded tracking-wide">
              Módulo PDV
            </span>
            <h2 className="text-xl font-bold">Configurações e Gestão do PDV</h2>
          </div>
          <p className="text-sm text-slate-300">
            Cadastre seus produtos com preço de custo, venda e estoque, gerencie clientes e consulte o histórico de vendas.
          </p>
        </div>

        {onOpenPOS && (
          <button
            onClick={onOpenPOS}
            className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-red-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <ShoppingBag size={20} />
            Abrir Frente de Caixa (PDV)
          </button>
        )}
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm max-w-xl">
        <button
          onClick={() => setActiveSubTab('products')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'products'
              ? 'bg-primary text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Package size={17} />
          Produtos ({products.length})
        </button>

        <button
          onClick={() => setActiveSubTab('customers')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'customers'
              ? 'bg-primary text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Users size={17} />
          Clientes ({customers.length})
        </button>

        <button
          onClick={() => setActiveSubTab('sales')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'sales'
              ? 'bg-primary text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <FileText size={17} />
          Vendas ({sales.length})
        </button>
      </div>

      {/* ========================================================= */}
      {/* SUB-TAB: PRODUTOS DO PDV */}
      {/* ========================================================= */}
      {activeSubTab === 'products' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
            <div className="flex flex-1 gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar produto por nome, código de barras ou categoria..."
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                />
              </div>

              {categories.length > 0 && (
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  <option value="all">Todas Categorias</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
            </div>

            <button
              onClick={() => handleOpenProductModal()}
              className="flex items-center justify-center gap-2 bg-primary hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition shadow-sm"
            >
              <Plus size={18} />
              Cadastrar Novo Produto
            </button>
          </div>

          {/* Products Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Produto</th>
                    <th className="px-5 py-3.5">Cód. Barras</th>
                    <th className="px-5 py-3.5">Categoria</th>
                    <th className="px-5 py-3.5 text-right">Preço Custo</th>
                    <th className="px-5 py-3.5 text-right">Preço Venda</th>
                    <th className="px-5 py-3.5 text-center">Margem</th>
                    <th className="px-5 py-3.5 text-center">Estoque</th>
                    <th className="px-5 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-gray-500">
                        <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="font-medium">Nenhum produto cadastrado no PDV.</p>
                        <p className="text-xs text-gray-400 mt-1">Clique em "Cadastrar Novo Produto" para começar a vender.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(prod => {
                      const isLowStock = prod.minStock && prod.stockQuantity <= prod.minStock;
                      const profit = prod.salePrice - prod.costPrice;
                      const margin = prod.costPrice > 0 ? ((profit / prod.costPrice) * 100).toFixed(0) : '100';

                      return (
                        <tr key={prod.id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-5 py-3.5 font-medium text-gray-900">
                            <div className="flex items-center gap-2">
                              <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                                {prod.unit || 'UN'}
                              </span>
                              <div>
                                <div className="font-semibold text-gray-900">{prod.name}</div>
                                {isLowStock && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-semibold mt-0.5">
                                    <AlertTriangle size={12} /> Estoque baixo
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">
                            {prod.barcode || '-'}
                          </td>
                          <td className="px-5 py-3.5 text-gray-600">
                            {prod.category ? (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">
                                {prod.category}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-5 py-3.5 text-right font-medium text-gray-500">
                            {formatCurrency(prod.costPrice)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-gray-900">
                            {formatCurrency(prod.salePrice)}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              parseFloat(margin) >= 30 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              +{margin}%
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              prod.stockQuantity <= 0
                                ? 'bg-red-100 text-red-700'
                                : isLowStock
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {prod.stockQuantity} {prod.unit}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenProductModal(prod)}
                                className="p-1.5 text-gray-500 hover:text-primary hover:bg-blue-50 rounded-lg transition"
                                title="Editar Produto"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(prod.id, prod.name)}
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Excluir Produto"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-TAB: CLIENTES DO PDV */}
      {/* ========================================================= */}
      {activeSubTab === 'customers' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Buscar cliente por nome, telefone ou CPF..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
              />
            </div>

            <button
              onClick={() => handleOpenCustomerModal()}
              className="flex items-center justify-center gap-2 bg-primary hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition shadow-sm"
            >
              <Plus size={18} />
              Cadastrar Novo Cliente
            </button>
          </div>

          {/* Customers Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Nome do Cliente</th>
                    <th className="px-5 py-3.5">Telefone / WhatsApp</th>
                    <th className="px-5 py-3.5">E-mail</th>
                    <th className="px-5 py-3.5">CPF / CNPJ</th>
                    <th className="px-5 py-3.5">Tipo</th>
                    <th className="px-5 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCustomers.map(cust => (
                    <tr key={cust.id} className={`hover:bg-gray-50/70 transition-colors ${cust.isDefault ? 'bg-amber-50/30' : ''}`}>
                      <td className="px-5 py-3.5 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                            cust.isDefault ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {cust.isDefault ? 'CF' : cust.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 flex items-center gap-2">
                              {cust.name}
                              {cust.isDefault && (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                                  <Lock size={10} /> Padrão do Sistema
                                </span>
                              )}
                            </div>
                            {cust.address && (
                              <div className="text-xs text-gray-400 truncate max-w-xs">{cust.address}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 font-mono text-xs">
                        {cust.phone || '-'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">
                        {cust.email || '-'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 font-mono text-xs">
                        {cust.document || '-'}
                      </td>
                      <td className="px-5 py-3.5">
                        {cust.isDefault ? (
                          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-semibold">
                            Não Excluível
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                            Cadastrado
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenCustomerModal(cust)}
                            className="p-1.5 text-gray-500 hover:text-primary hover:bg-blue-50 rounded-lg transition"
                            title="Editar Cliente"
                          >
                            <Edit2 size={16} />
                          </button>
                          
                          {cust.isDefault ? (
                            <span 
                              className="p-1.5 text-gray-300 cursor-not-allowed" 
                              title="O cliente CONSUMIDOR FINAL não pode ser excluído"
                            >
                              <Lock size={16} />
                            </span>
                          ) : (
                            <button
                              onClick={() => handleDeleteCustomer(cust)}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Excluir Cliente"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-TAB: HISTÓRICO DE VENDAS DO PDV */}
      {/* ========================================================= */}
      {activeSubTab === 'sales' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Buscar venda por código, cliente, pagamento ou vendedor..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                value={salesSearch}
                onChange={e => setSalesSearch(e.target.value)}
              />
            </div>

            <button
              onClick={loadAllData}
              className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium transition"
            >
              <RefreshCw size={16} />
              Atualizar Vendas
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Cód. Venda</th>
                    <th className="px-5 py-3.5">Data / Hora</th>
                    <th className="px-5 py-3.5">Cliente</th>
                    <th className="px-5 py-3.5">Forma de Pagamento</th>
                    <th className="px-5 py-3.5">Vendedor</th>
                    <th className="px-5 py-3.5 text-right">Total</th>
                    <th className="px-5 py-3.5 text-center">Status</th>
                    <th className="px-5 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-gray-500">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="font-medium">Nenhuma venda realizada no PDV ainda.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map(sale => {
                      const isCancelled = sale.status === 'CANCELLED';
                      const formattedDate = new Date(sale.createdAt).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });

                      return (
                        <tr key={sale.id} className={`hover:bg-gray-50/70 transition-colors ${isCancelled ? 'opacity-60 bg-red-50/20' : ''}`}>
                          <td className="px-5 py-3.5 font-mono font-bold text-gray-900">
                            #{sale.id}
                          </td>
                          <td className="px-5 py-3.5 text-gray-600 text-xs">
                            {formattedDate}
                          </td>
                          <td className="px-5 py-3.5 font-medium text-gray-800">
                            {sale.customerName}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold">
                              {sale.paymentMethod}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-gray-600 text-xs">
                            {sale.sellerName || '-'}
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-gray-900">
                            {formatCurrency(sale.total)}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            {isCancelled ? (
                              <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                                CANCELADA
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">
                                CONCLUÍDA
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedSaleForView(sale)}
                                className="p-1.5 text-gray-600 hover:text-primary hover:bg-blue-50 rounded-lg transition"
                                title="Ver Comprovante / Detalhes"
                              >
                                <Eye size={16} />
                              </button>
                              {!isCancelled && (
                                <button
                                  onClick={() => handleCancelSale(sale)}
                                  className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                  title="Cancelar Venda (Devolve estoque)"
                                >
                                  <Ban size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CADASTRO / EDIÇÃO DE PRODUTO */}
      {/* ========================================================= */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 my-8">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {editingProduct ? 'Editar Produto do PDV' : 'Cadastrar Novo Produto'}
                  </h3>
                  <p className="text-xs text-gray-500">Defina os valores de custo, venda e estoque</p>
                </div>
              </div>
              <button
                onClick={() => setShowProductModal(false)}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Nome do Produto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Camiseta Básica Algodão, Caneca Térmica..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  value={productForm.name}
                  onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Cód. Barras / SKU
                  </label>
                  <input
                    type="text"
                    placeholder="789000000000"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none font-mono"
                    value={productForm.barcode}
                    onChange={e => setProductForm({ ...productForm, barcode: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Categoria
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Vestuário, Brindes..."
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    value={productForm.category}
                    onChange={e => setProductForm({ ...productForm, category: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Unidade
                  </label>
                  <select
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    value={productForm.unit}
                    onChange={e => setProductForm({ ...productForm, unit: e.target.value })}
                  >
                    <option value="UN">UN (Unidade)</option>
                    <option value="PC">PC (Peça)</option>
                    <option value="KG">KG (Quilo)</option>
                    <option value="MT">MT (Metro)</option>
                    <option value="CX">CX (Caixa)</option>
                    <option value="PAR">PAR (Par)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Preço de Custo (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none font-semibold text-gray-700"
                    value={productForm.costPrice}
                    onChange={e => setProductForm({ ...productForm, costPrice: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Preço de Venda (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none font-bold text-gray-900"
                    value={productForm.salePrice}
                    onChange={e => setProductForm({ ...productForm, salePrice: e.target.value })}
                  />
                </div>
              </div>

              {/* Profit & Markup indicator */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Lucro Bruto estimado por unidade:</span>
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${modalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(modalProfit)}
                  </span>
                  <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                    Margem: +{modalMargin}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Qtd em Estoque *
                  </label>
                  <input
                    type="number"
                    step="1"
                    required
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none font-bold"
                    value={productForm.stockQuantity}
                    onChange={e => setProductForm({ ...productForm, stockQuantity: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Estoque Mínimo (Alerta)
                  </label>
                  <input
                    type="number"
                    step="1"
                    placeholder="5"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    value={productForm.minStock}
                    onChange={e => setProductForm({ ...productForm, minStock: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-primary hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : editingProduct ? 'Salvar Alterações' : 'Criar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CADASTRO / EDIÇÃO DE CLIENTE */}
      {/* ========================================================= */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 my-8">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {editingCustomer ? 'Editar Cliente do PDV' : 'Cadastrar Novo Cliente'}
                  </h3>
                  <p className="text-xs text-gray-500">Identificação para vendas e emissão de comprovantes</p>
                </div>
              </div>
              <button
                onClick={() => setShowCustomerModal(false)}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  disabled={editingCustomer?.isDefault}
                  placeholder="Nome do cliente"
                  className={`w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none ${
                    editingCustomer?.isDefault ? 'opacity-70 bg-gray-100 cursor-not-allowed' : ''
                  }`}
                  value={customerForm.name}
                  onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })}
                />
                {editingCustomer?.isDefault && (
                  <p className="text-[11px] text-amber-600 font-medium">
                    * O nome do cliente padrão do sistema não pode ser alterado.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="(00) 00000-0000"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    value={customerForm.phone}
                    onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    CPF / CNPJ
                  </label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none font-mono"
                    value={customerForm.document}
                    onChange={e => setCustomerForm({ ...customerForm, document: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  E-mail
                </label>
                <input
                  type="email"
                  placeholder="cliente@email.com"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  value={customerForm.email}
                  onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Endereço
                </label>
                <input
                  type="text"
                  placeholder="Rua, Número, Bairro, Cidade..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  value={customerForm.address}
                  onChange={e => setCustomerForm({ ...customerForm, address: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Observações
                </label>
                <textarea
                  rows={2}
                  placeholder="Informações adicionais sobre o cliente..."
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                  value={customerForm.notes}
                  onChange={e => setCustomerForm({ ...customerForm, notes: e.target.value })}
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-primary hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : editingCustomer ? 'Salvar Alterações' : 'Criar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: VISUALIZAR COMPROVANTE DE VENDA */}
      {/* ========================================================= */}
      {selectedSaleForView && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 my-8">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between no-print">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <FileText size={18} className="text-primary" />
                Comprovante de Venda #{selectedSaleForView.id}
              </h3>
              <button
                onClick={() => setSelectedSaleForView(null)}
                className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-xl transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Thermal Receipt Visual */}
            <div className="p-6 bg-slate-50 font-mono text-xs text-gray-800 space-y-4 printable-receipt">
              <div className="text-center border-b border-dashed border-gray-300 pb-3">
                <div className="font-bold text-sm tracking-wider uppercase">
                  {companySettings?.businessName || companySettings?.appName || 'EMPRESA'}
                </div>
                {companySettings?.cnpj && <div>CNPJ: {companySettings.cnpj}</div>}
                {companySettings?.address && <div>{companySettings.address}</div>}
                <div className="mt-1 font-sans text-[11px] text-gray-500 font-bold uppercase tracking-widest">
                  DOCUMENTO NÃO FISCAL
                </div>
              </div>

              <div className="border-b border-dashed border-gray-300 pb-2 space-y-1">
                <div>VENDA: #{selectedSaleForView.id}</div>
                <div>DATA: {new Date(selectedSaleForView.createdAt).toLocaleString('pt-BR')}</div>
                <div>CLIENTE: {selectedSaleForView.customerName}</div>
                {selectedSaleForView.sellerName && <div>VENDEDOR: {selectedSaleForView.sellerName}</div>}
              </div>

              {/* Items */}
              <div className="border-b border-dashed border-gray-300 pb-3 space-y-1.5">
                <div className="flex justify-between font-bold text-[11px] uppercase border-b border-gray-200 pb-1">
                  <span>ITEM</span>
                  <span>QTD x UNIT</span>
                  <span>TOTAL</span>
                </div>
                {selectedSaleForView.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[11px]">
                    <div className="truncate max-w-[140px] font-semibold">{item.productName}</div>
                    <div className="text-gray-600">{item.quantity} x {formatCurrency(item.unitPrice)}</div>
                    <div className="font-bold">{formatCurrency(item.totalPrice)}</div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-1 border-b border-dashed border-gray-300 pb-3">
                <div className="flex justify-between">
                  <span>SUBTOTAL:</span>
                  <span>{formatCurrency(selectedSaleForView.subtotal)}</span>
                </div>
                {selectedSaleForView.discount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>DESCONTO:</span>
                    <span>- {formatCurrency(selectedSaleForView.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-gray-900 pt-1 border-t border-gray-200">
                  <span>TOTAL GERAL:</span>
                  <span>{formatCurrency(selectedSaleForView.total)}</span>
                </div>
              </div>

              {/* Payment Info */}
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>FORMA DE PAGTO:</span>
                  <span className="font-bold">{selectedSaleForView.paymentMethod}</span>
                </div>
                {selectedSaleForView.amountPaid && selectedSaleForView.amountPaid > 0 && (
                  <div className="flex justify-between">
                    <span>VALOR RECEBIDO:</span>
                    <span>{formatCurrency(selectedSaleForView.amountPaid)}</span>
                  </div>
                )}
                {selectedSaleForView.changeAmount && selectedSaleForView.changeAmount > 0 ? (
                  <div className="flex justify-between font-bold text-emerald-700">
                    <span>TROCO:</span>
                    <span>{formatCurrency(selectedSaleForView.changeAmount)}</span>
                  </div>
                ) : null}
              </div>

              <div className="text-center pt-2 text-[10px] text-gray-500">
                Obrigado pela preferência! Volte sempre!
              </div>
            </div>

            <div className="p-4 bg-white border-t border-gray-100 flex items-center justify-end gap-2 no-print">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-black transition"
              >
                <Printer size={16} />
                Imprimir
              </button>
              <button
                onClick={() => setSelectedSaleForView(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
