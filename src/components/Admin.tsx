import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, 
  query, orderBy, writeBatch, serverTimestamp 
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { Product, Order, Settings, Category, Side, ImageGallery, VariableCost, DeliveryRange, ProductSize, QuickInstruction } from '../types';
import { 
  Settings as SettingsIcon, Package, History, LogOut, Plus, Trash2, Edit2, 
  Save, X, Copy, CheckCircle2, Loader2, Layers, Image as ImageIcon,
  ArrowUp, ArrowDown, MessageCircle, MessageSquare, Calendar, Printer, Cake, Eye, EyeOff, ArrowLeft,
  DollarSign, Coins, ChevronDown, ChevronUp, Users, Download, Truck, Search, Info, Table, ShoppingBag, Calculator,
  MapPin, Navigation, ArrowUpDown, Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, removeUndefined } from '../lib/utils';
import { toast } from 'sonner';
import Footer from './Footer';
import { OrdersCalendar } from './OrdersCalendar';
import { InsumosAdmin } from './InsumosAdmin';
import { PricingAdmin } from './PricingAdmin';
import { SortMenuAdmin } from './SortMenuAdmin';
import { COUNTRY_OPTIONS, CURRENCY_OPTIONS, formatPhoneByCountry, getCleanWhatsAppPhone, getCurrencySymbol } from '../utils/countryUtils';
import { sendOrderToWhatsApp, DEFAULT_QUICK_INSTRUCTIONS, formatInstructionWhatsAppMessage } from '../utils/orderUtils';
import { geocodeAddress } from '../utils/deliveryUtils';

const getContrastText = (hexColor?: string): string => {
  if (!hexColor) return '#ffffff';
  let hex = hexColor.trim();
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  if (hex.length !== 6) return '#ffffff';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const hsp = Math.sqrt(
    0.299 * (r * r) +
    0.587 * (g * g) +
    0.114 * (b * b)
  );
  return hsp > 155 ? '#000000' : '#ffffff';
};

const getColorWithLegibility = (hexColor?: string, defaultColor: string = '#865d39'): string => {
  if (!hexColor) return defaultColor;
  let hex = hexColor.trim();
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  if (hex.length !== 6) return defaultColor;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (luminance > 0.6) {
    return defaultColor;
  }
  return `#${hex}`;
};

const handleDateMask = (value: string): string => {
  const cleanValue = value.replace(/\D/g, '').substring(0, 8);
  let formatted = '';
  if (cleanValue.length > 0) {
    formatted += cleanValue.substring(0, 2);
  }
  if (cleanValue.length > 2) {
    formatted += '/' + cleanValue.substring(2, 4);
  }
  if (cleanValue.length > 4) {
    formatted += '/' + cleanValue.substring(4, 8);
  }
  return formatted;
};

export default function Admin({ settings, setSettings, setIsAdmin }: { 
  settings: Settings, 
  setSettings: React.Dispatch<React.SetStateAction<Settings>>,
  setIsAdmin: React.Dispatch<React.SetStateAction<boolean>>
}) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [galleryIdToDelete, setGalleryIdToDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'settings' | 'menu' | 'sortMenu' | 'orders' | 'categories' | 'sides' | 'customers' | 'cakeOptions' | 'galleries' | 'finance' | 'posvenda'>('orders');
  
  // Post-Sale Instructions (Pós-Venda) State
  const [instructionsList, setInstructionsList] = useState<QuickInstruction[]>(() => {
    if (settings?.quickInstructions && settings.quickInstructions.length > 0) {
      return settings.quickInstructions;
    }
    return DEFAULT_QUICK_INSTRUCTIONS;
  });
  const [isSavingInstructions, setIsSavingInstructions] = useState(false);
  const [savingCardId, setSavingCardId] = useState<string | null>(null);

  useEffect(() => {
    if (settings?.quickInstructions && settings.quickInstructions.length > 0) {
      setInstructionsList(settings.quickInstructions);
    }
  }, [settings?.quickInstructions]);

  const handleSaveInstructions = async (targetId?: string) => {
    try {
      if (targetId) setSavingCardId(targetId);
      setIsSavingInstructions(true);
      const updatedSettings: Settings = {
        ...settings,
        quickInstructions: instructionsList
      };
      await setDoc(doc(db, 'configuracoes', 'geral'), removeUndefined(updatedSettings));
      setSettings(updatedSettings);
      toast.success(targetId ? 'Campo de instrução salvo com sucesso!' : 'Instruções de pós-venda salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar instruções:', error);
      toast.error('Erro ao salvar instruções de pós-venda.');
    } finally {
      setIsSavingInstructions(false);
      setSavingCardId(null);
    }
  };
  const [galleries, setGalleries] = useState<ImageGallery[]>([]);
  const [sides, setSides] = useState<Side[]>([]);
  const [newSide, setNewSide] = useState<Partial<Side>>({ name: '', price: 0, type: 'side' });
  const [isEditingSide, setIsEditingSide] = useState<Side | null>(null);
  const [sidePriceInput, setSidePriceInput] = useState('');
  
  // Finance States
  const [variableCosts, setVariableCosts] = useState<VariableCost[]>([]);
  const [newVarCost, setNewVarCost] = useState<Partial<VariableCost>>({ description: '', amount: 0, date: new Date().toISOString().split('T')[0] });
  const [varCostAmountInput, setVarCostAmountInput] = useState('');
  const [isEditingVarCost, setIsEditingVarCost] = useState<VariableCost | null>(null);
  const [isProportionalFixed, setIsProportionalFixed] = useState<boolean>(true);

  // Finance Dates (default to start and end of current month)
  const [financeStartDate, setFinanceStartDate] = useState<string>(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return firstDay.toISOString().split('T')[0];
  });
  const [financeEndDate, setFinanceEndDate] = useState<string>(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.toISOString().split('T')[0];
  });

  // Fixed Costs Inputs
  const [fixedRentInput, setFixedRentInput] = useState('');
  const [fixedInternetInput, setFixedInternetInput] = useState('');
  const [fixedElectricityInput, setFixedElectricityInput] = useState('');
  const [fixedWaterInput, setFixedWaterInput] = useState('');
  const [fixedGasInput, setFixedGasInput] = useState('');
  const [fixedSistemasInput, setFixedSistemasInput] = useState('');
  const [fixedMarketingInput, setFixedMarketingInput] = useState('');
  const [fixedContabilidadeInput, setFixedContabilidadeInput] = useState('');
  const [fixedSalariosInput, setFixedSalariosInput] = useState('');
  const [fixedMeiInput, setFixedMeiInput] = useState('');
  const [customFixedCosts, setCustomFixedCosts] = useState<{ label: string; amount: string }[]>([]);
  const [selectedAdminCatalogIndex, setSelectedAdminCatalogIndex] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  useEffect(() => {
    setFixedRentInput(settings?.fixedRent !== undefined ? settings.fixedRent.toString() : '');
    setFixedInternetInput(settings?.fixedInternet !== undefined ? settings.fixedInternet.toString() : '');
    setFixedElectricityInput(settings?.fixedElectricity !== undefined ? settings.fixedElectricity.toString() : '');
    setFixedWaterInput(settings?.fixedWater !== undefined ? settings.fixedWater.toString() : '');
    setFixedGasInput(settings?.fixedGas !== undefined ? settings.fixedGas.toString() : '');
    setFixedSistemasInput(settings?.fixedSistemas !== undefined ? settings.fixedSistemas.toString() : '');
    setFixedMarketingInput(settings?.fixedMarketing !== undefined ? settings.fixedMarketing.toString() : '');
    setFixedContabilidadeInput(settings?.fixedContabilidade !== undefined ? settings.fixedContabilidade.toString() : '');
    setFixedSalariosInput(settings?.fixedSalarios !== undefined ? settings.fixedSalarios.toString() : '');
    setFixedMeiInput(settings?.fixedMei !== undefined ? settings.fixedMei.toString() : '');
    setCustomFixedCosts(
      settings?.customFixedCosts !== undefined
        ? settings.customFixedCosts.map(item => ({ label: item.label, amount: item.amount.toString() }))
        : []
    );
  }, [settings]);

  
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isGeocodingOrigin, setIsGeocodingOrigin] = useState(false);

  const [isEditingProduct, setIsEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState<Omit<Product, 'id'>>({
    title: '',
    description: '',
    price: 0,
    oldPrice: 0,
    priceType: 'fixed',
    image: '',
    categoryId: '',
    secondaryCategoryId: '',
    catalogs: [],
    isMeal: true,
    isCustomCake: false,
    isCustomSandwich: false,
    customFillings: '',
    ingredients: '',
    allowedSides: [],
    isActive: true,
    hasSizes: false,
    sizes: [],
    cakeGalleryId: '',
    nutritionalInfo: {
      calories: '',
      carbs: '',
      proteins: '',
      totalFat: '',
      saturatedFat: '',
      transFat: '',
      fiber: '',
      sodium: ''
    }
  });
  const [priceInput, setPriceInput] = useState('');
  const [sizeForm, setSizeForm] = useState({ name: '', price: '', oldPrice: '' });
  const [editingSizeId, setEditingSizeId] = useState<string | null>(null);

  // Estados Módulo Marmitas & Combos (Imagens 3 a 11)
  const [itemFormat, setItemFormat] = useState<'individual' | 'combo'>('individual');
  const [hideIndividual, setHideIndividual] = useState(false);
  const [comboLimit, setComboLimit] = useState(5);
  const [allowedComboDishIds, setAllowedComboDishIds] = useState<string[]>([]);
  const [comboDishSearch, setComboDishSearch] = useState('');
  const [duplicateSourceId, setDuplicateSourceId] = useState('');
  const [sizeOptionMode, setSizeOptionMode] = useState<'single' | 'two' | 'multiple'>('single');
  const [twoSize1, setTwoSize1] = useState({ name: '300g', price: '', oldPrice: '', stock: '' });
  const [twoSize2, setTwoSize2] = useState({ name: '500g', price: '', oldPrice: '', stock: '' });
  const [multipleSizeForm, setMultipleSizeForm] = useState({ name: '', price: '', stock: '' });
  const [editingSizeIndex, setEditingSizeIndex] = useState<number | null>(null);
  const [isNutritionalExpanded, setIsNutritionalExpanded] = useState(false);
  const [trackStock, setTrackStock] = useState(false);
  const [stockQuantityInput, setStockQuantityInput] = useState('0');

  const [isEditingCategory, setIsEditingCategory] = useState<Category | null>(null);
  const [newCategory, setNewCategory] = useState({ title: '', order: 0, catalog: 'all' as 'catalog1' | 'catalog2' | 'catalog3' | 'catalog4' | 'catalog5' | 'catalog6' | 'both' | 'all' | 'catalog_b2b' });

  const [copied, setCopied] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedHistoryCatalog, setSelectedHistoryCatalog] = useState<'all' | 'catalog1' | 'catalog2' | 'catalog3' | 'catalog4' | 'catalog5' | 'catalog6'>('all');
  const [filterValidatedOnly, setFilterValidatedOnly] = useState(false);
  const [orderTypeTab, setOrderTypeTab] = useState<'retail' | 'b2b'>('retail');
  const [customerSearch, setCustomerSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showBirthdaysOnly, setShowBirthdaysOnly] = useState(false);
  const [showBatchSummary, setShowBatchSummary] = useState(false);
  const [isEditingOrder, setIsEditingOrder] = useState<Order | null>(null);
  const [isEditingCustomer, setIsEditingCustomer] = useState<any | null>(null);
  const [viewingCustomerOrders, setViewingCustomerOrders] = useState<any | null>(null);
  const [editCustomerForm, setEditCustomerForm] = useState<any>({});
  const [editOrderForm, setEditOrderForm] = useState<Partial<Order>>({});
  const [selectedProductId, setSelectedProductId] = useState('');
  const [addItemQuantity, setAddItemQuantity] = useState(1);
  const [editItemTab, setEditItemTab] = useState<'catalog' | 'custom'>('catalog');
  const [customItemTitle, setCustomItemTitle] = useState('');
  const [customItemPriceInput, setCustomItemPriceInput] = useState('');
  const [customItemQuantity, setCustomItemQuantity] = useState(1);
  const [customItemNotes, setCustomItemNotes] = useState('');

  // Min Order Comma Mask State (Imagem 6)
  const [minOrderInput, setMinOrderInput] = useState('');

  // Manual order custom item state
  const [manualItemTab, setManualItemTab] = useState<'catalog' | 'custom'>('catalog');
  const [manualCustomItemTitle, setManualCustomItemTitle] = useState('');
  const [manualCustomItemPriceInput, setManualCustomItemPriceInput] = useState('');
  const [manualCustomItemQuantity, setManualCustomItemQuantity] = useState(1);
  const [manualCustomItemNotes, setManualCustomItemNotes] = useState('');

  const getCatalogLabel = (catalogKey?: string) => {
    if (!catalogKey || catalogKey === 'all') return 'Todos os Cardápios';
    if (catalogKey === 'both') return 'Cardápios 1 e 2';
    if (catalogKey === 'catalog1') return settings?.catalog1Title || 'Cardápio 1';
    if (catalogKey === 'catalog2') return settings?.catalog2Title || 'Cardápio 2';
    if (catalogKey === 'catalog3') return settings?.catalog3Title || 'Cardápio 3';
    if (catalogKey === 'catalog4') return settings?.catalog4Title || 'Cardápio 4';
    if (catalogKey === 'catalog5') return settings?.catalog5Title || 'Cardápio 5';
    if (catalogKey === 'catalog6') return settings?.catalog6Title || 'Cardápio 6';
    return catalogKey;
  };

  const [selectedCategoryCatalog, setSelectedCategoryCatalog] = useState<string>('all');

  const categoryCatalogTabs = useMemo(() => {
    const getCount = (catalogId: string) => {
      if (catalogId === 'all') return categories.length;
      if (catalogId === 'global') return categories.filter(c => c.catalog === 'all' || !c.catalog).length;
      return categories.filter(c => 
        c.catalog === catalogId || 
        (c.catalog === 'both' && (catalogId === 'catalog1' || catalogId === 'catalog2'))
      ).length;
    };

    const tabs = [
      { id: 'all', label: '✦ Todos', count: getCount('all') },
      { id: 'catalog1', label: `1. ${settings?.catalog1Title || 'Cardápio 1'}`, count: getCount('catalog1') },
      { id: 'catalog2', label: `2. ${settings?.catalog2Title || 'Cardápio 2'}`, count: getCount('catalog2') },
      { id: 'catalog3', label: `3. ${settings?.catalog3Title || 'Cardápio 3'}`, count: getCount('catalog3') },
      { id: 'catalog4', label: `4. ${settings?.catalog4Title || 'Cardápio 4'}`, count: getCount('catalog4') },
      { id: 'catalog5', label: `5. ${settings?.catalog5Title || 'Cardápio 5'}`, count: getCount('catalog5') },
      { id: 'catalog6', label: `6. ${settings?.catalog6Title || 'Cardápio 6'}`, count: getCount('catalog6') },
    ];

    const globalCount = getCount('global');
    if (globalCount > 0) {
      tabs.push({ id: 'global', label: ' Em Todos os Menus', count: globalCount });
    }

    return tabs;
  }, [categories, settings]);

  const filteredCategoriesList = useMemo(() => {
    let list = [...categories];
    list.sort((a, b) => {
      const orderA = typeof a.order === 'number' ? a.order : 999;
      const orderB = typeof b.order === 'number' ? b.order : 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.title.localeCompare(b.title);
    });

    if (selectedCategoryCatalog === 'all') {
      return list;
    }
    if (selectedCategoryCatalog === 'global') {
      return list.filter(c => c.catalog === 'all' || !c.catalog);
    }
    return list.filter(c => 
      c.catalog === selectedCategoryCatalog || 
      (c.catalog === 'both' && (selectedCategoryCatalog === 'catalog1' || selectedCategoryCatalog === 'catalog2'))
    );
  }, [categories, selectedCategoryCatalog]);

  // Estados e Handlers para Gestão de Cidades e Taxas de Entrega (Imagens 3 e 4)
  const [cityForm, setCityForm] = useState({ cityName: '', price: '' });
  const [editingCityId, setEditingCityId] = useState<string | null>(null);
  const [freeShippingInput, setFreeShippingInput] = useState(() => {
    return settings?.deliveryFreeAbove ? settings.deliveryFreeAbove.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
  });

  const handleFreeShippingChange = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (!digits) {
      setFreeShippingInput('');
      setSettings(prev => ({ ...prev, deliveryFreeAbove: undefined }));
      return;
    }
    const num = parseInt(digits, 10) / 100;
    setFreeShippingInput(num.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    setSettings(prev => ({ ...prev, deliveryFreeAbove: num }));
  };

  const handleAddOrUpdateCity = () => {
    if (!cityForm.cityName.trim()) {
      toast.error('Informe o nome da cidade ou região.');
      return;
    }
    const digits = cityForm.price.replace(/\D/g, '');
    const priceNum = digits ? parseInt(digits, 10) / 100 : 0;

    if (editingCityId) {
      const updated = (settings.deliveryCities || []).map(c => 
        c.id === editingCityId ? { ...c, cityName: cityForm.cityName.trim(), price: priceNum } : c
      );
      setSettings(prev => ({ ...prev, deliveryCities: updated }));
      setEditingCityId(null);
      setCityForm({ cityName: '', price: '' });
      toast.success('Cidade atualizada com sucesso!');
    } else {
      const newCity = {
        id: Math.random().toString(36).substring(2, 9),
        cityName: cityForm.cityName.trim(),
        price: priceNum
      };
      setSettings(prev => ({ ...prev, deliveryCities: [...(prev.deliveryCities || []), newCity] }));
      setCityForm({ cityName: '', price: '' });
      toast.success('Cidade adicionada para entrega!');
    }
  };

  // Manual Clients and Manual Orders
  const [manualCustomers, setManualCustomers] = useState<any[]>([]);
  const [isRegisteringCustomer, setIsRegisteringCustomer] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState<any>({
    name: '',
    phone: '',
    email: '',
    birthday: '',
    isB2B: false,
    managerName: '',
    frequency: '',
    address: '',
    street: '',
    number: '',
    zipCode: '',
    city: ''
  });

  const [isAddingOrder, setIsAddingOrder] = useState(false);
  const [orderCustomerSearch, setOrderCustomerSearch] = useState('');
  const [manualOrderItems, setManualOrderItems] = useState<any[]>([]);
  const [manualOrderForm, setManualOrderForm] = useState({
    customerName: '',
    phone: '',
    email: '',
    address: '',
    street: '',
    number: '',
    zipCode: '',
    city: '',
    pickupDate: '',
    observation: '',
    birthday: ''
  });

  const [selectedManualProduct, setSelectedManualProduct] = useState<Product | null>(null);
  const [manualProductQty, setManualProductQty] = useState(1);
  const [selectedManualSize, setSelectedManualSize] = useState<any | null>(null);
  const [selectedManualMealRemovals, setSelectedManualMealRemovals] = useState<string[]>([]);
  const [selectedManualMealSides, setSelectedManualMealSides] = useState<any[]>([]);
  const [selectedManualCakeOptions, setSelectedManualCakeOptions] = useState<any>({
    size: '',
    dough: '',
    fillings: [],
    topping: '',
    topper: '',
    styleNumber: 1
  });

  const scrollToTop = () => {
    const mainContent = document.getElementById('admin-main-content');
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToTop();
  }, [activeTab]);

  useEffect(() => {
    if (settings?.minOrderValue !== undefined && settings?.minOrderValue !== null) {
      setMinOrderInput(settings.minOrderValue > 0 ? settings.minOrderValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
    }
  }, [settings?.minOrderValue]);

  const updateOrderFormWithItems = (updatedItems: any[]) => {
    const isCorp = editOrderForm.isB2B || editOrderForm.isPJ;
    const subtotalVal = updatedItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);
    if (isCorp) {
      setEditOrderForm({
        ...editOrderForm,
        items: updatedItems,
        total: subtotalVal,
        subtotal: subtotalVal,
        taxRate: 0,
        taxAmount: 0
      });
    } else {
      setEditOrderForm({
        ...editOrderForm,
        items: updatedItems,
        total: subtotalVal,
        subtotal: subtotalVal,
        taxRate: 0,
        taxAmount: 0
      });
    }
  };
  const [oldPriceInput, setOldPriceInput] = useState('');
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const uniqueCustomers = useMemo(() => {
    const customerMap = new Map<string, {
      id?: string;
      name: string;
      phone: string;
      email: string;
      birthday: string;
      address: string;
      orderLanguage?: string;
      lastOrder: any;
      totalOrders: number;
      isB2B: boolean;
      managerName: string;
      street: string;
      number: string;
      zipCode: string;
      city: string;
      frequency: string;
      orders: Order[];
      createdAt?: any;
    }>();

    orders.forEach(order => {
      const isCorp = !!(order.isB2B || order.isPJ);
      const name = isCorp ? (order.b2bCompanyName || order.customerName) : order.customerName;
      const phone = order.phone || '';
      const email = order.email || '';
      const key = phone || email || name;
      if (!key) return;

      if (!customerMap.has(key)) {
        customerMap.set(key, {
          name: name,
          phone: phone,
          email: email,
          birthday: order.birthday || '',
          address: isCorp ? (order.b2bAddress || order.address || '') : (order.address || ''),
          orderLanguage: order.orderLanguage,
          lastOrder: order.createdAt,
          totalOrders: 1,
          isB2B: isCorp,
          managerName: order.b2bManagerName || '',
          street: order.street || '',
          number: order.number || '',
          zipCode: isCorp ? (order.b2bZipCode || order.zipCode || '') : (order.zipCode || ''),
          city: isCorp ? (order.b2bCity || order.city || '') : (order.city || ''),
          frequency: order.b2bFrequency || '',
          orders: [order]
        });
      } else {
        const existing = customerMap.get(key)!;
        existing.totalOrders += 1;
        existing.orders.push(order);
        if (isCorp) {
          existing.isB2B = true;
          if (order.b2bCompanyName) existing.name = order.b2bCompanyName;
          if (order.b2bManagerName) existing.managerName = order.b2bManagerName;
          if (order.b2bAddress) existing.address = order.b2bAddress;
          if (order.b2bZipCode) existing.zipCode = order.b2bZipCode;
          if (order.b2bCity) existing.city = order.b2bCity;
          if (order.b2bFrequency) existing.frequency = order.b2bFrequency;
        } else {
          if (order.street) existing.street = order.street;
          if (order.number) existing.number = order.number;
          if (order.zipCode) existing.zipCode = order.zipCode;
          if (order.city) existing.city = order.city;
        }
        if (order.createdAt?.toDate && existing.lastOrder?.toDate) {
          if (order.createdAt.toDate() > existing.lastOrder.toDate()) {
            existing.lastOrder = order.createdAt;
            if (!isCorp) {
              existing.name = order.customerName;
              existing.birthday = order.birthday || existing.birthday;
              existing.address = order.address || existing.address;
            }
            existing.orderLanguage = order.orderLanguage || existing.orderLanguage;
          }
        }
      }
    });

    return Array.from(customerMap.values());
  }, [orders]);

  const combinedCustomers = useMemo(() => {
    const list = [...uniqueCustomers];
    manualCustomers.forEach(mc => {
      const exists = uniqueCustomers.some(uc => {
        const ucPhoneClean = (uc.phone || '').replace(/\D/g, '');
        const mcPhoneClean = (mc.phone || '').replace(/\D/g, '');
        const hasMatchingPhone = ucPhoneClean && mcPhoneClean && ucPhoneClean === mcPhoneClean;

        const ucEmailClean = (uc.email || '').trim().toLowerCase();
        const mcEmailClean = (mc.email || '').trim().toLowerCase();
        const hasMatchingEmail = ucEmailClean && mcEmailClean && ucEmailClean === mcEmailClean;

        const ucNameClean = (uc.name || '').trim().toLowerCase();
        const mcNameClean = (mc.name || '').trim().toLowerCase();
        const hasMatchingName = ucNameClean && mcNameClean && ucNameClean === mcNameClean;

        return hasMatchingPhone || hasMatchingEmail || hasMatchingName;
      });
      if (!exists) {
        list.push({
          id: mc.id,
          name: mc.name,
          phone: mc.phone || '',
          email: mc.email || '',
          birthday: mc.birthday || '',
          address: mc.address || '',
          street: mc.street || '',
          number: mc.number || '',
          zipCode: mc.zipCode || '',
          city: mc.city || '',
          totalOrders: 0,
          isB2B: mc.isB2B || false,
          managerName: mc.managerName || '',
          frequency: mc.frequency || '',
          orders: [],
          lastOrder: null,
          createdAt: mc.createdAt || null
        });
      }
    });
    return list;
  }, [uniqueCustomers, manualCustomers]);

  const slugify = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-');
  };

  const handleBrandNameChange = (name: string) => {
    setSettings(prev => ({
      ...prev,
      brandName: name,
      slug: slugify(name)
    }));
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    setLoading(true);

    const unsubProducts = onSnapshot(query(collection(db, 'produtos'), orderBy('title')), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setLoading(false);
    }, (error) => {
      console.error('Admin: Erro ao carregar produtos:', error);
      setLoading(false);
    });

    const unsubCategories = onSnapshot(query(collection(db, 'categorias'), orderBy('order', 'asc')), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    }, (error) => {
      console.error('Admin: Erro ao carregar categorias:', error);
    });

    const unsubOrders = onSnapshot(collection(db, 'pedidos'), (snapshot) => {
      const loadedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      loadedOrders.sort((a, b) => {
        const getMs = (o: Order) => {
          if (o.createdAt?.toDate) return o.createdAt.toDate().getTime();
          if (o.createdAt?.seconds) return o.createdAt.seconds * 1000;
          if (typeof o.createdAt === 'string') {
            const parsed = Date.parse(o.createdAt);
            if (!isNaN(parsed)) return parsed;
          }
          return 0;
        };
        return getMs(b) - getMs(a);
      });
      setOrders(loadedOrders);
    }, (error) => {
      console.error('Admin: Erro ao carregar pedidos:', error);
    });

    const unsubSides = onSnapshot(collection(db, 'acompanhamentos'), (snapshot) => {
      setSides(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Side)));
    }, (error) => {
      console.error('Admin: Erro ao carregar acompanhamentos:', error);
    });

    const unsubGalleries = onSnapshot(collection(db, 'galerias'), (snapshot) => {
      setGalleries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ImageGallery)));
    }, (error) => {
      console.error('Admin: Erro ao carregar galerias:', error);
    });

    const unsubVarCosts = onSnapshot(collection(db, 'custos_variaveis'), (snapshot) => {
      setVariableCosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VariableCost)));
    }, (error) => {
      console.error('Admin: Erro ao carregar custos variaveis:', error);
    });

    const unsubManualCustomers = onSnapshot(collection(db, 'clientes'), (snapshot) => {
      setManualCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error('Admin: Erro ao carregar clientes:', error);
    });

    return () => {
      unsubProducts();
      unsubCategories();
      unsubOrders();
      unsubSides();
      unsubGalleries();
      unsubVarCosts();
      unsubManualCustomers();
    };
  }, [isLoggedIn]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const correctPassword = settings?.adminPassword || 'admin123';
    if (password === correctPassword) {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.warn('Admin: Erro de autenticação anônima do Firebase:', error);
        // Não bloqueia o login se o provedor anônimo não estiver ativado no console do Firebase
      }
      setIsLoggedIn(true);
      toast.success('Login realizado com sucesso!');
    } else {
      toast.error('Senha incorreta!');
    }
  };

  const handleSaveFixedCosts = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updatedSettings = {
        ...settings,
        fixedRent: fixedRentInput ? parseFloat(fixedRentInput.replace(',', '.')) : undefined,
        fixedInternet: fixedInternetInput ? parseFloat(fixedInternetInput.replace(',', '.')) : undefined,
        fixedElectricity: fixedElectricityInput ? parseFloat(fixedElectricityInput.replace(',', '.')) : undefined,
        fixedWater: fixedWaterInput ? parseFloat(fixedWaterInput.replace(',', '.')) : undefined,
        fixedGas: fixedGasInput ? parseFloat(fixedGasInput.replace(',', '.')) : undefined,
        fixedSistemas: fixedSistemasInput ? parseFloat(fixedSistemasInput.replace(',', '.')) : undefined,
        fixedMarketing: fixedMarketingInput ? parseFloat(fixedMarketingInput.replace(',', '.')) : undefined,
        fixedContabilidade: fixedContabilidadeInput ? parseFloat(fixedContabilidadeInput.replace(',', '.')) : undefined,
        fixedSalarios: fixedSalariosInput ? parseFloat(fixedSalariosInput.replace(',', '.')) : undefined,
        fixedMei: fixedMeiInput ? parseFloat(fixedMeiInput.replace(',', '.')) : undefined,
        customFixedCosts: customFixedCosts
          .filter(item => item.label.trim() !== '' && item.amount.trim() !== '')
          .map(item => ({ label: item.label, amount: parseFloat(item.amount.replace(',', '.')) || 0 })),
      };

      if (fixedRentInput === '') delete updatedSettings.fixedRent;
      if (fixedInternetInput === '') delete updatedSettings.fixedInternet;
      if (fixedElectricityInput === '') delete updatedSettings.fixedElectricity;
      if (fixedWaterInput === '') delete updatedSettings.fixedWater;
      if (fixedGasInput === '') delete updatedSettings.fixedGas;
      if (fixedSistemasInput === '') delete updatedSettings.fixedSistemas;
      if (fixedMarketingInput === '') delete updatedSettings.fixedMarketing;
      if (fixedContabilidadeInput === '') delete updatedSettings.fixedContabilidade;
      if (fixedSalariosInput === '') delete updatedSettings.fixedSalarios;
      if (fixedMeiInput === '') delete updatedSettings.fixedMei;

      await setDoc(doc(db, 'configuracoes', 'geral'), removeUndefined(updatedSettings));
      setSettings(updatedSettings);
      toast.success('Custos fixos mensais salvos com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar custos fixos:', err);
      toast.error('Erro ao salvar custos fixos.');
    }
  };

  const handleAddVarCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVarCost.description || !varCostAmountInput) {
      toast.error('Preencha a descrição e o valor do custo variável.');
      return;
    }
    const amountVal = parseFloat(varCostAmountInput.replace(',', '.'));
    if (isNaN(amountVal) || amountVal <= 0) {
      toast.error('Digite um valor numérico válido maior que zero.');
      return;
    }

    try {
      const dataToSave = {
        description: newVarCost.description,
        amount: amountVal,
        date: newVarCost.date || new Date().toISOString().split('T')[0]
      };

      if (isEditingVarCost) {
        await updateDoc(doc(db, 'custos_variaveis', isEditingVarCost.id), dataToSave);
        toast.success('Custo variável atualizado!');
        setIsEditingVarCost(null);
      } else {
        await addDoc(collection(db, 'custos_variaveis'), dataToSave);
        toast.success('Custo variável adicionado!');
      }

      setNewVarCost({ description: '', amount: 0, date: new Date().toISOString().split('T')[0] });
      setVarCostAmountInput('');
    } catch (err) {
      console.error('Erro ao salvar custo variável:', err);
      toast.error('Erro ao salvar custo variável.');
    }
  };

  const handleDeleteVarCost = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este custo variável?')) return;
    try {
      await deleteDoc(doc(db, 'custos_variaveis', id));
      toast.success('Custo variável excluído!');
    } catch (err) {
      console.error('Erro ao excluir custo variável:', err);
      toast.error('Erro ao excluir custo variável.');
    }
  };

  const compressDataUrlIfNeeded = async (dataUrl: string, maxDim = 800, maxQuality = 0.55): Promise<string> => {
    if (!dataUrl || !dataUrl.startsWith('data:image/') || dataUrl.length < 75000) {
      return dataUrl;
    }
    return new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          let q = maxQuality;
          let res = canvas.toDataURL('image/jpeg', q);
          while (res.length > 75000 && q > 0.28) {
            q -= 0.08;
            res = canvas.toDataURL('image/jpeg', q);
          }
          resolve(res);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void, imageType: boolean | 'logo' | 'background' | 'catalog' | 'product' | 'banner' | 'tag' = 'product') => {
    const file = e.target.files?.[0];
    if (file) {
      // Compress image adaptively so it stays crisp and lightweight under Firestore limits
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          let MAX_WIDTH = 600;
          let MAX_HEIGHT = 600;
          let quality = 0.5;

          if (imageType === 'logo') {
            MAX_WIDTH = 250;
            MAX_HEIGHT = 250;
            quality = 0.6;
          } else if (imageType === 'background') {
            MAX_WIDTH = 750;
            MAX_HEIGHT = 750;
            quality = 0.45;
          } else if (imageType === 'catalog') {
            MAX_WIDTH = 450;
            MAX_HEIGHT = 450;
            quality = 0.5;
          } else if (imageType === 'banner' || imageType === 'tag') {
            MAX_WIDTH = 750;
            MAX_HEIGHT = 950;
            quality = 0.55;
          } else if (imageType === 'product') {
            MAX_WIDTH = 550;
            MAX_HEIGHT = 550;
            quality = 0.5;
          } else if (imageType === true) {
            MAX_WIDTH = 450;
            MAX_HEIGHT = 450;
            quality = 0.45;
          } else if (imageType === false) {
            MAX_WIDTH = 550;
            MAX_HEIGHT = 550;
            quality = 0.5;
          }
          
          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          let compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          let currentQuality = quality;
          // Loop de segurança de tamanho: reduz qualidade adaptativamente se exceder 75KB
          while (compressedBase64.length > 75000 && currentQuality > 0.28) {
            currentQuality -= 0.08;
            compressedBase64 = canvas.toDataURL('image/jpeg', currentQuality);
          }
          if (compressedBase64.length > 80000) {
            const scale = Math.sqrt(70000 / compressedBase64.length);
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = Math.max(320, Math.round(width * Math.min(0.85, scale)));
            tempCanvas.height = Math.max(400, Math.round(height * Math.min(0.85, scale)));
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx?.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
            compressedBase64 = tempCanvas.toDataURL('image/jpeg', 0.5);
          }

          callback(compressedBase64);
        };
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const addCakeOptionItem = (key: 'cakeSizes' | 'cakeDoughs' | 'cakeFillings' | 'cakeToppings' | 'cakeToppers', defaultValue: string = '') => {
    setSettings(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), defaultValue]
    }));
  };

  const removeCakeOptionItem = (key: 'cakeSizes' | 'cakeDoughs' | 'cakeFillings' | 'cakeToppings' | 'cakeToppers', index: number) => {
    setSettings(prev => ({
      ...prev,
      [key]: (prev[key] || []).filter((_: any, i: number) => i !== index)
    }));
  };

  const updateCakeOptionItem = (key: 'cakeSizes' | 'cakeDoughs' | 'cakeFillings' | 'cakeToppings' | 'cakeToppers', index: number, value: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: (prev[key] || []).map((v: string, i: number) => i === index ? value : v)
    }));
  };

  const saveSettings = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 10000)
      );
      
      const updatedSettings = {
        ...settings,
        whatsappNumber: formatPhoneByCountry(settings.whatsappNumber || '', settings.whatsappCountryCode || '+55'),
        whatsappCountryCode: settings.whatsappCountryCode || '+55',
        language: settings.language || 'pt',
        currency: settings.currency || 'BRL'
      };

      // Se o frete estiver ativado e tiver endereço, mas não tiver coordenadas, localiza automaticamente
      if (updatedSettings.deliveryEnabled && updatedSettings.deliveryOriginAddress?.trim() && (!updatedSettings.deliveryOriginLat || !updatedSettings.deliveryOriginLng)) {
        try {
          const autoGeo = await geocodeAddress({ street: updatedSettings.deliveryOriginAddress });
          if (autoGeo) {
            updatedSettings.deliveryOriginLat = autoGeo.lat;
            updatedSettings.deliveryOriginLng = autoGeo.lng;
            setSettings(prev => ({
              ...prev,
              deliveryOriginLat: autoGeo.lat,
              deliveryOriginLng: autoGeo.lng
            }));
          }
        } catch (geoErr) {
          console.warn('Auto geocode on saveSettings failed:', geoErr);
        }
      }
      
      // Sanitize and adaptively compress any large base64 images to prevent Firestore 1MB document limit error
      const imageKeys: (keyof Settings)[] = [
        'logo', 'backgroundImage',
        'catalog1Image', 'catalog2Image', 'catalog3Image', 'catalog4Image', 'catalog5Image', 'catalog6Image',
        'catalog1TagImage', 'catalog2TagImage', 'catalog3TagImage', 'catalog4TagImage', 'catalog5TagImage', 'catalog6TagImage'
      ];
      for (const k of imageKeys) {
        const val = updatedSettings[k];
        if (typeof val === 'string' && val.startsWith('data:image/') && val.length > 75000) {
          const isTag = k.includes('TagImage');
          const compressed = await compressDataUrlIfNeeded(val, isTag ? 800 : 600, 0.55);
          (updatedSettings as Record<string, any>)[k] = compressed;
        }
      }

      // Also persist tag images to configuracoes/catalogTags backup document
      const tagImagesData: Record<string, string> = {};
      const tagKeys = ['catalog1TagImage', 'catalog2TagImage', 'catalog3TagImage', 'catalog4TagImage', 'catalog5TagImage', 'catalog6TagImage'];
      tagKeys.forEach(k => {
        const val = updatedSettings[k as keyof Settings];
        if (typeof val === 'string' && val) {
          tagImagesData[k] = val;
        }
      });
      if (Object.keys(tagImagesData).length > 0) {
        try {
          await setDoc(doc(db, 'configuracoes', 'catalogTags'), tagImagesData, { merge: true });
        } catch (tagErr) {
          console.warn('Backup catalogTags save warning:', tagErr);
        }
      }

      try {
        await Promise.race([
          setDoc(doc(db, 'configuracoes', 'geral'), removeUndefined(updatedSettings)),
          timeoutPromise
        ]);
      } catch (firstErr) {
        console.warn('First save attempt hit size limit, stripping tag images from geral since they are in catalogTags:', firstErr);
        const stripped = { ...updatedSettings };
        tagKeys.forEach(k => {
          delete stripped[k as keyof Settings];
        });
        await setDoc(doc(db, 'configuracoes', 'geral'), removeUndefined(stripped));
      }
      
      setSettings(updatedSettings);
      toast.success('Configurações salvas com sucesso!');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Erro ao salvar configurações:', err);
      toast.error('Erro ao salvar configurações. Verifique sua conexão ou o tamanho das imagens.');
    } finally {
      setTimeout(() => setIsSaving(false), 500);
    }
  };

  const handlePriceChange = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      setPriceInput('0,00');
      setNewProduct(prev => ({ ...prev, price: 0 }));
      return;
    }
    
    const numericValue = parseInt(digits) / 100;
    const formatted = numericValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    setPriceInput(formatted);
    setNewProduct(prev => ({ ...prev, price: numericValue }));
  };

  const handleOldPriceChange = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      setOldPriceInput('0,00');
      setNewProduct(prev => ({ ...prev, oldPrice: 0 }));
      return;
    }
    
    const numericValue = parseInt(digits) / 100;
    const formatted = numericValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    setOldPriceInput(formatted);
    setNewProduct(prev => ({ ...prev, oldPrice: numericValue }));
  };

  const handleAddSizeOption = () => {
    if (!sizeForm.name) {
      toast.error('Informe ao menos o nome do tamanho.');
      return;
    }
    const priceVal = sizeForm.price ? (parseFloat(sizeForm.price.replace(/\D/g, '')) / 100) : 0;
    
    if (editingSizeId) {
      setNewProduct((prev: any) => ({
        ...prev,
        sizes: (prev.sizes || []).map((s: any) => 
          s.id === editingSizeId ? { ...s, name: sizeForm.name, price: priceVal } : s
        )
      }));
      setEditingSizeId(null);
      setSizeForm({ name: '', price: '', oldPrice: '' });
      toast.success('Opção de tamanho atualizada!');
    } else {
      const newSizeOption = {
        id: Math.random().toString(36).substr(2, 9),
        name: sizeForm.name,
        price: priceVal
      };
      
      setNewProduct((prev: any) => ({
        ...prev,
        sizes: [...(prev.sizes || []), newSizeOption]
      }));
      
      setSizeForm({ name: '', price: '', oldPrice: '' });
      toast.success('Opção de tamanho adicionada!');
    }
  };

  const handleLoadStandardMarmitaSizes = () => {
    const standardSizes: ProductSize[] = [
      { id: 'std_ind', name: 'Marmita Individual (1 un)', price: newProduct.price > 0 ? newProduct.price : 24.90 },
      { id: 'std_c5', name: 'Combo 5 Marmitas (5 un)', price: 120.00 },
      { id: 'std_c10', name: 'Combo 10 Marmitas (10 un)', price: 230.00 },
      { id: 'std_c20', name: 'Combo 20 Marmitas (20 un)', price: 440.00 },
      { id: 'std_c30', name: 'Combo 30 Marmitas (30 un)', price: 630.00 },
    ];
    setNewProduct(prev => ({
      ...prev,
      hasSizes: true,
      sizeOptionMode: 'multiple',
      sizes: standardSizes
    }));
    setSizeOptionMode('multiple');
    toast.success('Tabela padrão de marmitas carregada com sucesso!');
  };

  const handleDuplicateDish = (sourceId: string) => {
    const source = products.find(p => p.id === sourceId);
    if (!source) return;
    setDuplicateSourceId(sourceId);

    const fmt = source.itemFormat || (source.isCombo ? 'combo' : 'individual');
    setItemFormat(fmt);
    setHideIndividual(source.hideIndividual || false);
    setComboLimit(source.comboLimit || 5);
    setAllowedComboDishIds(source.allowedComboDishIds ? [...source.allowedComboDishIds] : products.filter(p => p.isActive !== false).map(p => p.id));

    const mode = source.sizeOptionMode || (source.twoSizes ? 'two' : (source.sizes && source.sizes.length > 0) ? 'multiple' : 'single');
    setSizeOptionMode(mode);

    if (source.twoSizes) {
      setTwoSize1({
        name: source.twoSizes.size1?.name || '300g',
        price: source.twoSizes.size1?.price ? source.twoSizes.size1.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
        oldPrice: source.twoSizes.size1?.oldPrice ? source.twoSizes.size1.oldPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
        stock: source.twoSizes.size1?.stock !== undefined ? String(source.twoSizes.size1.stock) : ''
      });
      setTwoSize2({
        name: source.twoSizes.size2?.name || '500g',
        price: source.twoSizes.size2?.price ? source.twoSizes.size2.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
        oldPrice: source.twoSizes.size2?.oldPrice ? source.twoSizes.size2.oldPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
        stock: source.twoSizes.size2?.stock !== undefined ? String(source.twoSizes.size2.stock) : ''
      });
    }

    setTrackStock(source.trackStock || false);
    setStockQuantityInput(source.stockQuantity !== undefined ? String(source.stockQuantity) : '0');

    setNewProduct({
      title: source.title,
      description: source.description || '',
      price: source.price || 0,
      oldPrice: source.oldPrice || 0,
      priceType: source.priceType || 'fixed',
      image: source.image || '',
      categoryId: source.categoryId || '',
      isMeal: source.isMeal || false,
      isCustomCake: source.isCustomCake || false,
      isCustomSandwich: source.isCustomSandwich || false,
      customFillings: source.customFillings || '',
      ingredients: source.ingredients || '',
      allowedSides: source.allowedSides || [],
      isActive: true,
      hasSizes: source.hasSizes || false,
      sizes: source.sizes ? [...source.sizes] : [],
      cakeGalleryId: source.cakeGalleryId || '',
      nutritionalInfo: source.nutritionalInfo ? { ...source.nutritionalInfo } : {
        servingsPerPackage: '',
        servingSize: '',
        calories: '',
        caloriesVd: '',
        carbs: '',
        carbsVd: '',
        totalSugars: '',
        addedSugars: '',
        addedSugarsVd: '',
        proteins: '',
        proteinsVd: '',
        totalFat: '',
        totalFatVd: '',
        saturatedFat: '',
        saturatedFatVd: '',
        transFat: '',
        transFatVd: '',
        fiber: '',
        fiberVd: '',
        sodium: '',
        sodiumVd: ''
      }
    });

    setPriceInput(source.price ? source.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00');
    setOldPriceInput(source.oldPrice ? source.oldPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
    toast.success(`Dados copiados de "${source.title}"! Altere os campos desejados.`);
  };

  const handleResetProductForm = () => {
    setIsEditingProduct(null);
    setDuplicateSourceId('');
    setItemFormat('individual');
    setHideIndividual(false);
    setComboLimit(5);
    setAllowedComboDishIds([]);
    setComboDishSearch('');
    setSizeOptionMode('single');
    setTwoSize1({ name: '300g', price: '', oldPrice: '', stock: '' });
    setTwoSize2({ name: '500g', price: '', oldPrice: '', stock: '' });
    setMultipleSizeForm({ name: '', price: '', stock: '' });
    setIsNutritionalExpanded(false);
    setTrackStock(false);
    setStockQuantityInput('0');
    setPriceInput('');
    setOldPriceInput('');
    setEditingSizeId(null);
    setSizeForm({ name: '', price: '', oldPrice: '' });
    setNewProduct({ 
      title: '', 
      description: '', 
      price: 0, 
      priceType: 'fixed',
      image: '', 
      categoryId: '',
      secondaryCategoryId: '',
      catalogs: [],
      isMeal: true,
      isCustomCake: false,
      isCustomSandwich: false,
      customFillings: '',
      ingredients: '',
      allowedSides: [],
      isActive: true,
      oldPrice: 0,
      hasSizes: false,
      sizes: [],
      cakeGalleryId: '',
      nutritionalInfo: {
        servingsPerPackage: '',
        servingSize: '',
        calories: '',
        caloriesVd: '',
        carbs: '',
        carbsVd: '',
        totalSugars: '',
        addedSugars: '',
        addedSugarsVd: '',
        proteins: '',
        proteinsVd: '',
        totalFat: '',
        totalFatVd: '',
        saturatedFat: '',
        saturatedFatVd: '',
        transFat: '',
        transFatVd: '',
        fiber: '',
        fiberVd: '',
        sodium: '',
        sodiumVd: ''
      }
    });
  };

  const handleStartEditProduct = (product: Product) => {
    setIsEditingProduct(product);
    const fmt = product.itemFormat || (product.isCombo ? 'combo' : 'individual');
    setItemFormat(fmt);
    setHideIndividual(product.hideIndividual || false);
    setComboLimit(product.comboLimit || 5);
    setAllowedComboDishIds(product.allowedComboDishIds ? [...product.allowedComboDishIds] : products.filter(p => p.isActive !== false && p.id !== product.id).map(p => p.id));
    
    const mode = product.sizeOptionMode || (product.twoSizes ? 'two' : (product.sizes && product.sizes.length > 0) ? 'multiple' : 'single');
    setSizeOptionMode(mode);

    if (product.twoSizes) {
      setTwoSize1({
        name: product.twoSizes.size1?.name || '300g',
        price: product.twoSizes.size1?.price ? product.twoSizes.size1.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
        oldPrice: product.twoSizes.size1?.oldPrice ? product.twoSizes.size1.oldPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
        stock: product.twoSizes.size1?.stock !== undefined ? String(product.twoSizes.size1.stock) : ''
      });
      setTwoSize2({
        name: product.twoSizes.size2?.name || '500g',
        price: product.twoSizes.size2?.price ? product.twoSizes.size2.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
        oldPrice: product.twoSizes.size2?.oldPrice ? product.twoSizes.size2.oldPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
        stock: product.twoSizes.size2?.stock !== undefined ? String(product.twoSizes.size2.stock) : ''
      });
    } else if (product.sizes && product.sizes.length === 2 && mode === 'two') {
      setTwoSize1({
        name: product.sizes[0].name,
        price: product.sizes[0].price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
        oldPrice: product.sizes[0].oldPrice ? product.sizes[0].oldPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
        stock: product.sizes[0].stock !== undefined ? String(product.sizes[0].stock) : ''
      });
      setTwoSize2({
        name: product.sizes[1].name,
        price: product.sizes[1].price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
        oldPrice: product.sizes[1].oldPrice ? product.sizes[1].oldPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
        stock: product.sizes[1].stock !== undefined ? String(product.sizes[1].stock) : ''
      });
    }

    setTrackStock(product.trackStock || false);
    setStockQuantityInput(product.stockQuantity !== undefined ? String(product.stockQuantity) : '0');

    setNewProduct({
      title: product.title,
      description: product.description || '',
      price: product.price || 0,
      oldPrice: product.oldPrice || 0,
      priceType: product.priceType || 'fixed',
      image: product.image || '',
      categoryId: product.categoryId || '',
      secondaryCategoryId: product.secondaryCategoryId || '',
      catalogs: product.catalogs || (product.catalog ? [product.catalog] : []),
      isMeal: product.isMeal || false,
      isCustomCake: product.isCustomCake || false,
      isCustomSandwich: product.isCustomSandwich || false,
      customFillings: product.customFillings || '',
      ingredients: product.ingredients || '',
      allowedSides: product.allowedSides || [],
      isActive: product.isActive ?? true,
      hasSizes: product.hasSizes || false,
      sizes: product.sizes || [],
      cakeGalleryId: product.cakeGalleryId || '',
      nutritionalInfo: product.nutritionalInfo || {
        servingsPerPackage: '',
        servingSize: '',
        calories: '',
        caloriesVd: '',
        carbs: '',
        carbsVd: '',
        totalSugars: '',
        addedSugars: '',
        addedSugarsVd: '',
        proteins: '',
        proteinsVd: '',
        totalFat: '',
        totalFatVd: '',
        saturatedFat: '',
        saturatedFatVd: '',
        transFat: '',
        transFatVd: '',
        fiber: '',
        fiberVd: '',
        sodium: '',
        sodiumVd: ''
      }
    });

    setPriceInput(product.price ? product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
    setOldPriceInput(product.oldPrice ? product.oldPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
    setEditingSizeId(null);
    setSizeForm({ name: '', price: '', oldPrice: '' });
    scrollToTop();
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!newProduct.title || !newProduct.categoryId) {
        toast.error('Por favor, preencha o título e a categoria.');
        return;
      }

      const isComboFormat = itemFormat === 'combo';
      const productDataToSave: any = {
        ...newProduct,
        secondaryCategoryId: undefined,
        catalogs: undefined,
        itemFormat,
        isCombo: isComboFormat,
        hideIndividual: isComboFormat ? false : hideIndividual,
        comboLimit: isComboFormat ? (comboLimit || 5) : undefined,
        allowedComboDishIds: isComboFormat ? (allowedComboDishIds.length > 0 ? allowedComboDishIds : products.filter(p => p.isActive !== false).map(p => p.id)) : undefined,
        sizeOptionMode,
        trackStock,
        stockQuantity: trackStock ? (parseInt(stockQuantityInput, 10) || 0) : undefined,
      };

      const hasAnyNutritional = Object.values(newProduct.nutritionalInfo || {}).some(
        (v: any) => typeof v === 'string' && v.trim().length > 0
      );
      if (!hasAnyNutritional) {
        productDataToSave.nutritionalInfo = undefined;
      }

      if (sizeOptionMode === 'two') {
        const p1 = twoSize1.price ? (parseFloat(twoSize1.price.replace(/\D/g, '')) / 100) : (newProduct.price || 0);
        const op1 = twoSize1.oldPrice ? (parseFloat(twoSize1.oldPrice.replace(/\D/g, '')) / 100) : undefined;
        const s1 = twoSize1.stock ? parseInt(twoSize1.stock, 10) : undefined;

        const p2 = twoSize2.price ? (parseFloat(twoSize2.price.replace(/\D/g, '')) / 100) : (newProduct.price || 0);
        const op2 = twoSize2.oldPrice ? (parseFloat(twoSize2.oldPrice.replace(/\D/g, '')) / 100) : undefined;
        const s2 = twoSize2.stock ? parseInt(twoSize2.stock, 10) : undefined;

        productDataToSave.hasSizes = true;
        productDataToSave.twoSizes = {
          size1: { name: twoSize1.name || '300g', price: p1, oldPrice: op1, stock: s1 },
          size2: { name: twoSize2.name || '500g', price: p2, oldPrice: op2, stock: s2 }
        };
        productDataToSave.sizes = [
          { id: 'size_1', name: twoSize1.name || '300g', price: p1, oldPrice: op1, stock: s1 },
          { id: 'size_2', name: twoSize2.name || '500g', price: p2, oldPrice: op2, stock: s2 }
        ];
      } else if (sizeOptionMode === 'multiple') {
        productDataToSave.hasSizes = (newProduct.sizes || []).length > 0;
        productDataToSave.twoSizes = undefined;
      } else {
        productDataToSave.hasSizes = false;
        productDataToSave.twoSizes = undefined;
      }

      const cleanData = removeUndefined(productDataToSave);

      if (isEditingProduct) {
        await updateDoc(doc(db, 'produtos', isEditingProduct.id), cleanData);
        toast.success('Produto atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'produtos'), { ...cleanData, isActive: true });
        toast.success('Produto adicionado com sucesso!');
      }

      handleResetProductForm();
    } catch (err: any) {
      console.error('Erro ao salvar produto:', err);
      const detail = err?.message || 'Verifique as permissões ou tente novamente.';
      toast.error(`Erro ao salvar produto: ${detail}`);
    }
  };

  const toggleProductStatus = async (product: Product) => {
    try {
      await updateDoc(doc(db, 'produtos', product.id), {
        isActive: product.isActive === false ? true : false
      });
    } catch (err) {
      alert('Erro ao alterar status do produto.');
    }
  };

  const moveCategory = async (id: string, direction: 'up' | 'down', listToUse: Category[] = categories) => {
    const index = listToUse.findIndex(c => c.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === listToUse.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const current = listToUse[index];
    const target = listToUse[targetIndex];

    try {
      const updatedList = [...listToUse];
      updatedList[index] = target;
      updatedList[targetIndex] = current;

      const currentOrder = typeof current.order === 'number' ? current.order : (index + 1);
      const targetOrder = typeof target.order === 'number' ? target.order : (targetIndex + 1);

      const batch = writeBatch(db);

      if (currentOrder === targetOrder) {
        updatedList.forEach((cat, idx) => {
          batch.update(doc(db, 'categorias', cat.id), { order: (idx + 1) * 10 });
        });
      } else {
        batch.update(doc(db, 'categorias', current.id), { order: targetOrder });
        batch.update(doc(db, 'categorias', target.id), { order: currentOrder });
      }

      await batch.commit();
      toast.success('Ordem da categoria atualizada!');
    } catch (err) {
      console.error('Erro ao mover categoria:', err);
      toast.error('Erro ao atualizar ordem da categoria.');
    }
  };

  const handleAddSide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSide.name) return;

    try {
      if (isEditingSide) {
        await updateDoc(doc(db, 'acompanhamentos', isEditingSide.id), newSide);
        toast.success('Acompanhamento atualizado!');
      } else {
        await addDoc(collection(db, 'acompanhamentos'), newSide);
        toast.success('Acompanhamento adicionado!');
      }
      setNewSide({ name: '', price: 0, type: 'side' });
      setSidePriceInput('');
      setIsEditingSide(null);
    } catch (error) {
      console.error('Error adding side:', error);
      toast.error('Erro ao salvar acompanhamento');
    }
  };

  const deleteSide = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Acompanhamento',
      message: 'Tem certeza que deseja excluir este acompanhamento?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'acompanhamentos', id));
          toast.success('Acompanhamento excluído!');
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          toast.error('Erro ao excluir');
        }
      }
    });
  };

  const handleSidePriceChange = (val: string) => {
    setSidePriceInput(val);
    const numeric = parseFloat(val.replace(',', '.'));
    if (!isNaN(numeric)) {
      setNewSide({ ...newSide, price: numeric });
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!newCategory.title) {
        toast.error('Por favor, preencha o título da categoria.');
        return;
      }

      const targetCatalog = newCategory.catalog || (selectedCategoryCatalog !== 'all' && selectedCategoryCatalog !== 'global' ? selectedCategoryCatalog : 'all');

      if (isEditingCategory) {
        await updateDoc(doc(db, 'categorias', isEditingCategory.id), { 
          title: newCategory.title,
          catalog: newCategory.catalog || 'all'
        });
        setIsEditingCategory(null);
        toast.success('Categoria atualizada com sucesso!');
      } else {
        const maxOrder = categories.reduce((max, c) => Math.max(max, c.order || 0), 0);
        await addDoc(collection(db, 'categorias'), {
          title: newCategory.title,
          order: maxOrder + 1,
          catalog: targetCatalog
        });
        toast.success('Categoria adicionada com sucesso!');
      }
      setNewCategory({ 
        title: '', 
        order: 0, 
        catalog: (selectedCategoryCatalog !== 'all' && selectedCategoryCatalog !== 'global' ? selectedCategoryCatalog : 'all') as any 
      });
    } catch (err: any) {
      console.error('Erro ao salvar categoria:', err);
      if (err.message?.includes('permission-denied')) {
        toast.error('Erro de permissão: Você não tem autorização para salvar. Verifique se está logado corretamente.');
      } else {
        toast.error('Erro ao salvar categoria. Verifique sua conexão.');
      }
    }
  };

  const deleteProduct = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Produto',
      message: 'Deseja realmente excluir este produto? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'produtos', id));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          alert('Erro ao excluir produto.');
        }
      }
    });
  };

  const deleteCategory = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Categoria',
      message: 'Deseja realmente excluir esta categoria? Todos os produtos vinculados a ela ficarão sem categoria.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'categorias', id));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          alert('Erro ao excluir categoria.');
        }
      }
    });
  };

  const deleteOrder = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Pedido',
      message: 'Deseja realmente excluir este pedido do histórico?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'pedidos', id));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          alert('Erro ao excluir pedido.');
        }
      }
    });
  };

  const updateOrderPaymentStatus = async (orderId: string, status: 'pending' | 'half' | 'full') => {
    try {
      await updateDoc(doc(db, 'pedidos', orderId), {
        paymentStatus: status
      });
      toast.success('Status de pagamento atualizado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar status de pagamento.');
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/?slug=${settings?.slug || 'easy-cake-menu'}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]);
  };

  const handleEditOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditingOrder?.id) return;
    try {
      const orderRef = doc(db, 'pedidos', isEditingOrder.id);
      await updateDoc(orderRef, {
        ...editOrderForm,
        updatedAt: serverTimestamp()
      });
      toast.success('Pedido atualizado com sucesso!');
      setIsEditingOrder(null);
    } catch (err) {
      console.error('Erro ao atualizar pedido:', err);
      toast.error('Erro ao atualizar pedido.');
    }
  };

  const deleteCustomer = async (customer: any) => {
    const customerId = customer.phone || customer.email || customer.name;
    const customerOrders = orders.filter(o => (o.phone || o.email || o.customerName) === customerId);
    
    try {
      setIsSaving(true);
      if (customer.id) {
        await deleteDoc(doc(db, 'clientes', customer.id));
      }
      for (const order of customerOrders) {
        await deleteDoc(doc(db, 'pedidos', order.id));
      }
      toast.success('Cliente e seus pedidos excluídos com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      toast.error('Erro ao excluir cliente');
    } finally {
      setIsSaving(false);
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    }
  };

  const updateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const originalId = isEditingCustomer.phone || isEditingCustomer.email || isEditingCustomer.name;
    const customerOrders = orders.filter(o => {
      return o.customerName === originalId || o.phone === originalId || o.email === originalId;
    });

    try {
      setIsSaving(true);
      
      const fullAddr = `${editCustomerForm.street || ''}, ${editCustomerForm.number || 'S/N'} - ${editCustomerForm.city || ''} (${editCustomerForm.zipCode || ''})`;

      if (isEditingCustomer.id) {
        const mcDocRef = doc(db, 'clientes', isEditingCustomer.id);
        await updateDoc(mcDocRef, {
          name: editCustomerForm.name,
          phone: editCustomerForm.phone,
          email: editCustomerForm.email,
          birthday: editCustomerForm.birthday || '',
          isB2B: false,
          managerName: '',
          frequency: '',
          address: fullAddr,
          street: editCustomerForm.street || '',
          number: editCustomerForm.number || '',
          zipCode: editCustomerForm.zipCode || '',
          city: editCustomerForm.city || ''
        });
      }

      for (const order of customerOrders) {
        const updateData: any = {
          phone: editCustomerForm.phone,
          email: editCustomerForm.email,
          birthday: editCustomerForm.birthday || '',
          customerName: editCustomerForm.name,
          street: editCustomerForm.street || '',
          number: editCustomerForm.number || '',
          zipCode: editCustomerForm.zipCode || '',
          city: editCustomerForm.city || '',
          address: fullAddr
        };

        await updateDoc(doc(db, 'pedidos', order.id), updateData);
      }
      toast.success('Informações do cliente atualizadas!');
      setIsEditingCustomer(null);
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      toast.error('Erro ao atualizar cliente');
    } finally {
      setIsSaving(false);
    }
  };

  const saveNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.name) {
      toast.error('O nome do cliente é obrigatório.');
      return;
    }
    try {
      setIsSaving(true);
      const fullAddr = `${newCustomerForm.street || ''}, ${newCustomerForm.number || 'S/N'} - ${newCustomerForm.city || ''} (${newCustomerForm.zipCode || ''})`;

      const clientData = {
        name: newCustomerForm.name,
        phone: newCustomerForm.phone || '',
        email: newCustomerForm.email || '',
        birthday: newCustomerForm.birthday || '',
        isB2B: false,
        managerName: '',
        frequency: '',
        address: fullAddr,
        street: newCustomerForm.street || '',
        number: newCustomerForm.number || '',
        zipCode: newCustomerForm.zipCode || '',
        city: newCustomerForm.city || '',
        createdAt: new Date()
      };

      await addDoc(collection(db, 'clientes'), clientData);
      toast.success('Cliente cadastrado com sucesso!');
      setIsRegisteringCustomer(false);
    } catch (error) {
      console.error('Erro ao cadastrar cliente:', error);
      toast.error('Erro ao cadastrar cliente');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddManualItem = () => {
    if (!selectedManualProduct) {
      toast.error('Por favor, selecione um produto.');
      return;
    }

    let finalPrice = selectedManualProduct.price;
    let titleDetail = selectedManualProduct.title;
    let itemSize: any = null;

    if (selectedManualProduct.hasSizes && selectedManualProduct.sizes && selectedManualProduct.sizes.length > 0) {
      if (!selectedManualSize) {
        toast.error('Por favor, selecione um tamanho/variação.');
        return;
      }
      finalPrice = selectedManualSize.price;
      titleDetail = `${selectedManualProduct.title} (${selectedManualSize.name})`;
      itemSize = selectedManualSize;
    }

    const mealOpts: any = {};
    if (selectedManualProduct.isMeal) {
      mealOpts.removals = selectedManualMealRemovals;
      mealOpts.sides = selectedManualMealSides;
      if (selectedManualMealRemovals.length > 0) {
        titleDetail += ` [Sem: ${selectedManualMealRemovals.join(', ')}]`;
      }
      if (selectedManualMealSides.length > 0) {
        titleDetail += ` [Acomp: ${selectedManualMealSides.map(s => s.name).join(', ')}]`;
      }
    }

    const cakeOpts: any = {};
    if (selectedManualProduct.isCustomCake) {
      cakeOpts.size = selectedManualCakeOptions.size;
      cakeOpts.dough = selectedManualCakeOptions.dough;
      cakeOpts.fillings = selectedManualCakeOptions.fillings;
      cakeOpts.topping = selectedManualCakeOptions.topping;
      cakeOpts.topper = selectedManualCakeOptions.topper;
      cakeOpts.styleNumber = selectedManualCakeOptions.styleNumber;

      titleDetail += ` [Bolo: ${cakeOpts.size || ''}, ${cakeOpts.dough || ''}, Recheio: ${(cakeOpts.fillings || []).join(' e ')}]`;
    }

    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      productId: selectedManualProduct.id,
      title: titleDetail,
      quantity: manualProductQty,
      price: finalPrice,
      priceType: selectedManualProduct.priceType || 'fixed',
      mealOptions: selectedManualProduct.isMeal ? mealOpts : undefined,
      selectedSize: itemSize || undefined,
      cakeOptions: selectedManualProduct.isCustomCake ? cakeOpts : undefined,
    };

    setManualOrderItems([...manualOrderItems, newItem]);

    setSelectedManualProduct(null);
    setManualProductQty(1);
    setSelectedManualSize(null);
    setSelectedManualMealRemovals([]);
    setSelectedManualMealSides([]);
    setSelectedManualCakeOptions({
      size: '',
      dough: '',
      fillings: [],
      topping: '',
      topper: '',
      styleNumber: 1
    });
    toast.success('Item adicionado ao pedido!');
  };

  const handleCreateManualOrder = async () => {
    if (manualOrderItems.length === 0) {
      toast.error('Adicione pelo menos um item ao pedido.');
      return;
    }
    if (!manualOrderForm.customerName) {
      toast.error('O nome do cliente é obrigatório.');
      return;
    }

    try {
      setIsSaving(true);
      const total = manualOrderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

      const orderData = {
        customerName: manualOrderForm.customerName,
        phone: manualOrderForm.phone || '',
        email: manualOrderForm.email || '',
        address: manualOrderForm.address || '',
        street: manualOrderForm.street || '',
        number: manualOrderForm.number || '',
        zipCode: manualOrderForm.zipCode || '',
        city: manualOrderForm.city || '',
        birthday: manualOrderForm.birthday || '',
        pickupDate: manualOrderForm.pickupDate || '',
        observation: manualOrderForm.observation || '',
        items: manualOrderItems.map(item => ({
          title: item.title,
          quantity: item.quantity,
          price: item.price,
          priceType: item.priceType || 'fixed',
          mealOptions: item.mealOptions || null,
          selectedSize: item.selectedSize || null,
          cakeOptions: item.cakeOptions || null
        })),
        total: total,
        subtotal: total,
        createdAt: new Date(),
        orderLanguage: settings?.language || 'pt'
      };

      await addDoc(collection(db, 'pedidos'), orderData);
      toast.success('Pedido manual cadastrado com sucesso!');
      setIsAddingOrder(false);
      setManualOrderItems([]);
      setManualOrderForm({
        customerName: '',
        phone: '',
        email: '',
        address: '',
        street: '',
        number: '',
        zipCode: '',
        city: '',
        pickupDate: '',
        observation: '',
        birthday: ''
      });
    } catch (error) {
      console.error('Erro ao cadastrar pedido manual:', error);
      toast.error('Erro ao cadastrar pedido manual');
    } finally {
      setIsSaving(false);
    }
  };

  const closestUpcomingOrder = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parseDateString = (str: string, lang?: string) => {
      if (!str || !str.includes('/')) return null;
      const parts = str.split('/');
      if (parts.length !== 3) return null;
      
      let month = parseInt(parts[0]);
      let day = parseInt(parts[1]);
      let year = parseInt(parts[2]);

      // Always treat as MM/DD/YYYY by default (USA pattern), but if the first part (month) is > 12, it is definitely DD/MM/YYYY
      if (month > 12) {
        day = parseInt(parts[0]);
        month = parseInt(parts[1]);
      }
      
      if (!day || !month || !year || month > 12) return null;
      return new Date(year, month - 1, day);
    };

    const upcomingOrders = orders
      .map(o => {
        if (!o.pickupDate) return null;
        const d = parseDateString(o.pickupDate, o.orderLanguage || settings.language || 'pt');
        if (!d) return null;
        d.setHours(0, 0, 0, 0);
        return { order: o, date: d };
      })
      .filter((item): item is { order: Order; date: Date } => item !== null && item.date >= today);

    if (upcomingOrders.length === 0) {
      // If none are in the future, get the closest one overall that has a pickupDate
      const allWithDate = orders
        .map(o => {
          if (!o.pickupDate) return null;
          const d = parseDateString(o.pickupDate, o.orderLanguage || settings.language || 'pt');
          if (!d) return null;
          d.setHours(0, 0, 0, 0);
          return { order: o, date: d };
        })
        .filter((item): item is { order: Order; date: Date } => item !== null);
      
      if (allWithDate.length === 0) return null;
      
      allWithDate.sort((a, b) => b.date.getTime() - a.date.getTime());
      return allWithDate[0].order;
    }

    upcomingOrders.sort((a, b) => a.date.getTime() - b.date.getTime());
    return upcomingOrders[0].order;
  }, [orders, settings.language]);

  const printWithIframe = (htmlContent: string) => {
    let iframe = document.getElementById('print-iframe') as HTMLIFrameElement;
    if (iframe) {
      document.body.removeChild(iframe);
    }

    iframe = document.createElement('iframe');
    iframe.id = 'print-iframe';
    iframe.setAttribute('style', 'position: fixed; right: -9999px; bottom: -9999px; width: 800px; height: 1000px; border: 0; visibility: hidden;');
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!iframeDoc) return;

    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    setTimeout(() => {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }
    }, 350);
  };

  const printOrdersList = () => {
    const format = settings?.printerFormat || 'a4';
    const listTitle = orderTypeTab === 'b2b' 
      ? 'PEDIDOS CORPORATIVOS (B2B)' 
      : 'PEDIDOS VAREJO (RETAIL)';
    const totalSum = filteredOrders.reduce((sum, o) => sum + o.total, 0);
    const brand = settings?.brandName || 'Grão & Sabor';

    if (format === 'a4') {
      const rowsHtml = filteredOrders.map((order, index) => {
        const name = order.isB2B || order.isPJ ? (order.b2bCompanyName || order.customerName) : order.customerName;
        const deliveryDate = order.pickupDate ? order.pickupDate : 'N/A';
        const itemsSummary = order.items.map(item => `${item.quantity}x ${item.title}`).join(', ');

        return `
          <tr>
            <td style="font-weight: bold; text-align: center; width: 40px;">#${index + 1}</td>
            <td style="font-weight: 700;">${name.toUpperCase()}</td>
            <td>${order.phone || '-'}</td>
            <td>${order.deliveryType === 'pickup' ? 'Retirada' : 'Entrega'} • ${deliveryDate}</td>
            <td style="font-size: 11px; color: #4b5563;">${itemsSummary}</td>
            <td style="text-align: right; font-weight: bold;">${currencySymbol} ${order.total.toFixed(2).replace('.', ',')}</td>
          </tr>
        `;
      }).join('');

      printWithIframe(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>${listTitle}</title>
            <style>
              @page { size: A4 portrait; margin: 12mm 15mm; }
              @media print {
                html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
              }
              * { box-sizing: border-box; }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                color: #111827;
                margin: 0 auto;
                max-width: 720px;
                padding: 10px;
                font-size: 12.5px;
                line-height: 1.4;
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                border-bottom: 2px solid #111827;
                padding-bottom: 8px;
                margin-bottom: 12px;
              }
              .brand { font-size: 20px; font-weight: 800; text-transform: uppercase; color: #111827; margin: 0; }
              .meta { font-size: 11px; color: #6b7280; text-align: right; }
              table { width: 100%; border-collapse: collapse; margin-top: 8px; }
              th { background: #f3f4f6; border-top: 1px solid #d1d5db; border-bottom: 2px solid #111827; padding: 7px 8px; font-size: 11px; font-weight: 800; text-transform: uppercase; text-align: left; }
              td { padding: 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
              .total-box { margin-top: 14px; text-align: right; font-size: 16px; font-weight: 800; border-top: 2px solid #111827; padding-top: 8px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <h1 class="brand">${brand}</h1>
                <div style="font-weight: 700; font-size: 13px; color: #374151; margin-top: 2px;">${listTitle}</div>
              </div>
              <div class="meta">
                <div>Data: ${new Date().toLocaleString('pt-BR')}</div>
                <div style="font-weight: 600;">Total: ${filteredOrders.length} pedido(s)</div>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="text-align: center; width: 40px;">#</th>
                  <th>Cliente</th>
                  <th>Telefone</th>
                  <th>Entrega / Data</th>
                  <th>Itens</th>
                  <th style="text-align: right; width: 100px;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #9ca3af;">Nenhum pedido encontrado.</td></tr>'}
              </tbody>
            </table>
            <div class="total-box">
              VALOR TOTAL GERAL: ${currencySymbol} ${totalSum.toFixed(2).replace('.', ',')}
            </div>
          </body>
        </html>
      `);
      return;
    }

    const is80 = format === '80mm';
    const paperWidth = is80 ? '80mm' : '58mm';
    const printWidth = is80 ? '72mm' : '48mm';

    const contentHtml = filteredOrders.map((order, index) => {
      const itemsText = order.items.map(item => `  ${item.quantity}x ${item.title}${item.selectedSize ? ` (${item.selectedSize.name})` : ''}`).join('\n');
      const name = order.isB2B || order.isPJ ? (order.b2bCompanyName || order.customerName) : order.customerName;
      const deliveryDate = order.pickupDate ? order.pickupDate : 'N/A';
      
      return `
        <div class="order-block">
          <div class="order-header">#${index + 1} - ${name.toUpperCase()}</div>
          <div class="order-details">
            TEL: ${order.phone}<br/>
            ENTREGA: ${deliveryDate}
          </div>
          <div class="order-items">${itemsText}</div>
          <div class="order-total">TOTAL: ${currencySymbol} ${order.total.toFixed(2).replace('.', ',')}</div>
        </div>
      `;
    }).join('');

    printWithIframe(`
      <html>
        <head>
          <title>${listTitle}</title>
          <style>
            @page { size: ${paperWidth} auto; margin: 0; }
            @media print {
              html, body { width: ${paperWidth} !important; margin: 0 !important; padding: 0 !important; }
            }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              width: ${printWidth}; 
              max-width: ${printWidth};
              padding: 1.5mm 1mm; 
              margin: 0 auto; 
              font-size: ${is80 ? '11px' : '10px'}; 
              color: #000;
              line-height: 1.25;
            }
            .header { text-align: center; border-bottom: 2px double #000; padding-bottom: 4px; margin-bottom: 8px; }
            .header h1 { font-size: ${is80 ? '13px' : '11px'}; margin: 0 0 2px 0; text-transform: uppercase; }
            .header p { font-size: 8.5px; margin: 0; }
            .order-block { margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 6px; }
            .order-header { font-weight: bold; font-size: ${is80 ? '11.5px' : '10.5px'}; }
            .order-details { font-size: 9px; margin: 2px 0; }
            .order-items { white-space: pre-wrap; font-size: 9.5px; margin: 3px 0; background: #fafafa; padding: 2px; }
            .order-total { text-align: right; font-weight: bold; font-size: 10px; }
            .total-sum { font-size: 11px; font-weight: bold; text-align: right; border-top: 2px solid #000; padding-top: 4px; margin-top: 8px; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${listTitle}</h1>
            <p>Gerado: ${new Date().toLocaleString('pt-BR')}</p>
            <p>Total de Pedidos: ${filteredOrders.length}</p>
          </div>
          ${contentHtml || '<div style="text-align: center; padding: 10px; color: #666; font-size: 9px;">Nenhum pedido encontrado.</div>'}
          <div class="total-sum">
            SOMA: ${currencySymbol} ${totalSum.toFixed(2).replace('.', ',')}
          </div>
        </body>
      </html>
    `);
  };

  const printAllProductsList = () => {
    const groupedProducts = categories.map(cat => {
      const catProducts = products.filter(p => p.categoryId === cat.id);
      return {
        categoryTitle: cat.title,
        products: catProducts
      };
    }).filter(group => group.products.length > 0);

    const uncategorizedProducts = products.filter(p => !p.categoryId || !categories.some(cat => cat.id === p.categoryId));
    if (uncategorizedProducts.length > 0) {
      groupedProducts.push({
        categoryTitle: 'Sem Categoria',
        products: uncategorizedProducts
      });
    }

    const contentHtml = groupedProducts.map(group => {
      const productsHtml = group.products.map((product, idx) => {
        let priceStr = '';
        if (product.hasSizes && product.sizes && product.sizes.length > 0) {
          priceStr = product.sizes.map(s => `  - ${s.name}: ${currencySymbol} ${Number(s.price).toFixed(2).replace('.', ',')}`).join('\n');
        } else {
          priceStr = `  ${currencySymbol} ${Number(product.price || 0).toFixed(2).replace('.', ',')}`;
          if (product.oldPrice) {
            priceStr += ` (De: ${currencySymbol} ${Number(product.oldPrice).toFixed(2).replace('.', ',')})`;
          }
        }

        let catalogLabel = '';
        if (product.catalog === 'catalog1') {
          catalogLabel = settings?.catalog1Title || 'Catálogo 1';
        } else if (product.catalog === 'catalog2') {
          catalogLabel = settings?.catalog2Title || 'Catálogo 2';
        } else if (product.catalog === 'catalog3') {
          catalogLabel = settings?.catalog3Title || 'Catálogo 3';
        } else if (product.catalog === 'catalog4') {
          catalogLabel = settings?.catalog4Title || 'Catálogo 4';
        } else if (product.catalog === 'catalog5') {
          catalogLabel = settings?.catalog5Title || 'Catálogo 5';
        } else if (product.catalog === 'catalog6') {
          catalogLabel = settings?.catalog6Title || 'Catálogo 6';
        } else if (product.catalog === 'all') {
          catalogLabel = 'Todos';
        }

        const activeStatusText = product.isActive !== false ? 'ATIVO' : 'INATIVO';

        return `
          <div class="product-block">
            <div class="product-title">${idx + 1}. ${product.title.toUpperCase()} [${activeStatusText}]</div>
            ${product.description ? `<div class="product-desc">${product.description}</div>` : ''}
            ${catalogLabel ? `<div class="product-catalog">Catálogo: ${catalogLabel}</div>` : ''}
            <div class="product-price">${priceStr}</div>
          </div>
        `;
      }).join('');

      return `
        <div class="category-block">
          <div class="category-title">${group.categoryTitle.toUpperCase()}</div>
          ${productsHtml}
        </div>
      `;
    }).join('');

    const format = settings?.printerFormat || 'a4';
    const is80 = format === '80mm';
    const paperWidth = is80 ? '80mm' : '58mm';
    const printWidth = is80 ? '72mm' : '48mm';
    const brand = settings?.brandName || 'Grão & Sabor';

    if (format === 'a4') {
      printWithIframe(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Cardápio de Produtos - ${brand}</title>
            <style>
              @page { size: A4 portrait; margin: 12mm 15mm; }
              @media print {
                html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
              }
              * { box-sizing: border-box; }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                color: #111827;
                margin: 0 auto;
                max-width: 720px;
                padding: 10px;
                font-size: 12.5px;
                line-height: 1.4;
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                border-bottom: 2px solid #111827;
                padding-bottom: 8px;
                margin-bottom: 14px;
              }
              .brand { font-size: 22px; font-weight: 800; text-transform: uppercase; margin: 0; }
              .meta { font-size: 11px; color: #6b7280; text-align: right; }
              .category-block { margin-bottom: 16px; }
              .category-title { font-size: 14px; font-weight: 800; text-transform: uppercase; background: #f3f4f6; padding: 6px 10px; border-radius: 6px; border-left: 4px solid #111827; margin-bottom: 8px; }
              table { width: 100%; border-collapse: collapse; }
              td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <h1 class="brand">${brand}</h1>
                <div style="font-size: 13px; font-weight: 700; color: #374151; margin-top: 2px;">Cardápio Geral de Produtos</div>
              </div>
              <div class="meta">
                <div>Data: ${new Date().toLocaleString('pt-BR')}</div>
                <div style="font-weight: 600;">Total: ${products.length} itens</div>
              </div>
            </div>
            ${groupedProducts.map(group => `
              <div class="category-block">
                <div class="category-title">${group.categoryTitle}</div>
                <table>
                  <tbody>
                    ${group.products.map(p => `
                      <tr>
                        <td style="font-weight: 700; width: 45%;">${p.title}</td>
                        <td style="font-size: 11px; color: #4b5563;">${p.description || '-'}</td>
                        <td style="text-align: right; font-weight: bold; width: 110px;">${currencySymbol} ${p.price.toFixed(2).replace('.', ',')}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `).join('') || '<div style="text-align: center; padding: 20px; color: #9ca3af;">Nenhum produto cadastrado.</div>'}
          </body>
        </html>
      `);
      return;
    }

    printWithIframe(`
      <html>
        <head>
          <title>Cardápio Completo</title>
          <style>
            @page { size: ${paperWidth} auto; margin: 0; }
            @media print {
              html, body { width: ${paperWidth} !important; margin: 0 !important; padding: 0 !important; }
            }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              width: ${printWidth}; 
              max-width: ${printWidth}; 
              padding: 1.5mm 1mm; 
              margin: 0 auto; 
              font-size: ${is80 ? '11px' : '10px'}; 
              color: #000;
              line-height: 1.25;
            }
            .header { text-align: center; border-bottom: 2px double #000; padding-bottom: 4px; margin-bottom: 8px; }
            .header h1 { font-size: ${is80 ? '13px' : '11px'}; margin: 0 0 2px 0; text-transform: uppercase; }
            .header p { font-size: 8.5px; margin: 0; }
            .category-block { margin-top: 8px; }
            .category-title { font-weight: bold; font-size: 10px; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 4px; text-transform: uppercase; }
            .product-block { margin-bottom: 6px; border-bottom: 1px dashed #ccc; padding-bottom: 3px; }
            .product-title { font-weight: bold; font-size: 10px; }
            .product-desc { font-size: 8.5px; color: #444; margin: 1px 0; }
            .product-catalog { font-size: 8.5px; font-style: italic; }
            .product-price { font-weight: bold; font-size: 10px; white-space: pre-wrap; margin-top: 2px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${brand}</h1>
            <p>Relatório de Produtos</p>
            <p>Gerado: ${new Date().toLocaleString('pt-BR')}</p>
            <p>Total: ${products.length} itens</p>
          </div>
          ${contentHtml || '<div style="text-align: center; padding: 10px; color: #666; font-size: 9px;">Nenhum produto cadastrado.</div>'}
        </body>
      </html>
    `);
  };

  const printProductionSummary = () => {
    const format = settings?.printerFormat || 'a4';
    const is80 = format === '80mm';
    const paperWidth = is80 ? '80mm' : '58mm';
    const printWidth = is80 ? '72mm' : '48mm';
    const brand = settings?.brandName || 'Grão & Sabor';

    const listTitle = orderTypeTab === 'b2b'
      ? 'RESUMO DE PRODUÇÃO - B2B'
      : 'RESUMO DE PRODUÇÃO - VAREJO';

    const dateRangeText = (startDate || endDate) 
      ? `Período: ${startDate || 'Início'} até ${endDate || 'Fim'}`
      : 'Todos os Pedidos';

    if (format === 'a4') {
      const itemsRows = Object.entries(batchSummary.items).map(([title, qty]) => `
        <tr>
          <td style="font-weight: 700;">${title}</td>
          <td style="text-align: center; font-weight: 800; font-size: 14px; width: 100px;">${qty}x</td>
        </tr>
      `).join('');

      const sidesRows = Object.entries(batchSummary.sides).map(([name, qty]) => `
        <tr>
          <td style="font-weight: 600;">${name}</td>
          <td style="text-align: center; font-weight: 800; font-size: 14px; width: 100px;">${qty}x</td>
        </tr>
      `).join('');

      printWithIframe(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>${listTitle}</title>
            <style>
              @page { size: A4 portrait; margin: 12mm 15mm; }
              @media print {
                html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
              }
              * { box-sizing: border-box; }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                color: #111827;
                margin: 0 auto;
                max-width: 720px;
                padding: 10px;
                font-size: 13px;
                line-height: 1.45;
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                border-bottom: 2px solid #111827;
                padding-bottom: 8px;
                margin-bottom: 14px;
              }
              .brand { font-size: 22px; font-weight: 800; text-transform: uppercase; margin: 0; }
              .meta { font-size: 11px; color: #6b7280; text-align: right; }
              .section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; background: #f3f4f6; padding: 6px 10px; border-radius: 6px; border-left: 4px solid #111827; margin: 16px 0 8px 0; }
              table { width: 100%; border-collapse: collapse; }
              th { background: #f9fafb; border-bottom: 2px solid #111827; padding: 7px 10px; font-size: 11px; font-weight: 800; text-transform: uppercase; text-align: left; }
              td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <h1 class="brand">${brand}</h1>
                <div style="font-weight: 700; font-size: 14px; color: #374151; margin-top: 2px;">${listTitle}</div>
                <div style="font-size: 11.5px; color: #4b5563; margin-top: 2px;">${dateRangeText}</div>
              </div>
              <div class="meta">
                <div>Data: ${new Date().toLocaleString('pt-BR')}</div>
                <div style="font-weight: 600;">Status: Produção</div>
              </div>
            </div>

            <div class="section-title">TOTAL DE ITENS PARA PRODUÇÃO</div>
            <table>
              <thead>
                <tr>
                  <th>Item / Produto</th>
                  <th style="text-align: center; width: 100px;">Quantidade</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows || '<tr><td colspan="2" style="text-align: center; padding: 15px; color: #9ca3af;">Nenhum item no período.</td></tr>'}
              </tbody>
            </table>

            ${Object.keys(batchSummary.sides).length > 0 ? `
              <div class="section-title">ACOMPANHAMENTOS</div>
              <table>
                <thead>
                  <tr>
                    <th>Acompanhamento</th>
                    <th style="text-align: center; width: 100px;">Quantidade</th>
                  </tr>
                </thead>
                <tbody>
                  ${sidesRows}
                </tbody>
              </table>
            ` : ''}
          </body>
        </html>
      `);
      return;
    }

    const itemsHtml = Object.entries(batchSummary.items).map(([title, qty]) => `
      <div class="summary-row">
        <span class="title">${title}</span>
        <span class="qty">${qty}x</span>
      </div>
    `).join('');

    const sidesHtml = Object.entries(batchSummary.sides).map(([name, qty]) => `
      <div class="summary-row">
        <span class="title">${name}</span>
        <span class="qty">${qty}x</span>
      </div>
    `).join('');

    printWithIframe(`
      <html>
        <head>
          <title>${listTitle}</title>
          <style>
            @page { size: ${paperWidth} auto; margin: 0; }
            @media print {
              html, body { width: ${paperWidth} !important; margin: 0 !important; padding: 0 !important; }
            }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              width: ${printWidth}; 
              max-width: ${printWidth}; 
              padding: 1.5mm 1mm; 
              margin: 0 auto; 
              font-size: ${is80 ? '11px' : '10px'}; 
              color: #000;
              line-height: 1.25;
            }
            .header { text-align: center; border-bottom: 2px double #000; padding-bottom: 4px; margin-bottom: 8px; }
            .header h1 { font-size: ${is80 ? '13px' : '11px'}; margin: 0 0 2px 0; text-transform: uppercase; }
            .header p { font-size: 8.5px; margin: 0; }
            .section { margin-bottom: 10px; }
            .section-title { font-weight: bold; font-size: 10px; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 4px; text-transform: uppercase; }
            .summary-row { display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px dashed #ccc; }
            .summary-row .title { max-width: 80%; }
            .summary-row .qty { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${listTitle}</h1>
            <p>${dateRangeText}</p>
            <p>Gerado: ${new Date().toLocaleString('pt-BR')}</p>
          </div>
          
          <div class="section">
            <div class="section-title"> TOTAL DE ITENS</div>
            <div>
              ${itemsHtml || '<div style="text-align: center; padding: 5px; color: #666;">Nenhum item no período.</div>'}
            </div>
          </div>

          <div class="section">
            <div class="section-title">➕ ACOMPANHAMENTOS</div>
            <div>
              ${sidesHtml || '<div style="text-align: center; padding: 5px; color: #666;">Nenhum acompanhamento.</div>'}
            </div>
          </div>
        </body>
      </html>
    `);
  };

  const printOrder = (order: Order, formatOverride?: 'a4' | '58mm' | '80mm') => {
    const format = formatOverride || settings?.printerFormat || 'a4';
    const dateStr = order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString('pt-BR') : 'N/A';
    const brand = settings?.brandName || 'Grão & Sabor';

    if (format === 'a4') {
      const itemsRowsHtml = order.items.map(item => {
        let optionsHtml = '';
        if (item.cakeOptions && (item.cakeOptions.size || item.cakeOptions.dough || item.cakeOptions.fillings)) {
          optionsHtml = `
            <div class="item-sub">
              ${item.cakeOptions.size ? `<div><strong>Tamanho:</strong> ${item.cakeOptions.size}</div>` : ''}
              ${item.cakeOptions.dough ? `<div><strong>Massa:</strong> ${item.cakeOptions.dough}</div>` : ''}
              ${item.cakeOptions.fillings && item.cakeOptions.fillings.length > 0 ? `<div><strong>Recheios:</strong> ${item.cakeOptions.fillings.join(', ')}</div>` : ''}
              ${item.cakeOptions.topping ? `<div><strong>Cobertura:</strong> ${item.cakeOptions.topping}</div>` : ''}
              ${item.cakeOptions.topper ? `<div><strong>Topper:</strong> ${item.cakeOptions.topper}</div>` : ''}
            </div>
          `;
        } else if (item.sandwichOptions && item.sandwichOptions.fillings && item.sandwichOptions.fillings.length > 0) {
          optionsHtml = `<div class="item-sub"><strong>Recheios:</strong> ${item.sandwichOptions.fillings.join(', ')}</div>`;
        } else if (item.mealOptions) {
          optionsHtml = `
            <div class="item-sub">
              ${item.mealOptions.removals.length > 0 ? `<div><strong>Remover:</strong> ${item.mealOptions.removals.join(', ')}</div>` : ''}
              ${item.mealOptions.sides.length > 0 ? `<div><strong>Acompanhamentos:</strong> ${item.mealOptions.sides.map(s => s.name).join(', ')}</div>` : ''}
            </div>
          `;
        }

        const unitPrice = item.price.toFixed(2).replace('.', ',');
        const totalItemPrice = (item.price * item.quantity).toFixed(2).replace('.', ',');

        return `
          <tr>
            <td style="text-align: center; font-weight: bold; width: 45px;">${item.quantity}x</td>
            <td>
              <div class="item-title">${item.title}${item.selectedSize ? ` (${item.selectedSize.name})` : ''}</div>
              ${optionsHtml}
            </td>
            <td style="text-align: right; width: 95px;">${currencySymbol} ${unitPrice}</td>
            <td style="text-align: right; font-weight: bold; width: 105px;">${currencySymbol} ${totalItemPrice}</td>
          </tr>
        `;
      }).join('');

      printWithIframe(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Comanda #${order.id} - ${order.customerName}</title>
            <style>
              @page { size: A4 portrait; margin: 12mm 15mm; }
              @media print {
                html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
              }
              * { box-sizing: border-box; }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                color: #111827;
                margin: 0 auto;
                max-width: 680px;
                padding: 10px;
                font-size: 13px;
                line-height: 1.45;
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                border-bottom: 2px solid #111827;
                padding-bottom: 10px;
                margin-bottom: 14px;
              }
              .brand-title {
                font-size: 22px;
                font-weight: 800;
                color: #111827;
                text-transform: uppercase;
                margin: 0;
                letter-spacing: -0.5px;
              }
              .brand-sub { font-size: 11px; color: #6b7280; margin-top: 2px; }
              .order-meta { text-align: right; }
              .order-badge {
                font-family: monospace;
                font-weight: 800;
                font-size: 13px;
                background: #f3f4f6;
                border: 1px solid #d1d5db;
                padding: 3px 8px;
                border-radius: 5px;
                display: inline-block;
              }
              .order-date { font-size: 11px; color: #6b7280; margin-top: 3px; }
              .client-box {
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 10px 14px;
                margin-bottom: 14px;
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px 14px;
              }
              .client-item strong {
                font-size: 10px;
                text-transform: uppercase;
                color: #6b7280;
                display: block;
                margin-bottom: 1px;
              }
              .client-item span {
                font-size: 12.5px;
                font-weight: 600;
                color: #111827;
              }
              .items-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 14px;
              }
              .items-table th {
                background: #f3f4f6;
                border-top: 1px solid #d1d5db;
                border-bottom: 2px solid #111827;
                padding: 8px 10px;
                font-size: 11px;
                font-weight: 800;
                text-transform: uppercase;
                color: #374151;
                text-align: left;
              }
              .items-table td {
                padding: 8px 10px;
                border-bottom: 1px solid #e5e7eb;
                font-size: 12.5px;
                vertical-align: top;
              }
              .item-title { font-weight: 700; color: #111827; }
              .item-sub {
                font-size: 11px;
                color: #4b5563;
                margin-top: 2px;
                padding-left: 6px;
                border-left: 2px solid #e5e7eb;
              }
              .obs-box {
                background: #fffbeb;
                border: 1px solid #fde68a;
                border-left: 4px solid #f59e0b;
                padding: 9px 12px;
                border-radius: 6px;
                margin-bottom: 14px;
                font-size: 12px;
              }
              .obs-box strong {
                font-size: 10.5px;
                text-transform: uppercase;
                color: #92400e;
                display: block;
                margin-bottom: 2px;
              }
              .totals-box {
                display: flex;
                justify-content: flex-end;
                margin-bottom: 16px;
              }
              .totals-table { width: 280px; border-collapse: collapse; }
              .totals-table td { padding: 4px 6px; font-size: 12.5px; }
              .totals-table tr.total-row td {
                border-top: 2px solid #111827;
                padding-top: 8px;
                font-size: 17px;
                font-weight: 800;
                color: #111827;
              }
              .footer {
                border-top: 1px dashed #d1d5db;
                padding-top: 10px;
                text-align: center;
                font-size: 11px;
                color: #6b7280;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <h1 class="brand-title">${brand}</h1>
                <div class="brand-sub">Comanda de Pedido</div>
              </div>
              <div class="order-meta">
                <div class="order-badge">#${order.id}</div>
                <div class="order-date">${dateStr}</div>
              </div>
            </div>

            <div class="client-box">
              <div class="client-item">
                <strong>Cliente</strong>
                <span>${order.customerName.toUpperCase()}</span>
              </div>
              <div class="client-item">
                <strong>Telefone</strong>
                <span>${order.phone || 'Não informado'}</span>
              </div>
              <div class="client-item" style="grid-column: span 2;">
                <strong>Endereço de Entrega / Atendimento</strong>
                <span>${order.address || (order.deliveryType === 'pickup' ? 'Retirada no Balcão' : 'Não informado')}</span>
              </div>
              ${order.birthday ? `
              <div class="client-item">
                <strong>Aniversário</strong>
                <span>${order.birthday}</span>
              </div>
              ` : ''}
              ${order.email ? `
              <div class="client-item">
                <strong>E-mail</strong>
                <span>${order.email}</span>
              </div>
              ` : ''}
              <div class="client-item">
                <strong>Modalidade</strong>
                <span>${order.deliveryType === 'pickup' ? 'Retirada no Estabelecimento' : 'Entrega (Delivery)'}</span>
              </div>
            </div>

            <table class="items-table">
              <thead>
                <tr>
                  <th style="text-align: center; width: 45px;">Qtd</th>
                  <th>Item / Descrição</th>
                  <th style="text-align: right; width: 95px;">Unitário</th>
                  <th style="text-align: right; width: 105px;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRowsHtml}
              </tbody>
            </table>

            ${order.observation ? `
            <div class="obs-box">
              <strong>Observações do Pedido:</strong>
              <div>${order.observation}</div>
            </div>
            ` : ''}

            <div class="totals-box">
              <table class="totals-table">
                ${(order.deliveryFee !== undefined && order.deliveryFee > 0) ? `
                <tr>
                  <td style="color: #4b5563;">Subtotal:</td>
                  <td style="text-align: right; font-weight: 600;">${currencySymbol} ${(order.subtotal || (order.total - order.deliveryFee)).toFixed(2).replace('.', ',')}</td>
                </tr>
                <tr>
                  <td style="color: #4b5563;">Taxa de Entrega:</td>
                  <td style="text-align: right; font-weight: 600;">+ ${currencySymbol} ${order.deliveryFee.toFixed(2).replace('.', ',')}</td>
                </tr>
                ` : order.deliveryType === 'pickup' ? `
                <tr>
                  <td style="color: #4b5563;">Entrega:</td>
                  <td style="text-align: right; font-weight: 600; color: #059669;">Retirada Grátis</td>
                </tr>
                ` : ''}
                <tr class="total-row">
                  <td>TOTAL:</td>
                  <td style="text-align: right;">${currencySymbol} ${order.total.toFixed(2).replace('.', ',')}</td>
                </tr>
              </table>
            </div>

            <div class="footer">
              Obrigado pela preferência! • ${brand}
            </div>
          </body>
        </html>
      `);
      return;
    }

    const is80 = format === '80mm';
    const paperWidth = is80 ? '80mm' : '58mm';
    const printWidth = is80 ? '72mm' : '48mm';
    const bodyFont = is80 ? '11px' : '10px';
    const titleFont = is80 ? '13px' : '12px';

    let itemsHtml = order.items.map(item => {
      let optionsHtml = '';
      if (item.cakeOptions && (item.cakeOptions.size || item.cakeOptions.dough || item.cakeOptions.fillings)) {
        optionsHtml = `
          <div class="item-sub">
            ${item.cakeOptions.size ? `<div>TAMANHO: ${item.cakeOptions.size}</div>` : ''}
            ${item.cakeOptions.dough ? `<div>MASSA: ${item.cakeOptions.dough}</div>` : ''}
            ${item.cakeOptions.fillings && item.cakeOptions.fillings.length > 0 ? `<div>RECHEIOS: ${item.cakeOptions.fillings.join(', ')}</div>` : ''}
            ${item.cakeOptions.topping ? `<div>COBERTURA: ${item.cakeOptions.topping}</div>` : ''}
            ${item.cakeOptions.topper ? `<div>TOPPER: ${item.cakeOptions.topper}</div>` : ''}
          </div>
        `;
      } else if (item.sandwichOptions && item.sandwichOptions.fillings && item.sandwichOptions.fillings.length > 0) {
        optionsHtml = `
          <div class="item-sub">
            <div>RECHEIOS: ${item.sandwichOptions.fillings.join(', ')}</div>
          </div>
        `;
      } else if (item.mealOptions) {
        optionsHtml = `
          <div class="item-sub">
            ${item.mealOptions.removals.length > 0 ? `<div>REMOVER: ${item.mealOptions.removals.join(', ')}</div>` : ''}
            ${item.mealOptions.sides.length > 0 ? `<div>ACOMPANHAMENTOS: ${item.mealOptions.sides.map(s => s.name).join(', ')}</div>` : ''}
          </div>
        `;
      }

      return `
        <div class="item-row">
          <div class="item-main">
            <span>${item.quantity}x ${item.title.toUpperCase()}${item.selectedSize ? ` (${item.selectedSize.name.toUpperCase()})` : ''}</span>
            <span>${currencySymbol} ${(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
          </div>
          ${optionsHtml}
        </div>
      `;
    }).join('');

    printWithIframe(`
      <html>
        <head>
          <title>Comanda - ${order.customerName}</title>
          <style>
            @page { size: ${paperWidth} auto; margin: 0; }
            @media print {
              html, body { width: ${paperWidth} !important; margin: 0 !important; padding: 0 !important; }
            }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              width: ${printWidth}; 
              max-width: ${printWidth}; 
              padding: 1.5mm 1mm; 
              margin: 0 auto; 
              font-size: ${bodyFont}; 
              color: #000;
              line-height: 1.25;
            }
            .header { text-align: center; border-bottom: 2px double #000; padding-bottom: 4px; margin-bottom: 6px; }
            .header h2 { margin: 0; font-size: ${titleFont}; text-transform: uppercase; font-weight: bold; }
            .header p { margin: 1px 0 0 0; font-size: 8.5px; }
            .section { margin-bottom: 5px; }
            .label { font-weight: bold; font-size: 9px; text-transform: uppercase; }
            .value { font-size: 10px; margin-top: 1px; }
            .item-row { border-bottom: 1px dashed #000; padding: 3px 0; font-size: 10px; }
            .item-main { display: flex; justify-content: space-between; font-weight: bold; }
            .item-sub { font-size: 8.5px; color: #222; padding-left: 6px; margin-top: 2px; line-height: 1.2; }
            .divider { border-top: 1px dashed #000; margin: 4px 0; }
            .double-divider { border-top: 2px solid #000; margin: 4px 0; }
            .total-section { text-align: right; font-size: 9px; margin-top: 4px; }
            .total { text-align: right; font-weight: bold; font-size: 11.5px; margin-top: 4px; text-transform: uppercase; border-top: 1.5px solid #000; padding-top: 3px; }
            .footer-receipt { text-align: center; font-size: 8px; margin-top: 6px; padding-top: 4px; border-top: 1px dashed #000; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${brand}</h2>
            <p>${dateStr}</p>
          </div>
          
          <div class="section">
            <span class="label">CLIENTE:</span>
            <span class="value">${order.customerName.toUpperCase()}</span>
          </div>
          
          <div class="section">
            <span class="label">TELEFONE:</span>
            <span class="value">${order.phone}</span>
          </div>
          
          ${order.email ? `
          <div class="section">
            <span class="label">EMAIL:</span>
            <span class="value">${order.email}</span>
          </div>
          ` : ''}
          
          <div class="section">
            <span class="label">ENDEREÇO:</span>
            <span class="value">${order.address.toUpperCase()}</span>
          </div>
          
          ${order.birthday ? `
          <div class="section">
            <span class="label">ANIVERSÁRIO:</span>
            <span class="value">${order.birthday}</span>
          </div>
          ` : ''}
          
          <div class="divider"></div>
          
          <div class="section">
            <div class="label" style="margin-bottom: 2px;">ITENS DO PEDIDO:</div>
            ${itemsHtml}
          </div>
          
          ${order.observation ? `
          <div class="divider"></div>
          <div class="section">
            <div class="label">OBSERVAÇÃO:</div>
            <div class="value" style="font-style: italic;">${order.observation.toUpperCase()}</div>
          </div>
          ` : ''}
          
          <div class="divider"></div>
          <div class="section" style="opacity: 0.85; font-size: 8.5px;">
            ID: ${order.id}<br/>
            DATA DO PEDIDO: ${dateStr}
          </div>
          
          ${(order.deliveryFee !== undefined && order.deliveryFee > 0) ? `
          <div class="total-section">
            <div>SUBTOTAL: ${currencySymbol} ${(order.subtotal || (order.total - (order.deliveryFee || 0))).toFixed(2).replace('.', ',')}</div>
            <div style="margin-top: 1px;">TAXA ENTREGA ${order.deliveryDistanceKm ? `(${order.deliveryDistanceKm} km)` : ''}: + ${currencySymbol} ${order.deliveryFee.toFixed(2).replace('.', ',')}</div>
          </div>
          ` : order.deliveryType === 'pickup' ? `
          <div class="total-section">
            <div>RETIRADA NO ESTABELECIMENTO: GRÁTIS</div>
          </div>
          ` : ''}
          
          <div class="total">
            TOTAL: ${currencySymbol} ${order.total.toFixed(2).replace('.', ',')}
          </div>

          <div class="footer-receipt">
            Obrigado pela preferência!<br/>
            ${brand}
          </div>
        </body>
      </html>
    `);
  };

  const printTestPage = (formatOverride?: 'a4' | '58mm' | '80mm') => {
    const format = formatOverride || settings?.printerFormat || 'a4';
    const brand = settings?.brandName || 'GRÃO & SABOR';

    if (format === 'a4') {
      printWithIframe(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Teste de Impressão A4 - ${brand}</title>
            <style>
              @page { size: A4 portrait; margin: 15mm 20mm; }
              @media print {
                html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                color: #111827;
                max-width: 680px;
                margin: 0 auto;
                padding: 20px;
                line-height: 1.5;
              }
              .box {
                border: 2px solid #111827;
                border-radius: 10px;
                padding: 24px;
                text-align: center;
              }
              h1 { font-size: 24px; text-transform: uppercase; margin: 0 0 4px 0; }
              .badge { display: inline-block; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 4px 12px; border-radius: 9999px; font-weight: bold; font-size: 12px; margin-top: 8px; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; text-align: left; }
              th, td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
              th { background: #f9fafb; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="box">
              <h1>${brand}</h1>
              <div style="font-size: 14px; color: #4b5563;">Teste de Impressão no Formato A4 / Sulfite</div>
              <div class="badge">✓ IMPRESSORA E FORMATO CALIBRADOS NO ESQUADRO DO PAPEL</div>
              <table>
                <thead>
                  <tr>
                    <th>Item de Teste</th>
                    <th style="text-align: center;">Qtd</th>
                    <th style="text-align: right;">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Exemplo de Produto / Cardápio</td>
                    <td style="text-align: center;">1x</td>
                    <td style="text-align: right;">${currencySymbol} 45,00</td>
                  </tr>
                  <tr>
                    <td>Exemplo de Acompanhamento</td>
                    <td style="text-align: center;">1x</td>
                    <td style="text-align: right;">${currencySymbol} 12,00</td>
                  </tr>
                </tbody>
              </table>
              <div style="text-align: right; font-size: 16px; font-weight: 800; border-top: 2px solid #111; padding-top: 8px;">
                TOTAL: ${currencySymbol} 57,00
              </div>
              <div style="margin-top: 24px; font-size: 12px; color: #6b7280;">
                Data do teste: ${new Date().toLocaleString('pt-BR')} • Sistema Operando Perfeitamente
              </div>
            </div>
          </body>
        </html>
      `);
      return;
    }

    const is80 = format === '80mm';
    const paperWidth = is80 ? '80mm' : '58mm';
    const printWidth = is80 ? '72mm' : '48mm';

    printWithIframe(`
      <html>
        <head>
          <title>Teste de Impressão Térmica</title>
          <style>
            @page { size: ${paperWidth} auto; margin: 0; }
            @media print {
              html, body { width: ${paperWidth} !important; margin: 0 !important; padding: 0 !important; }
            }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              width: ${printWidth}; 
              max-width: ${printWidth}; 
              padding: 1.5mm 1mm; 
              margin: 0 auto; 
              font-size: ${is80 ? '11px' : '10px'}; 
              color: #000;
              line-height: 1.25;
            }
            .center { text-align: center; }
            .divider { border-top: 1px dashed #000; margin: 4px 0; }
            .double { border-top: 2px solid #000; margin: 5px 0; }
            .row { display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="center">
            <h2 style="margin: 0; font-size: ${is80 ? '14px' : '12px'};">${brand}</h2>
            <div style="font-size: 8px; font-weight: bold; margin: 2px 0;">TESTE DE IMPRESSÃO TÉRMICA (${paperWidth.toUpperCase()})</div>
          </div>
          <div class="double"></div>
          <div><strong>FORMATO:</strong> Bobina ${paperWidth}</div>
          <div><strong>LARGURA ÚTIL:</strong> ${printWidth}</div>
          <div><strong>STATUS:</strong> CONFIGURADA E ATIVA</div>
          <div><strong>DATA:</strong> ${new Date().toLocaleString('pt-BR')}</div>
          <div class="divider"></div>
          <div class="center" style="font-weight: bold; font-size: 9px;">EXEMPLO DE COMANDA</div>
          <div class="divider"></div>
          <div class="row"><span>1x Bolo Especial</span><span>R$ 45,00</span></div>
          <div class="row"><span>1x Café Artesanal</span><span>R$ 12,00</span></div>
          <div class="divider"></div>
          <div class="row" style="font-weight: bold; font-size: 11px;"><span>TOTAL:</span><span>R$ 57,00</span></div>
          <div class="double"></div>
          <div class="center" style="font-size: 8px;">
            IMPRESSORA CONFIGURADA COM SUCESSO!<br/>
            ${brand}
          </div>
        </body>
      </html>
    `);
  };

  const isBirthdayThisWeek = (birthdayStr: string, orderLanguage?: string) => {
    if (!birthdayStr) return false;
    
    const cleaned = birthdayStr.trim().replace(/[\s\.-]+/g, '/');
    const parts = cleaned.split('/');
    if (parts.length < 2) return false;
    
    let p0 = parseInt(parts[0]);
    let p1 = parseInt(parts[1]);
    
    if (isNaN(p0) || isNaN(p1)) return false;
    
    let day = p0;
    let month = p1 - 1; // 0-indexed month
    
    if (p0 <= 12 && p1 > 12) {
      day = p1;
      month = p0 - 1;
    } else {
      day = p0;
      month = p1 - 1;
    }
    
    if (month < 0 || month > 11 || day < 1 || day > 31) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();
    
    const checkDates = [
      new Date(currentYear - 1, month, day),
      new Date(currentYear, month, day),
      new Date(currentYear + 1, month, day)
    ];
    
    return checkDates.some(bday => {
      const diffTime = bday.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= -3 && diffDays <= 7;
    });
  };

  const orderBelongsToCatalog = (order: Order, catalogId: 'catalog1' | 'catalog2' | 'catalog3' | 'catalog4') => {
    if (!order.items || order.items.length === 0) return false;
    return order.items.some(item => {
      const prod = products.find(p => p.title === item.title);
      if (!prod) return false;
      const catObj = categories.find(c => c.id === prod.categoryId);
      if (!catObj) return false;
      const catVal = catObj.catalog || 'catalog1';
      return catVal === catalogId || catVal === 'both' || catVal === 'all';
    });
  };

  const filteredProducts = useMemo(() => {
    const query = productSearch.toLowerCase().trim();
    if (!query) return products;
    return products.filter(product => 
      product.title.toLowerCase().includes(query) || 
      (product.description || '').toLowerCase().includes(query)
    );
  }, [products, productSearch]);

  const filteredOrders = orders.filter(order => {
    const custName = (order.customerName || order.b2bCompanyName || '').toLowerCase();
    const query = orderSearch.toLowerCase().trim();
    const matchesSearch = !query || custName.includes(query) || (order.phone || '').includes(query) || (order.id || '').toLowerCase().includes(query);
    
    const parseDateString = (str: string, _lang?: string) => {
      if (!str || !str.includes('/')) return null;
      const parts = str.split('/');
      if (parts.length !== 3) return null;
      
      let day = parseInt(parts[0]);
      let month = parseInt(parts[1]);
      let year = parseInt(parts[2]);

      // If parts[0] > 12, it's definitely DD/MM/YYYY
      if (month > 12) {
        month = parseInt(parts[0]);
        day = parseInt(parts[1]);
      }
      
      if (!day || !month || !year || month > 12) return null;
      const d = new Date(year, month - 1, day);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    let matchesDate = true;
    if (startDate || endDate) {
      let orderDate: Date | null = null;
      if (order.pickupDate) {
        orderDate = parseDateString(order.pickupDate, order.orderLanguage || settings.language || 'pt');
      }
      
      if (!orderDate) {
        if (order.createdAt?.toDate) {
          orderDate = order.createdAt.toDate();
        } else if (order.createdAt?.seconds) {
          orderDate = new Date(order.createdAt.seconds * 1000);
        } else if (typeof order.createdAt === 'string') {
          const parsed = Date.parse(order.createdAt);
          if (!isNaN(parsed)) orderDate = new Date(parsed);
        }
      }

      if (orderDate) {
        orderDate = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
        if (startDate && startDate.length === 10) {
          const start = parseDateString(startDate, settings.language || 'pt');
          if (start && orderDate < start) matchesDate = false;
        }
        if (endDate && endDate.length === 10) {
          const end = parseDateString(endDate, settings.language || 'pt');
          if (end && orderDate > end) matchesDate = false;
        }
      } else {
        matchesDate = false;
      }
    }

    let matchesValidated = true;
    if (filterValidatedOnly) {
      matchesValidated = order.paymentStatus === 'half' || order.paymentStatus === 'full';
    }
    
    return matchesSearch && matchesDate && matchesValidated;
  }).sort((a, b) => {
    const getMs = (o: Order) => {
      if (o.createdAt?.toDate) return o.createdAt.toDate().getTime();
      if (o.createdAt?.seconds) return o.createdAt.seconds * 1000;
      if (typeof o.createdAt === 'string') {
        const parsed = Date.parse(o.createdAt);
        if (!isNaN(parsed)) return parsed;
      }
      return 0;
    };
    return getMs(b) - getMs(a);
  });

  const batchSummary = useMemo(() => {
    const summary: { [key: string]: number } = {};
    const sidesSummary: { [key: string]: number } = {};

    filteredOrders.forEach(order => {
      order.items?.forEach(item => {
        const key = item.title;
        summary[key] = (summary[key] || 0) + item.quantity;

        if (item.mealOptions?.sides) {
          item.mealOptions.sides.forEach(side => {
            sidesSummary[side.name] = (sidesSummary[side.name] || 0) + item.quantity;
          });
        }
      });
    });

    return { items: summary, sides: sidesSummary };
  }, [filteredOrders]);

  // Financial Preset Helpers
  const setPresetThisMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setFinanceStartDate(firstDay.toISOString().split('T')[0]);
    setFinanceEndDate(lastDay.toISOString().split('T')[0]);
  };

  const setPresetLastMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    setFinanceStartDate(firstDay.toISOString().split('T')[0]);
    setFinanceEndDate(lastDay.toISOString().split('T')[0]);
  };

  const setPresetLast30Days = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);
    setFinanceStartDate(start.toISOString().split('T')[0]);
    setFinanceEndDate(end.toISOString().split('T')[0]);
  };

  const setPresetAllTime = () => {
    setFinanceStartDate('');
    setFinanceEndDate('');
  };

  // Financial Calculations useMemo
  const { filteredFinanceOrders, filteredFinanceVariableCosts, totalRevenue, appliedFixed, totalVariable, netProfit, daysInPeriod, monthlyFixedSum } = useMemo(() => {
    const start = financeStartDate ? new Date(financeStartDate + 'T00:00:00') : null;
    const end = financeEndDate ? new Date(financeEndDate + 'T23:59:59') : null;

    const parseDateStr = (str: string, lang: string = 'pt') => {
      if (!str) return null;
      if (str.includes('-')) {
        const parts = str.split('-');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            d.setHours(0,0,0,0);
            return d;
          }
        }
      }
      if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3) {
          if (lang === 'en') {
            const d = new Date(parseInt(parts[2], 10), parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
            d.setHours(0,0,0,0);
            return d;
          } else {
            const d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
            d.setHours(0,0,0,0);
            return d;
          }
        }
      }
      const parsed = Date.parse(str);
      if (!isNaN(parsed)) {
        const d = new Date(parsed);
        d.setHours(0,0,0,0);
        return d;
      }
      return null;
    };

    // 1. Filter Orders
    const filteredOrders = orders.filter(order => {
      let orderDate: Date | null = null;
      if (order.pickupDate) {
        orderDate = parseDateStr(order.pickupDate, order.orderLanguage || settings.language || 'pt');
      }
      if (!orderDate && order.createdAt?.toDate) {
        const dateFromCreated = order.createdAt.toDate();
        if (dateFromCreated) {
          dateFromCreated.setHours(0, 0, 0, 0);
          orderDate = dateFromCreated;
        }
      }
      if (!orderDate) return false;
      if (start && orderDate < start) return false;
      if (end && orderDate > end) return false;
      return true;
    });

    const rev = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);

    // 2. Fixed Costs
    const rent = settings.fixedRent || 0;
    const internet = settings.fixedInternet || 0;
    const electricity = settings.fixedElectricity || 0;
    const water = settings.fixedWater || 0;
    const gas = settings.fixedGas || 0;
    const sistemas = settings.fixedSistemas || 0;
    const marketing = settings.fixedMarketing || 0;
    const contabilidade = settings.fixedContabilidade || 0;
    const salarios = settings.fixedSalarios || 0;
    const mei = settings.fixedMei || 0;
    
    const customSum = settings.customFixedCosts
      ? settings.customFixedCosts.reduce((sum, item) => sum + (item.amount || 0), 0)
      : 0;

    const monthlySum = rent + internet + electricity + water + gas + sistemas + marketing + contabilidade + salarios + mei + customSum;

    // Calculate days difference
    let days = 30;
    if (financeStartDate && financeEndDate) {
      const s = new Date(financeStartDate + 'T00:00:00');
      const e = new Date(financeEndDate + 'T00:00:00');
      const diffTime = Math.abs(e.getTime() - s.getTime());
      days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    let appliedFix = monthlySum;
    if (isProportionalFixed && financeStartDate && financeEndDate) {
      appliedFix = (monthlySum / 30) * days;
    }

    // 3. Variable Costs
    const filteredVarCosts = variableCosts.filter(vc => {
      if (!vc.date) return false;
      const vcDate = new Date(vc.date + 'T12:00:00');
      if (start && vcDate < start) return false;
      if (end && vcDate > end) return false;
      return true;
    });

    const totVar = filteredVarCosts.reduce((sum, vc) => sum + (vc.amount || 0), 0);

    // 4. Net Profit
    const profit = rev - appliedFix - totVar;

    return {
      filteredFinanceOrders: filteredOrders,
      filteredFinanceVariableCosts: filteredVarCosts,
      totalRevenue: rev,
      appliedFixed: appliedFix,
      totalVariable: totVar,
      netProfit: profit,
      daysInPeriod: days,
      monthlyFixedSum: monthlySum
    };
  }, [orders, settings, variableCosts, financeStartDate, financeEndDate, isProportionalFixed]);

  const handlePrintFinancialReport = () => {
    const periodLabel = financeStartDate && financeEndDate 
      ? `Período: ${new Date(financeStartDate + 'T12:00:00').toLocaleDateString('pt-BR')} até ${new Date(financeEndDate + 'T12:00:00').toLocaleDateString('pt-BR')}`
      : 'Período: Todo o Histórico Registrado';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Não foi possível abrir a janela de impressão. Por favor, permita pop-ups no seu navegador.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Relatório Financeiro - Grão & Sabor</title>
        <style>
          * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          body { padding: 30px; color: #1c1412; background: #fff; line-height: 1.4; }
          .header { text-align: center; border-bottom: 2px solid #865d39; padding-bottom: 15px; margin-bottom: 20px; }
          .header h1 { margin: 0; color: #865d39; font-size: 26px; font-family: 'Playfair Display', serif, Georgia; }
          .header h2 { margin: 5px 0; font-size: 15px; color: #555; }
          .header p { margin: 4px 0 0; font-size: 13px; color: #777; font-weight: bold; }
          .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 25px; }
          .card { border: 1px solid #ddd; border-radius: 10px; padding: 12px; background: #fafafa; }
          .card-title { font-size: 10px; text-transform: uppercase; font-weight: bold; color: #666; margin-bottom: 4px; }
          .card-value { font-size: 18px; font-weight: bold; color: #1c1412; }
          .card.revenue { border-color: #10b981; background: #f0fdf4; color: #065f46; }
          .card.profit { border-color: #059669; background: #ecfdf5; color: #047857; }
          .card.fixed { border-color: #f59e0b; background: #fffbeb; color: #92400e; }
          .card.variable { border-color: #ef4444; background: #fef2f2; color: #991b1b; }
          h3 { font-size: 15px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-top: 25px; margin-bottom: 12px; color: #865d39; font-family: serif; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
          th { background: #f3f4f6; text-align: left; padding: 8px; font-weight: bold; border-bottom: 2px solid #d1d5db; }
          td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
          tr:nth-child(even) { background-color: #f9fafb; }
          .text-right { text-align: right; }
          .total-row { font-weight: bold; background: #f3f4f6; }
          .footer { margin-top: 40px; font-size: 11px; text-align: center; color: #888; border-top: 1px solid #e5e7eb; padding-top: 12px; }
          @media print {
            body { padding: 10mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Grão & Sabor</h1>
          <h2>Relatório Financeiro por Período</h2>
          <p>${periodLabel}</p>
        </div>

        <div class="cards">
          <div class="card revenue">
            <div class="card-title">Receita (Faturamento)</div>
            <div class="card-value">R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div style="font-size: 11px; margin-top: 4px;">${filteredFinanceOrders.length} pedidos</div>
          </div>
          <div class="card fixed">
            <div class="card-title">Custos Fixos Aplicados</div>
            <div class="card-value">R$ ${appliedFixed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div style="font-size: 11px; margin-top: 4px;">Soma mensal: R$ ${monthlyFixedSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="card variable">
            <div class="card-title">Custos Variáveis</div>
            <div class="card-value">R$ ${totalVariable.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div style="font-size: 11px; margin-top: 4px;">${filteredFinanceVariableCosts.length} despesas</div>
          </div>
          <div class="card profit">
            <div class="card-title">Lucro Líquido</div>
            <div class="card-value">R$ ${netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div style="font-size: 11px; margin-top: 4px;">${netProfit >= 0 ? 'Resultado Positivo' : 'Resultado Negativo'}</div>
          </div>
        </div>

        <h3>1. Pedidos do Período (${filteredFinanceOrders.length})</h3>
        ${filteredFinanceOrders.length === 0 ? '<p style="font-size: 12px; color: #666;">Nenhum pedido registrado no período selecionado.</p>' : `
          <table>
            <thead>
              <tr>
                <th>Data / Entrega</th>
                <th>Cliente</th>
                <th>Telefone</th>
                <th>Tipo</th>
                <th class="text-right">Valor Total</th>
              </tr>
            </thead>
            <tbody>
              ${filteredFinanceOrders.map(order => `
                <tr>
                  <td>${order.pickupDate || (order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('pt-BR') : '-')}</td>
                  <td>${order.customerName || 'Cliente'}</td>
                  <td>${order.phone || '-'}</td>
                  <td>${order.deliveryType === 'delivery' ? 'Entrega' : 'Retirada'}</td>
                  <td class="text-right">R$ ${Number(order.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="4">TOTAL RECEITA:</td>
                <td class="text-right">R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        `}

        <h3>2. Custos Variáveis do Período (${filteredFinanceVariableCosts.length})</h3>
        ${filteredFinanceVariableCosts.length === 0 ? '<p style="font-size: 12px; color: #666;">Nenhum custo variável lançado no período selecionado.</p>' : `
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição do Gasto</th>
                <th class="text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${filteredFinanceVariableCosts.map((vc: any) => `
                <tr>
                  <td>${vc.date ? new Date(vc.date + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                  <td>${vc.description || 'Gasto'}</td>
                  <td class="text-right">R$ ${Number(vc.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="2">TOTAL CUSTOS VARIÁVEIS:</td>
                <td class="text-right">R$ ${totalVariable.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        `}

        <div class="footer">
          Relatório emitido em ${new Date().toLocaleString('pt-BR')} — Grão & Sabor
        </div>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };



  const currencySymbol = getCurrencySymbol(settings?.currency);

  if (!isLoggedIn) {
    return (
      <div className="flex-grow flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass p-8 rounded-3xl w-full max-w-md shadow-2xl"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="h-24 w-24 flex items-center justify-center mb-4 rounded-full overflow-hidden border-2 border-white shadow-md bg-white">
              <img src={settings?.logo} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <h1 className="text-2xl font-serif font-bold opacity-90">Painel adm - Easy menu</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password" 
              placeholder="Senha de acesso"
              className="w-full p-4 rounded-xl border border-gray-300 focus:ring-2 outline-none"
              style={{ '--tw-ring-color': settings?.primaryColor || '#865d39' } as any}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button 
              type="submit"
              className="w-full py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-all cursor-pointer"
              style={{ 
                backgroundColor: settings?.primaryColor || '#865d39',
                color: getContrastText(settings?.primaryColor || '#865d39')
              }}
            >
              Entrar
            </button>
            <button 
              type="button"
              onClick={() => {
                setIsLoggedIn(false);
                setIsAdmin(false);
                window.location.hash = '';
                window.history.pushState({}, '', '/');
              }}
              className="w-full py-3 px-4 rounded-xl font-medium text-sm text-gray-700 bg-white/80 hover:bg-white border border-gray-300 shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft size={16} /> Voltar para o Cardápio
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col md:flex-row md:h-screen md:overflow-hidden text-gray-900">
      <div className="w-full md:w-64 glass border-r border-white/20 p-4 md:p-6 flex flex-col gap-4 md:gap-8 md:overflow-y-auto">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 flex items-center justify-center rounded-full overflow-hidden border border-white/50 bg-white shadow-sm">
            <img src={settings?.logo} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <span className="font-serif font-bold text-lg opacity-90">{settings?.brandName || 'Grão & Sabor'}</span>
        </div>
        
        <nav className="flex flex-col gap-2.5">
          <button 
            onClick={() => setActiveTab('orders')}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-all font-semibold border text-left",
              activeTab === 'orders' 
                ? "shadow-md font-bold border-transparent" 
                : "border-black/15 bg-white/60 hover:bg-white text-gray-900 shadow-2xs hover:border-black/30"
            )}
            style={activeTab === 'orders' ? { backgroundColor: settings?.primaryColor || '#865d39', color: getContrastText(settings?.primaryColor || '#865d39') } : {}}
          >
            <History size={20} /> Histórico de Pedidos
          </button>
          <button 
            onClick={() => setActiveTab('customers')}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-all font-semibold border text-left",
              activeTab === 'customers' 
                ? "shadow-md font-bold border-transparent" 
                : "border-black/15 bg-white/60 hover:bg-white text-gray-900 shadow-2xs hover:border-black/30"
            )}
            style={activeTab === 'customers' ? { backgroundColor: settings?.primaryColor || '#865d39', color: getContrastText(settings?.primaryColor || '#865d39') } : {}}
          >
            <Users size={20} /> Clientes
          </button>
          <button 
            onClick={() => setActiveTab('categories')}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-all font-semibold border text-left",
              activeTab === 'categories' 
                ? "shadow-md font-bold border-transparent" 
                : "border-black/15 bg-white/60 hover:bg-white text-gray-900 shadow-2xs hover:border-black/30"
            )}
            style={activeTab === 'categories' ? { backgroundColor: settings?.primaryColor || '#865d39', color: getContrastText(settings?.primaryColor || '#865d39') } : {}}
          >
            <Layers size={20} /> Categorias
          </button>
          <button 
            onClick={() => setActiveTab('menu')}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-all font-semibold border text-left",
              activeTab === 'menu' 
                ? "shadow-md font-bold border-transparent" 
                : "border-black/15 bg-white/60 hover:bg-white text-gray-900 shadow-2xs hover:border-black/30"
            )}
            style={activeTab === 'menu' ? { backgroundColor: settings?.primaryColor || '#865d39', color: getContrastText(settings?.primaryColor || '#865d39') } : {}}
          >
            <Package size={20} /> Gerenciar Cardápio
          </button>

          <button 
            onClick={() => setActiveTab('sortMenu')}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-all font-semibold border text-left",
              activeTab === 'sortMenu' 
                ? "shadow-md font-bold border-transparent" 
                : "border-black/15 bg-white/60 hover:bg-white text-gray-900 shadow-2xs hover:border-black/30"
            )}
            style={activeTab === 'sortMenu' ? { backgroundColor: settings?.primaryColor || '#865d39', color: getContrastText(settings?.primaryColor || '#865d39') } : {}}
          >
            <ArrowUpDown size={20} /> Organizar Cardápio
          </button>

          <button 
            onClick={() => setActiveTab('finance')}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-all font-semibold border text-left",
              activeTab === 'finance' 
                ? "shadow-md font-bold border-transparent" 
                : "border-black/15 bg-white/60 hover:bg-white text-gray-900 shadow-2xs hover:border-black/30"
            )}
            style={activeTab === 'finance' ? { backgroundColor: settings?.primaryColor || '#865d39', color: getContrastText(settings?.primaryColor || '#865d39') } : {}}
          >
            <DollarSign size={20} /> Financeiro
          </button>

          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-all font-semibold border text-left",
              activeTab === 'settings' 
                ? "shadow-md font-bold border-transparent" 
                : "border-black/15 bg-white/60 hover:bg-white text-gray-900 shadow-2xs hover:border-black/30"
            )}
            style={activeTab === 'settings' ? { backgroundColor: settings?.primaryColor || '#865d39', color: getContrastText(settings?.primaryColor || '#865d39') } : {}}
          >
            <SettingsIcon size={20} /> Configurações
          </button>

          <button 
            onClick={() => setActiveTab('posvenda')}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-all font-semibold border text-left",
              activeTab === 'posvenda' 
                ? "shadow-md font-bold border-transparent" 
                : "border-black/15 bg-white/60 hover:bg-white text-gray-900 shadow-2xs hover:border-black/30"
            )}
            style={activeTab === 'posvenda' ? { backgroundColor: settings?.primaryColor || '#865d39', color: getContrastText(settings?.primaryColor || '#865d39') } : {}}
          >
            <MessageSquare size={20} /> Pós-Venda
          </button>
        </nav>

        <button 
          onClick={() => {
            setIsLoggedIn(false);
            setIsAdmin(false);
            window.location.hash = '';
            window.history.pushState({}, '', '/');
          }}
          className="mt-auto flex items-center gap-3 p-3 rounded-xl border border-red-200 bg-red-50/70 hover:bg-red-100 text-red-600 transition-all font-bold cursor-pointer shadow-2xs text-left"
        >
          <LogOut size={20} /> Sair
        </button>
      </div>

      <main id="admin-main-content" className="flex-grow p-4 md:p-10 overflow-y-auto min-w-0 w-full">
        {activeTab === 'finance' && (
          <div className="max-w-6xl space-y-8 pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200/50 pb-6">
              <div>
                <h1 className="text-3xl font-serif font-black" style={{ color: settings.primaryColor || '#865d39' }}>Painel Financeiro</h1>
                <p className="text-sm text-black font-semibold opacity-70">
                  Monitore receitas, custos fixos, custos variáveis e o lucro líquido do seu negócio.
                </p>
              </div>

              {/* Date Filters */}
              <div className="flex flex-col gap-2 bg-white p-4 rounded-2xl border border-gray-200/60 shadow-sm animate-fade-in">
                <div className="text-[10px] font-bold uppercase text-gray-500 mb-1">Filtrar por Período</div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-xl px-3 py-1.5 shadow-inner">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">De:</span>
                    <input 
                      type="date" 
                      className="border-0 bg-transparent text-xs font-bold text-gray-800 outline-none"
                      value={financeStartDate}
                      onChange={e => setFinanceStartDate(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-xl px-3 py-1.5 shadow-inner">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Até:</span>
                    <input 
                      type="date" 
                      className="border-0 bg-transparent text-xs font-bold text-gray-800 outline-none"
                      value={financeEndDate}
                      onChange={e => setFinanceEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-100">
                  <div className="flex flex-wrap gap-1">
                    <button onClick={setPresetThisMonth} className="px-2 py-1 text-[10px] font-bold uppercase bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-all cursor-pointer">Este Mês</button>
                    <button onClick={setPresetLastMonth} className="px-2 py-1 text-[10px] font-bold uppercase bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-all cursor-pointer">Mês Passado</button>
                    <button onClick={setPresetLast30Days} className="px-2 py-1 text-[10px] font-bold uppercase bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-all cursor-pointer">Últimos 30 dias</button>
                    <button onClick={setPresetAllTime} className="px-2 py-1 text-[10px] font-bold uppercase bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-all cursor-pointer">Ver Tudo</button>
                  </div>
                  <button 
                    onClick={handlePrintFinancialReport}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase text-white rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer ml-auto"
                    style={{ backgroundColor: settings?.primaryColor || '#865d39' }}
                    title="Imprimir relatório completo deste período"
                  >
                    <Printer size={14} /> Imprimir por Período
                  </button>
                </div>
              </div>
            </div>

            {/* Metrics Dashboard Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
              {/* Revenue Card */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
                <div className="absolute right-3 top-3 bg-emerald-500/10 text-emerald-700 p-2 rounded-xl">
                  <DollarSign size={22} />
                </div>
                <div className="text-xs font-bold uppercase text-emerald-800/80 tracking-wider">Receita (Faturamento)</div>
                <div className="text-2xl font-black text-emerald-950 mt-1">
                  {currencySymbol} {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] font-bold text-emerald-700/80 mt-1 uppercase">
                  {filteredFinanceOrders.length} {filteredFinanceOrders.length === 1 ? 'Pedido no período' : 'Pedidos no período'}
                </div>
              </div>

              {/* Fixed Costs Card */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
                <div className="absolute right-3 top-3 bg-amber-500/10 text-amber-700 p-2 rounded-xl">
                  <Save size={22} />
                </div>
                <div className="text-xs font-bold uppercase text-amber-800/80 tracking-wider">Custos Fixos Aplicados</div>
                <div className="text-2xl font-black text-amber-950 mt-1">
                  {currencySymbol} {appliedFixed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] font-bold text-amber-700/80 mt-1 uppercase flex items-center gap-1">
                  <span>Soma mensal: {currencySymbol} {monthlyFixedSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Variable Costs Card */}
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
                <div className="absolute right-3 top-3 bg-rose-500/10 text-rose-700 p-2 rounded-xl">
                  <Trash2 size={22} />
                </div>
                <div className="text-xs font-bold uppercase text-rose-800/80 tracking-wider">Custos Variáveis</div>
                <div className="text-2xl font-black text-rose-950 mt-1">
                  {currencySymbol} {totalVariable.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] font-bold text-rose-700/80 mt-1 uppercase">
                  No período selecionado
                </div>
              </div>

              {/* Net Profit Card */}
              <div className={cn(
                "rounded-2xl p-5 shadow-md relative overflow-hidden flex flex-col justify-between h-32 border transition-all",
                netProfit >= 0 
                  ? "bg-emerald-600 border-emerald-700 text-white" 
                  : "bg-rose-600 border-rose-700 text-white"
              )}>
                <div className="absolute right-3 top-3 bg-white/20 p-2 rounded-xl">
                  <Coins size={22} />
                </div>
                <div className="text-xs font-bold uppercase tracking-wider opacity-85">LUCRO LÍQUIDO</div>
                <div className="text-2xl font-black mt-1">
                  {currencySymbol} {netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] font-bold uppercase opacity-85">
                  {netProfit >= 0 ? 'Resultado Positivo' : 'Prejuízo no período'}
                </div>
              </div>
            </div>

            {/* Split Input Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Column 1: Configuração Custos Fixos */}
              <div className="p-6 rounded-2xl space-y-4 shadow-sm border border-gray-200/50 bg-white">
                <div className="border-b border-gray-200/50 pb-2 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold font-serif text-gray-800">Custos Fixos Mensais</h2>
                    <p className="text-xs text-gray-500">Deixe em branco ou zero os que não possuir (o código irá ignorá-los).</p>
                  </div>
                </div>

                <form onSubmit={handleSaveFixedCosts} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-gray-500">Aluguel ({currencySymbol})</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 1500,00"
                        className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={fixedRentInput}
                        onChange={e => setFixedRentInput(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-gray-500">Internet ({currencySymbol})</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 100,00"
                        className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={fixedInternetInput}
                        onChange={e => setFixedInternetInput(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-gray-500">Luz ({currencySymbol})</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 250,00"
                        className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={fixedElectricityInput}
                        onChange={e => setFixedElectricityInput(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-gray-500">Água ({currencySymbol})</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 80,00"
                        className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={fixedWaterInput}
                        onChange={e => setFixedWaterInput(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-gray-500">Gás ({currencySymbol})</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 120,00"
                        className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={fixedGasInput}
                        onChange={e => setFixedGasInput(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-gray-500">Plataformas / Sistemas ({currencySymbol})</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 150,00"
                        className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={fixedSistemasInput}
                        onChange={e => setFixedSistemasInput(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-gray-500">Marketing / Tráfego ({currencySymbol})</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 300,00"
                        className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={fixedMarketingInput}
                        onChange={e => setFixedMarketingInput(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-gray-500">Contabilidade ({currencySymbol})</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 400,00"
                        className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={fixedContabilidadeInput}
                        onChange={e => setFixedContabilidadeInput(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-gray-500">Salários / Pró-labore ({currencySymbol})</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 3000,00"
                        className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={fixedSalariosInput}
                        onChange={e => setFixedSalariosInput(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-gray-500">MEI / Impostos ({currencySymbol})</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 80,00"
                        className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={fixedMeiInput}
                        onChange={e => setFixedMeiInput(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Custos Fixos Personalizados */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                      <label className="text-[10px] font-extrabold uppercase text-gray-500 tracking-wider">Custos Fixos Adicionais / Personalizados</label>
                      <button
                        type="button"
                        onClick={() => setCustomFixedCosts([...customFixedCosts, { label: '', amount: '' }])}
                        className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
                      >
                        <Plus size={14} /> Adicionar Custo
                      </button>
                    </div>

                    {customFixedCosts.length > 0 ? (
                      <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                        {customFixedCosts.map((item, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <input
                              type="text"
                              placeholder="Nome do custo (ex: Aluguel de Máquina, Taxas...)"
                              className="flex-grow p-2 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 outline-none focus:ring-1 focus:ring-emerald-500"
                              value={item.label}
                              onChange={e => {
                                const newCosts = [...customFixedCosts];
                                newCosts[index].label = e.target.value;
                                setCustomFixedCosts(newCosts);
                              }}
                            />
                            <div className="relative w-28 flex-shrink-0">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">{currencySymbol}</span>
                              <input
                                type="text"
                                placeholder="0,00"
                                className="w-full p-2 pl-6 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 outline-none focus:ring-1 focus:ring-emerald-500"
                                value={item.amount}
                                onChange={e => {
                                  const newCosts = [...customFixedCosts];
                                  newCosts[index].amount = e.target.value;
                                  setCustomFixedCosts(newCosts);
                                }}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setCustomFixedCosts(customFixedCosts.filter((_, idx) => idx !== index))}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-400 italic">Nenhum custo fixo adicional adicionado ainda.</p>
                    )}
                  </div>

                  {/* Calculations Mode */}
                  <div className="bg-gray-100/50 p-3.5 rounded-xl border border-gray-200/80 space-y-2">
                    <div className="text-[10px] font-extrabold uppercase text-gray-600">Aplicação no Período Selecionado</div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        checked={isProportionalFixed}
                        onChange={e => setIsProportionalFixed(e.target.checked)}
                      />
                      <span className="text-xs text-gray-700 font-bold">
                        Calcular proporcionalmente aos dias do período ({daysInPeriod} dias de 30)
                      </span>
                    </label>
                    <div className="text-[10px] text-gray-500 italic mt-1 leading-normal">
                      Se desmarcado, o custo fixo integral configurado será subtraído do lucro final, independentemente de quantos dias foram selecionados no filtro.
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-3 rounded-xl font-bold shadow-md hover:scale-[1.01] transition-all cursor-pointer flex items-center justify-center gap-2 text-white"
                    style={{ backgroundColor: settings.primaryColor || '#865d39' }}
                  >
                    <Save size={18} /> Salvar Custos Fixos
                  </button>
                </form>
              </div>

              {/* Column 2: Custos Variáveis */}
              <div className="p-6 rounded-2xl space-y-4 shadow-sm border border-gray-200/50 bg-white flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="border-b border-gray-200/50 pb-2">
                    <h2 className="text-lg font-bold font-serif text-gray-800">
                      {isEditingVarCost ? 'Editar Custo Variável' : 'Lançar Custo Variável (Mercado, etc)'}
                    </h2>
                    <p className="text-xs text-gray-500">Adicione compras pontuais de ingredientes, embalagens e mercado.</p>
                  </div>

                  <form onSubmit={handleAddVarCost} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-[10px] font-bold uppercase text-gray-500">Descrição do Custo</label>
                        <input 
                          type="text" 
                          placeholder="Ex: Compra de carne e temperos no atacadão"
                          className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-emerald-500"
                          value={newVarCost.description || ''}
                          onChange={e => setNewVarCost({...newVarCost, description: e.target.value})}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500">Valor ({currencySymbol})</label>
                        <input 
                          type="text" 
                          placeholder="0,00"
                          className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-emerald-500"
                          value={varCostAmountInput}
                          onChange={e => setVarCostAmountInput(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500">Data do Gasto</label>
                        <input 
                          type="date" 
                          className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-emerald-500"
                          value={newVarCost.date || ''}
                          onChange={e => setNewVarCost({...newVarCost, date: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        type="submit"
                        className="flex-grow py-3 rounded-xl font-bold shadow-md hover:scale-[1.01] transition-all cursor-pointer flex items-center justify-center gap-2 bg-gray-800 text-white"
                      >
                        {isEditingVarCost ? <Save size={18} /> : <Plus size={18} />}
                        {isEditingVarCost ? 'Salvar Edição' : 'Lançar Gasto'}
                      </button>
                      {isEditingVarCost && (
                        <button 
                          type="button"
                          onClick={() => {
                            setIsEditingVarCost(null);
                            setNewVarCost({ description: '', amount: 0, date: new Date().toISOString().split('T')[0] });
                            setVarCostAmountInput('');
                          }}
                          className="px-4 py-3 rounded-xl font-bold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all cursor-pointer text-xs"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* Sub-section: List of Variable Costs */}
                <div className="space-y-2 mt-6 pt-6 border-t border-gray-200/50">
                  <div className="text-[10px] font-extrabold uppercase text-gray-500 mb-2">
                    Gastos Variáveis Registrados no Período
                  </div>
                  
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {variableCosts
                      .filter(vc => {
                        if (!vc.date) return false;
                        const vcDate = new Date(vc.date + 'T12:00:00');
                        const start = financeStartDate ? new Date(financeStartDate + 'T00:00:00') : null;
                        const end = financeEndDate ? new Date(financeEndDate + 'T23:59:59') : null;
                        if (start && vcDate < start) return false;
                        if (end && vcDate > end) return false;
                        return true;
                      })
                      .sort((a,b) => b.date.localeCompare(a.date))
                      .map(vc => (
                        <div key={vc.id} className="bg-white/75 border border-gray-200 p-3 rounded-xl flex items-center justify-between group">
                          <div>
                            <div className="font-bold text-xs text-gray-800">{vc.description}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5 font-semibold flex items-center gap-2">
                              <span>{new Date(vc.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                              <span>•</span>
                              <span className="text-rose-600 font-bold">{currencySymbol} {vc.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => {
                                setIsEditingVarCost(vc);
                                setNewVarCost(vc);
                                setVarCostAmountInput(vc.amount.toString());
                                scrollToTop();
                              }}
                              className="p-1.5 text-amber-900 hover:bg-amber-50 rounded-lg cursor-pointer transition-all"
                              title="Editar"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={() => handleDeleteVarCost(vc.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-all"
                              title="Excluir"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    
                    {variableCosts.filter(vc => {
                      if (!vc.date) return false;
                      const vcDate = new Date(vc.date + 'T12:00:00');
                      const start = financeStartDate ? new Date(financeStartDate + 'T00:00:00') : null;
                      const end = financeEndDate ? new Date(financeEndDate + 'T23:59:59') : null;
                      if (start && vcDate < start) return false;
                      if (end && vcDate > end) return false;
                      return true;
                    }).length === 0 && (
                      <div className="text-center py-6 text-xs text-gray-400 font-medium italic">
                        Nenhum custo variável lançado neste período.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'galleries' && (
          <div className="max-w-5xl space-y-8 pb-10">
            <div className="flex items-center justify-between border-b border-gray-200/50 pb-4">
              <div>
                <h1 className="text-3xl font-serif font-black" style={{ color: settings.primaryColor || '#865d39' }}>Galerias de Imagem</h1>
                <p className="text-sm text-black font-semibold opacity-100" style={{ color: '#000000' }}>Crie e gerencie até 6 galerias com 6 fotos cada para exibir como referências de estilo para bolos personalizados.</p>
              </div>
              <div>
                <button
                  type="button"
                  disabled={galleries.length >= 6}
                  onClick={async () => {
                    if (galleries.length >= 6) {
                      toast.error("O limite é de no máximo 6 galerias!");
                      return;
                    }
                    try {
                      await addDoc(collection(db, "galerias"), {
                        name: `Galeria ${galleries.length + 1}`,
                        images: ["", "", "", "", "", ""]
                      });
                      toast.success("Galeria criada com sucesso!");
                    } catch (e) {
                      toast.error("Erro ao criar galeria.");
                    }
                  }}
                className={cn(
                    "flex items-center gap-1.5 py-4 px-6 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow border-0",
                    galleries.length >= 6 ? "bg-gray-400 text-white cursor-not-allowed" : "hover:scale-[1.02] cursor-pointer"
                  )}
                  style={galleries.length >= 6 ? {} : { 
                    backgroundColor: settings.primaryColor || '#865d39',
                    color: getContrastText(settings.primaryColor || '#865d39')
                  }}
                >
                  <Plus size={16} /> Criar Nova Galeria ({galleries.length}/6)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {galleries.map((gallery) => (
                <div key={gallery.id} className="glass p-6 rounded-3xl space-y-4 relative flex flex-col justify-between">
                  <div>
                    {/* Gallery Title Input and Delete Button */}
                    <div className="flex items-center justify-between gap-3 border-b border-black/10 pb-3 mb-2">
                      <input
                        type="text"
                        value={gallery.name}
                        onChange={async (e) => {
                          const val = e.target.value;
                          await updateDoc(doc(db, "galerias", gallery.id), {
                            name: val
                          });
                        }}
                        className="font-serif font-black text-lg bg-transparent border-b border-transparent hover:border-black/20 focus:border-black/50 focus:outline-none transition-all w-3/4 pb-0.5 text-black"
                        placeholder="Nome da Galeria"
                      />
                      {galleryIdToDelete === gallery.id ? (
                        <div className="flex items-center gap-1.5 animate-fade-in">
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await deleteDoc(doc(db, "galerias", gallery.id));
                                toast.success("Galeria removida com sucesso!");
                                setGalleryIdToDelete(null);
                              } catch (e) {
                                toast.error("Erro ao remover galeria.");
                              }
                            }}
                            className="px-2 py-1 text-xs text-white rounded-lg font-bold transition-all border-0 cursor-pointer shadow-sm"
                            style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
                          >
                            Excluir
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setGalleryIdToDelete(null);
                            }}
                            className="px-2 py-1 text-xs text-black bg-gray-200 hover:bg-gray-300 rounded-lg font-bold transition-all border-0 cursor-pointer"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setGalleryIdToDelete(gallery.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors font-medium border-0 cursor-pointer"
                          title="Excluir Galeria"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    {/* Image uploads grid - 6 separate slots */}
                    <div className="bg-white/60 border border-white/30 rounded-2xl p-3 mt-2 shadow-sm">
                      <p className="text-[11px] font-bold text-gray-950 leading-relaxed text-center">
                        Gerencie as 6 imagens da galeria de forma independente abaixo. Clique em um espaço para fazer upload ou apague para remover.
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-3.5 mt-3">
                      {[0, 1, 2, 3, 4, 5].map((index) => {
                        const currentImg = gallery.images?.[index] || "";
                        return (
                          <div key={index} className="flex flex-col items-center gap-1.5">
                            <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-white/40 border border-black/10 flex items-center justify-center group shadow-sm">
                              {currentImg ? (
                                <>
                                  <img
                                    src={currentImg}
                                    alt={`Slot ${index + 1}`}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-1.5 p-1">
                                    {/* Edit Upload */}
                                    <label className="p-1.5 bg-white text-gray-800 rounded-full cursor-pointer hover:scale-105 shadow hover:text-black">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          handleFileChange(e, async (b64) => {
                                            const updatedImages = [...(gallery.images || ["", "", "", "", "", ""])];
                                            updatedImages[index] = b64;
                                            await updateDoc(doc(db, "galerias", gallery.id), {
                                              images: updatedImages
                                            });
                                            toast.success(`Foto ${index + 1} alterada com sucesso!`);
                                          }, true);
                                        }}
                                      />
                                      <Edit2 size={12} />
                                    </label>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const updatedImages = [...(gallery.images || ["", "", "", "", "", ""])];
                                        updatedImages[index] = "";
                                        await updateDoc(doc(db, "galerias", gallery.id), {
                                          images: updatedImages
                                        });
                                        toast.success(`Foto ${index + 1} removida!`);
                                      }}
                                      className="p-1.5 bg-red-500 text-white rounded-full hover:scale-105 shadow border-0 cursor-pointer"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-white/50 transition-colors p-2 text-center text-gray-500 hover:text-black select-none">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      handleFileChange(e, async (b64) => {
                                        const updatedImages = [...(gallery.images || ["", "", "", "", "", ""])];
                                        updatedImages[index] = b64;
                                        await updateDoc(doc(db, "galerias", gallery.id), {
                                          images: updatedImages
                                        });
                                        toast.success(`Foto ${index + 1} adicionada com sucesso!`);
                                      }, true);
                                    }}
                                  />
                                  <Plus size={16} className="text-gray-400" />
                                  <span className="text-[9px] font-black uppercase tracking-wider mt-1 opacity-60">Enviar</span>
                                </label>
                              )}
                            </div>
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-black/60">Foto {index + 1}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}

              {galleries.length === 0 && (
                <div className="md:col-span-2 glass p-10 rounded-3xl text-center space-y-3">
                  <div className="w-12 h-12 bg-black/5 rounded-full flex items-center justify-center mx-auto text-gray-400">
                    <ImageIcon size={24} />
                  </div>
                  <div>
                    <h3 className="font-serif font-black text-lg text-black">Nenhuma galeria criada</h3>
                    <p className="text-xs font-semibold text-gray-500 max-w-sm mx-auto leading-normal">Comece criando uma nova galeria de fotos separadas acima e vincule-a nos seus bolos personalizados!</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'cakeOptions' && (
          <div className="max-w-4xl space-y-8 pb-10">
            <div className="flex items-center justify-between border-b border-gray-200/50 pb-4">
              <div>
                <h1 className="text-3xl font-serif font-black" style={{ color: settings.primaryColor || '#865d39' }}>Opções de Bolos</h1>
                <p className="text-sm text-black font-semibold opacity-100" style={{ color: '#000000' }}>Gerencie tamanhos, massas, recheios, coberturas e toppers que poderão ser customizados pelo cliente.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* TAMANHOS */}
              <div className="glass p-6 rounded-3xl space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-black/10">
                  <h3 className="text-sm font-serif font-extrabold uppercase tracking-widest text-[#000000]" style={{ color: '#000000' }}>Tamanhos / Fatias / Peso</h3>
                  <button 
                    onClick={() => addCakeOptionItem('cakeSizes', '')}
                    className="p-1.5 rounded-full text-white active:scale-95 transition-transform cursor-pointer shadow-xs hover:brightness-110"
                    style={{ backgroundColor: settings.primaryColor || '#865d39' }}
                    title="Adicionar tamanho"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="space-y-2 max-h-62 overflow-y-auto pr-1">
                  {(settings.cakeSizes || []).length === 0 ? (
                    <p className="text-xs text-black font-semibold italic py-2" style={{ color: '#000000' }}>Nenhum tamanho adicionado.</p>
                  ) : (
                    (settings.cakeSizes || []).map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input 
                          type="text"
                          value={item}
                          placeholder="Ex: 7 inches - 20 fatias - 1,5 kg"
                          onChange={(e) => updateCakeOptionItem('cakeSizes', idx, e.target.value)}
                          className="flex-grow bg-white/60 border border-gray-200 py-2.5 px-4 rounded-xl text-sm"
                        />
                        <button 
                          onClick={() => removeCakeOptionItem('cakeSizes', idx)}
                          className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 active:scale-95 transition-transform"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* MASSAS */}
              <div className="glass p-6 rounded-3xl space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-black/10">
                  <h3 className="text-sm font-serif font-extrabold uppercase tracking-widest text-[#000000]" style={{ color: '#000000' }}>Tipos de Massa</h3>
                  <button 
                    onClick={() => addCakeOptionItem('cakeDoughs', '')}
                    className="p-1.5 rounded-full text-white active:scale-95 transition-transform cursor-pointer shadow-xs hover:brightness-110"
                    style={{ backgroundColor: settings.primaryColor || '#865d39' }}
                    title="Adicionar massa"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="space-y-2 max-h-62 overflow-y-auto pr-1">
                  {(settings.cakeDoughs || []).length === 0 ? (
                    <p className="text-xs text-black font-semibold italic py-2" style={{ color: '#000000' }}>Nenhuma massa adicionada.</p>
                  ) : (
                    (settings.cakeDoughs || []).map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input 
                          type="text"
                          value={item}
                          placeholder="Ex: Chocolate, Branca, Mesclado"
                          onChange={(e) => updateCakeOptionItem('cakeDoughs', idx, e.target.value)}
                          className="flex-grow bg-white/60 border border-gray-200 py-2.5 px-4 rounded-xl text-sm"
                        />
                        <button 
                          onClick={() => removeCakeOptionItem('cakeDoughs', idx)}
                          className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 active:scale-95 transition-transform"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* RECHEIOS */}
              <div className="glass p-6 rounded-3xl space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-black/10">
                  <div className="space-y-1">
                    <h3 className="text-sm font-serif font-extrabold uppercase tracking-widest text-[#000000]" style={{ color: '#000000' }}>Recheios</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-black font-extrabold" style={{ color: '#000000' }}>Máximo de opções:</span>
                      <input 
                        type="number"
                        min="1"
                        max="10"
                        value={settings.cakeFillingsMax || 2}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 1);
                          setSettings(prev => ({ ...prev, cakeFillingsMax: val }));
                        }}
                        className="w-16 bg-white/60 border border-gray-200 py-1 px-2 rounded-lg text-sm text-center font-bold"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={() => addCakeOptionItem('cakeFillings', '')}
                    className="p-1.5 rounded-full text-white active:scale-95 transition-transform cursor-pointer shadow-xs hover:brightness-110"
                    style={{ backgroundColor: settings.primaryColor || '#865d39' }}
                    title="Adicionar recheio"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="space-y-2 max-h-62 overflow-y-auto pr-1">
                  {(settings.cakeFillings || []).length === 0 ? (
                    <p className="text-xs text-black font-semibold italic py-2" style={{ color: '#000000' }}>Nenhum recheio adicionado.</p>
                  ) : (
                    (settings.cakeFillings || []).map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input 
                          type="text"
                          value={item}
                          placeholder="Ex: Chocolate, Morango, Cereja, Abacaxi"
                          onChange={(e) => updateCakeOptionItem('cakeFillings', idx, e.target.value)}
                          className="flex-grow bg-white/60 border border-gray-200 py-2.5 px-4 rounded-xl text-sm"
                        />
                        <button 
                          onClick={() => removeCakeOptionItem('cakeFillings', idx)}
                          className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 active:scale-95 transition-transform"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* COBERTURAS */}
              <div className="glass p-6 rounded-3xl space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-black/10">
                  <h3 className="text-sm font-serif font-extrabold uppercase tracking-widest text-[#000000]" style={{ color: '#000000' }}>Coberturas</h3>
                  <button 
                    onClick={() => addCakeOptionItem('cakeToppings', '')}
                    className="p-1.5 rounded-full text-white active:scale-95 transition-transform cursor-pointer shadow-xs hover:brightness-110"
                    style={{ backgroundColor: settings.primaryColor || '#865d39' }}
                    title="Adicionar cobertura"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="space-y-2 max-h-62 overflow-y-auto pr-1">
                  {(settings.cakeToppings || []).length === 0 ? (
                    <p className="text-xs text-black font-semibold italic py-2" style={{ color: '#000000' }}>Nenhuma cobertura adicionada.</p>
                  ) : (
                    (settings.cakeToppings || []).map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input 
                          type="text"
                          value={item}
                          placeholder="Ex: Chocolate, Chantilly"
                          onChange={(e) => updateCakeOptionItem('cakeToppings', idx, e.target.value)}
                          className="flex-grow bg-white/60 border border-gray-200 py-2.5 px-4 rounded-xl text-sm"
                        />
                        <button 
                          onClick={() => removeCakeOptionItem('cakeToppings', idx)}
                          className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 active:scale-95 transition-transform"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* TOPO DO BOLO */}
              <div className="glass p-6 rounded-3xl space-y-4 md:col-span-2">
                <div className="flex justify-between items-center pb-2 border-b border-black/10">
                  <h3 className="text-sm font-serif font-extrabold uppercase tracking-widest text-[#000000]" style={{ color: '#000000' }}>Topo do Bolo (Topper)</h3>
                  <button 
                    onClick={() => addCakeOptionItem('cakeToppers', '')}
                    className="p-1.5 rounded-full text-white active:scale-95 transition-transform cursor-pointer shadow-xs hover:brightness-110"
                    style={{ backgroundColor: settings.primaryColor || '#865d39' }}
                    title="Adicionar topo de bolo"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="space-y-2 max-h-62 overflow-y-auto pr-1">
                  {(settings.cakeToppers || []).length === 0 ? (
                    <p className="text-xs text-black font-semibold italic py-2" style={{ color: '#000000' }}>Nenhum topo de bolo adicionado.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {(settings.cakeToppers || []).map((item, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input 
                            type="text"
                            value={item}
                            placeholder="Ex: Flores, Topper"
                            onChange={(e) => updateCakeOptionItem('cakeToppers', idx, e.target.value)}
                            className="flex-grow bg-white/60 border border-gray-200 py-2.5 px-4 rounded-xl text-sm"
                          />
                          <button 
                            onClick={() => removeCakeOptionItem('cakeToppers', idx)}
                            className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 active:scale-95 transition-transform"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={saveSettings}
                disabled={isSaving}
                className="flex items-center gap-2 px-8 py-4 font-extrabold rounded-2xl shadow-xl transition-all active:scale-[0.98] select-none hover:shadow-2xl cursor-pointer disabled:opacity-50"
                style={{ 
                  backgroundColor: settings.primaryColor || '#865d39',
                  color: getContrastText(settings.primaryColor || '#865d39')
                }}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    <span>Salvar Opções de Bolos</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-3xl space-y-8 pb-10">
            <h2 className="text-3xl font-serif font-bold">Configure seu app</h2>
            
            <div className="glass p-6 rounded-2xl space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. FAÇA O UPLOAD DO SEU LOGO */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-gray-700 tracking-wider">
                    FAÇA O UPLOAD DO SEU LOGO
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-white p-1 border border-gray-200 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                      <img src={settings?.logo} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex items-center gap-3">
                      <input 
                        type="file" 
                        id="logo-upload"
                        accept="image/*"
                        onChange={e => handleFileChange(e, (b64) => setSettings({...settings, logo: b64}), 'logo')}
                        className="hidden"
                      />
                      <label 
                        htmlFor="logo-upload"
                        className="px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold cursor-pointer hover:bg-gray-50 transition-colors text-black shadow-xs flex items-center justify-center whitespace-nowrap"
                      >
                        Selecionar Imagem
                      </label>
                      <button
                        type="button"
                        onClick={() => setSettings({...settings, logo: 'https://i.ibb.co/SXRBhD32/dende.png'})}
                        className="px-4 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Remover Logo
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. COR PRIMÁRIA */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-gray-700 tracking-wider">
                    COR PRIMÁRIA
                  </label>
                  <div className="flex items-center gap-3">
                    <label 
                      className="w-12 h-11 rounded-xl border border-gray-300 shadow-xs flex-shrink-0 cursor-pointer overflow-hidden block relative"
                      style={{ backgroundColor: settings?.primaryColor || '#424733' }}
                    >
                      <input 
                        type="color" 
                        value={settings?.primaryColor?.startsWith('#') ? settings?.primaryColor : '#424733'}
                        onChange={e => setSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                    </label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-200/80 bg-gray-100/70 font-mono text-sm text-gray-900 focus:outline-none focus:bg-white transition-colors"
                      value={settings?.primaryColor || '#424733'}
                      onChange={e => setSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                    />
                  </div>
                </div>

                {/* 3. COR DO EFEITO GLASS */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-gray-700 tracking-wider">
                    COR DO EFEITO GLASS
                  </label>
                  <div className="flex items-center gap-3">
                    <label 
                      className="w-12 h-11 rounded-xl border border-gray-300 shadow-xs flex-shrink-0 cursor-pointer overflow-hidden block relative"
                      style={{ backgroundColor: settings?.glassColor || 'rgba(255, 255, 255, 0.4)' }}
                    >
                      <input 
                        type="color" 
                        value={settings?.glassColor?.startsWith('#') ? settings?.glassColor : '#ffffff'}
                        onChange={e => setSettings(prev => ({ ...prev, glassColor: e.target.value }))}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                    </label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-200/80 bg-gray-100/70 font-mono text-sm text-gray-900 focus:outline-none focus:bg-white transition-colors"
                      value={settings?.glassColor || 'rgba(255, 255, 255, 0.4)'}
                      onChange={e => setSettings(prev => ({ ...prev, glassColor: e.target.value }))}
                    />
                  </div>
                </div>

                {/* 4. COR DA FONTE (TEXTOS) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-gray-700 tracking-wider">
                    COR DA FONTE (TEXTOS)
                  </label>
                  <div className="flex items-center gap-3">
                    <label 
                      className="w-12 h-11 rounded-xl border border-gray-300 shadow-xs flex-shrink-0 cursor-pointer overflow-hidden block relative"
                      style={{ backgroundColor: settings?.textColor || '#000000' }}
                    >
                      <input 
                        type="color" 
                        value={settings?.textColor?.startsWith('#') ? settings?.textColor : '#000000'}
                        onChange={e => setSettings(prev => ({ ...prev, textColor: e.target.value, productTitleColor: e.target.value, productDescColor: e.target.value }))}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                    </label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-200/80 bg-gray-100/70 font-mono text-sm text-gray-900 focus:outline-none focus:bg-white transition-colors"
                      value={settings?.textColor || '#000000'}
                      onChange={e => setSettings(prev => ({ ...prev, textColor: e.target.value, productTitleColor: e.target.value, productDescColor: e.target.value }))}
                    />
                  </div>
                </div>

                {/* 5. COR DA FONTE (CATEGORIAS) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-gray-700 tracking-wider">
                    COR DA FONTE (CATEGORIAS)
                  </label>
                  <div className="flex items-center gap-3">
                    <label 
                      className="w-12 h-11 rounded-xl border border-gray-300 shadow-xs flex-shrink-0 cursor-pointer overflow-hidden block relative"
                      style={{ backgroundColor: settings?.categoryTextColor || '#424733' }}
                    >
                      <input 
                        type="color" 
                        value={settings?.categoryTextColor?.startsWith('#') ? settings?.categoryTextColor : '#424733'}
                        onChange={e => setSettings(prev => ({ ...prev, categoryTextColor: e.target.value }))}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                    </label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-200/80 bg-gray-100/70 font-mono text-sm text-gray-900 focus:outline-none focus:bg-white transition-colors"
                      value={settings?.categoryTextColor || '#424733'}
                      onChange={e => setSettings(prev => ({ ...prev, categoryTextColor: e.target.value }))}
                    />
                  </div>
                </div>

                {/* 6. COR DA MARCA (NOME DA MARCA) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-gray-700 tracking-wider">
                    COR DA MARCA (NOME DA MARCA)
                  </label>
                  <div className="flex items-center gap-3">
                    <label 
                      className="w-12 h-11 rounded-xl border border-gray-300 shadow-xs flex-shrink-0 cursor-pointer overflow-hidden block relative"
                      style={{ backgroundColor: settings?.brandTextColor || '#424733' }}
                    >
                      <input 
                        type="color" 
                        value={settings?.brandTextColor?.startsWith('#') ? settings?.brandTextColor : '#424733'}
                        onChange={e => setSettings(prev => ({ ...prev, brandTextColor: e.target.value }))}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                    </label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-200/80 bg-gray-100/70 font-mono text-sm text-gray-900 focus:outline-none focus:bg-white transition-colors"
                      value={settings?.brandTextColor || '#424733'}
                      onChange={e => setSettings(prev => ({ ...prev, brandTextColor: e.target.value }))}
                    />
                  </div>
                </div>

                {/* 7. COR DE "VER DETALHES" E PREÇO */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-gray-700 tracking-wider">
                    COR DE "VER DETALHES" E PREÇO
                  </label>
                  <div className="flex items-center gap-3">
                    <label 
                      className="w-12 h-11 rounded-xl border border-gray-300 shadow-xs flex-shrink-0 cursor-pointer overflow-hidden block relative"
                      style={{ backgroundColor: settings?.priceColor || '#865d39' }}
                    >
                      <input 
                        type="color" 
                        value={settings?.priceColor?.startsWith('#') ? settings?.priceColor : '#865d39'}
                        onChange={e => setSettings(prev => ({ ...prev, priceColor: e.target.value, detailsColor: e.target.value }))}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                    </label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-200/80 bg-gray-100/70 font-mono text-sm text-gray-900 focus:outline-none focus:bg-white transition-colors"
                      value={settings?.priceColor || '#865d39'}
                      onChange={e => setSettings(prev => ({ ...prev, priceColor: e.target.value, detailsColor: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Spacer para grid */}
                <div className="hidden md:block"></div>

                {/* Valor Mínimo do Pedido (Imagem 4 & 5) */}
                <div className="md:col-span-2 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 rounded-2xl border border-amber-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-bold uppercase text-gray-900 flex items-center gap-2">
                        <Lock size={18} className="text-amber-700" />
                        Valor Mínimo do Pedido
                      </label>
                      <p className="text-xs text-gray-600">
                        Se ativado, o cliente não conseguirá avançar para o checkout até atingir este valor mínimo no carrinho.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={settings?.minOrderEnabled || false}
                        onChange={e => setSettings(prev => ({ ...prev, minOrderEnabled: e.target.checked }))}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>

                  {settings?.minOrderEnabled && (
                    <div className="pt-3 border-t border-amber-500/20 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="relative w-full sm:w-48">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-extrabold text-gray-500 text-sm">
                          {currencySymbol}
                        </span>
                        <input 
                          type="text"
                          inputMode="numeric"
                          placeholder="0,00"
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-amber-300 bg-white font-bold text-sm text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
                          value={minOrderInput}
                          onChange={e => {
                            const digits = e.target.value.replace(/\D/g, '');
                            if (!digits) {
                              setMinOrderInput('');
                              setSettings(prev => ({ ...prev, minOrderValue: 0 }));
                              return;
                            }
                            const numericValue = parseInt(digits, 10) / 100;
                            const formatted = numericValue.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            });
                            setMinOrderInput(formatted);
                            setSettings(prev => ({ ...prev, minOrderValue: numericValue }));
                          }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-700">
                        Valor configurado: <strong className="text-amber-800 font-extrabold">{currencySymbol} {Number(settings?.minOrderValue || 0).toFixed(2).replace('.', ',')}</strong> (será exigido no carrinho do cliente)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Slogan do App</label>
                  <textarea 
                    rows={2}
                    className="w-full p-3 rounded-xl border border-gray-300"
                    value={settings?.slogan || ''}
                    onChange={e => setSettings({...settings, slogan: e.target.value})}
                    placeholder="Ex: O sabor que você merece..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Mensagem Final WhatsApp</label>
                  <textarea 
                    rows={2}
                    className="w-full p-3 rounded-xl border border-gray-300"
                    value={settings?.whatsappClosingMessage || ''}
                    onChange={e => setSettings({...settings, whatsappClosingMessage: e.target.value})}
                    placeholder="Ex: Obrigada pelo pedido..."
                  />
                </div>
              </div>



              <div className="space-y-2">
                <label className="text-sm font-bold uppercase opacity-60">Imagem de Fundo do App</label>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-32 h-20 rounded-xl bg-white border border-gray-200 flex items-center justify-center overflow-hidden shadow-sm">
                      {settings?.backgroundImage ? (
                        <img 
                          key={settings.backgroundImage}
                          src={settings.backgroundImage} 
                          alt="Background Preview" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer" 
                        />
                      ) : (
                        <div className="text-[10px] text-gray-400 font-bold uppercase">Sem fundo</div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <input 
                        type="file" 
                        id="bg-upload"
                        accept="image/*"
                        onChange={e => handleFileChange(e, (b64) => setSettings(prev => ({...prev, backgroundImage: b64})), 'background')}
                        className="hidden"
                      />
                      <label 
                        htmlFor="bg-upload"
                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold cursor-pointer hover:bg-gray-50 transition-colors text-black"
                      >
                        Fazer Upload
                      </label>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase opacity-40">Ou cole o link da imagem direta</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 text-sm"
                      value={settings?.backgroundImage?.startsWith('data:image/') ? '' : (settings?.backgroundImage || '')}
                      onChange={e => setSettings(prev => ({...prev, backgroundImage: e.target.value}))}
                      placeholder="https://exemplo.com/imagem.jpg"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Nome da Marca</label>
                  <input 
                    type="text" 
                    className="w-full p-3 rounded-xl border border-gray-300"
                    value={settings?.brandName || ''}
                    onChange={e => handleBrandNameChange(e.target.value)}
                    placeholder="Ex: Easy Plate Menu"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Slug da Loja (URL)</label>
                  <input 
                    type="text" 
                    className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50"
                    value={settings?.slug || ''}
                    onChange={e => setSettings({...settings, slug: slugify(e.target.value)})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold uppercase opacity-60">País & WhatsApp de Atendimento</label>
                    {(() => {
                      const currentCountry = COUNTRY_OPTIONS[settings?.whatsappCountryCode || '+55'] || COUNTRY_OPTIONS['+55'];
                      return (
                        <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                           Brasil (+55)
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex items-center gap-2 p-3 rounded-xl border border-gray-300 bg-gray-50 text-gray-800 font-bold w-full sm:w-48 text-sm shrink-0">
                      <span></span>
                      <span>Brasil (+55)</span>
                    </div>
                    <input 
                      type="text" 
                      className="flex-grow p-3 rounded-xl border border-gray-300 w-full bg-white text-black font-semibold"
                      value={formatPhoneByCountry(settings?.whatsappNumber || '', '+55')}
                      onChange={e => setSettings({...settings, whatsappCountryCode: '+55', whatsappNumber: formatPhoneByCountry(e.target.value, '+55')})}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  {(() => {
                    const numDigits = (settings?.whatsappNumber || '').replace(/\D/g, '').length;
                    if (settings?.whatsappNumber && numDigits < 10) {
                      return (
                        <p className="text-xs text-amber-600 font-semibold mt-1">
                          ⚠️ Atenção: O número digitado tem {numDigits} dígitos (esperado 10 ou 11 dígitos com DDD). Ex: (11) 99999-9999
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Senha do Painel Adm</label>
                  <input 
                    type="text" 
                    className="w-full p-3 rounded-xl border border-gray-300"
                    value={settings?.adminPassword || ''}
                    onChange={e => setSettings({...settings, adminPassword: e.target.value})}
                    placeholder="admin123"
                  />
                </div>
              </div>


              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="text-xl font-serif font-bold">Idioma e Checkout</h3>
                
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Título do Checkout (Abaixo de "Detalhes do Pedido")</label>
                  <textarea 
                    rows={2}
                    className="w-full p-3 rounded-xl border border-gray-300"
                    value={settings?.checkoutTitle || ''}
                    onChange={e => setSettings({...settings, checkoutTitle: e.target.value})}
                    placeholder="Ex: Ficamos muito felizes com seu pedido!..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3 p-4 bg-white/50 rounded-2xl border border-gray-100">
                    <label className="text-xs font-bold uppercase opacity-60">Bloco Informativo 1</label>
                    <input 
                      type="text" 
                      className="w-full p-2 rounded-lg border border-gray-200 text-sm font-bold"
                      value={settings?.infoBlock1Title || ''}
                      onChange={e => setSettings({...settings, infoBlock1Title: e.target.value})}
                      placeholder="Título (Ex: CONFIRMAÇÃO DO PEDIDO)"
                    />
                    <textarea 
                      rows={3}
                      className="w-full p-2 rounded-lg border border-gray-200 text-sm"
                      value={settings?.infoBlock1Text || ''}
                      onChange={e => setSettings({...settings, infoBlock1Text: e.target.value})}
                      placeholder="Texto informativo..."
                    />
                  </div>
                  <div className="space-y-3 p-4 bg-white/50 rounded-2xl border border-gray-100">
                    <label className="text-xs font-bold uppercase opacity-60">Bloco Informativo 2</label>
                    <input 
                      type="text" 
                      className="w-full p-2 rounded-lg border border-gray-200 text-sm font-bold"
                      value={settings?.infoBlock2Title || ''}
                      onChange={e => setSettings({...settings, infoBlock2Title: e.target.value})}
                      placeholder="Título (Ex: RETIRADA NO LOCAL)"
                    />
                    <textarea 
                      rows={3}
                      className="w-full p-2 rounded-lg border border-gray-200 text-sm"
                      value={settings?.infoBlock2Text || ''}
                      onChange={e => setSettings({...settings, infoBlock2Text: e.target.value})}
                      placeholder="Texto informativo..."
                    />
                  </div>
                </div>
              </div>

              {/* CONFIGURAÇÃO DE ENTREGA E TAXAS POR CIDADE (Conforme Imagem 3) */}
              <div className="p-6 rounded-3xl bg-white border border-gray-200/90 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <MapPin size={26} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-serif font-black text-gray-900">
                          Cidades e Taxas de Entrega
                        </h3>
                        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {(settings?.deliveryCities || []).length} {((settings?.deliveryCities || []).length === 1) ? 'CIDADE' : 'CIDADES'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">
                        Cadastre as cidades atendidas e seus valores de taxa de entrega. O cliente selecionará a cidade no checkout e o valor será somado ao pedido automaticamente.
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={settings?.deliveryEnabled !== false}
                      onChange={e => setSettings(prev => ({ ...prev, deliveryEnabled: e.target.checked }))}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ml-2 text-xs font-bold uppercase text-black">
                      {settings?.deliveryEnabled !== false ? 'Ativado' : 'Desativado'}
                    </span>
                  </label>
                </div>

                {settings?.deliveryEnabled !== false && (
                  <div className="space-y-6">
                    {/* Campo: Valor Mínimo do Pedido para Frete Grátis */}
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-300/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <span className="text-xs font-black uppercase tracking-wider text-amber-950 block">
                          Valor Mínimo do Pedido para Frete Grátis
                        </span>
                        <span className="text-[11px] text-amber-900/90">
                          Se o pedido do cliente atingir ou ultrapassar este valor, a taxa de entrega será R$ 0,00 automaticamente. Deixe vazio ou 0 se não quiser oferecer frete grátis.
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="relative flex items-center">
                          <span className="absolute left-3 text-xs font-bold text-gray-500 pointer-events-none select-none">
                            {currencySymbol}
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="0,00"
                            value={freeShippingInput}
                            onChange={e => handleFreeShippingChange(e.target.value)}
                            className="w-36 pl-10 pr-3 py-2.5 rounded-xl border border-amber-300 font-bold text-sm bg-white text-black shadow-xs outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Form: + CADASTRAR NOVA CIDADE / REGIÃO */}
                    <div className="p-5 rounded-2xl border border-gray-200 bg-gray-50/70 space-y-3">
                      <span className="text-xs font-black uppercase tracking-wider text-gray-800 block">
                        {editingCityId ? 'EDITAR CIDADE / REGIÃO' : '+ CADASTRAR NOVA CIDADE / REGIÃO'}
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="md:col-span-5 space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-500">NOME DA CIDADE / REGIÃO</label>
                          <input
                            type="text"
                            placeholder="Ex: Sapiranga, Campo Bom, Novo Hamburgo..."
                            value={cityForm.cityName}
                            onChange={e => setCityForm(prev => ({ ...prev, cityName: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold bg-white text-black shadow-xs focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>

                        <div className="md:col-span-4 space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-500">TAXA DE ENTREGA ({currencySymbol})</label>
                          <div className="relative flex items-center">
                            <span className="absolute left-3 text-xs font-bold text-gray-500 pointer-events-none select-none">
                              {currencySymbol}
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="0,00"
                              value={cityForm.price}
                              onChange={e => {
                                const digits = e.target.value.replace(/\D/g, '');
                                if (!digits) {
                                  setCityForm(prev => ({ ...prev, price: '' }));
                                  return;
                                }
                                const formatted = (parseInt(digits, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                setCityForm(prev => ({ ...prev, price: formatted }));
                              }}
                              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-300 text-sm font-bold bg-white text-black shadow-xs focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>
                        </div>

                        <div className="md:col-span-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleAddOrUpdateCity}
                            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                          >
                            <Plus size={15} />
                            <span>{editingCityId ? 'Salvar Cidade' : '+ Adicionar Cidade'}</span>
                          </button>
                          {editingCityId && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCityId(null);
                                setCityForm({ cityName: '', price: '' });
                              }}
                              className="px-3 py-2.5 rounded-xl text-xs font-bold text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors cursor-pointer"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* CIDADES CADASTRADAS PARA ENTREGA */}
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-xs font-black uppercase tracking-wider text-gray-800">
                          CIDADES CADASTRADAS PARA ENTREGA
                        </span>
                        <span className="text-[11px] text-gray-500">
                          Opção "Outro" (sem taxa fixa) é incluída automaticamente no checkout
                        </span>
                      </div>

                      {(!settings?.deliveryCities || settings.deliveryCities.length === 0) ? (
                        <div className="p-6 rounded-2xl bg-gray-50 border border-gray-200 text-center text-xs text-gray-500 font-medium">
                          Nenhuma cidade cadastrada ainda. Adicione as cidades que você atende acima.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {[...(settings.deliveryCities || [])]
                            .sort((a, b) => a.cityName.trim().localeCompare(b.cityName.trim(), 'pt-BR', { sensitivity: 'base' }))
                            .map((c) => (
                            <div 
                              key={c.id}
                              className="p-3.5 rounded-2xl bg-white border border-gray-200 shadow-xs flex items-center justify-between gap-3 group hover:border-blue-300 transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                  <MapPin size={17} />
                                </div>
                                <div className="min-w-0">
                                  <h5 className="font-bold text-xs text-gray-900 truncate uppercase">
                                    {c.cityName}
                                  </h5>
                                  <p className="text-xs font-extrabold text-blue-700">
                                    Taxa: {currencySymbol} {c.price.toFixed(2).replace('.', ',')}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCityId(c.id);
                                    setCityForm({
                                      cityName: c.cityName,
                                      price: c.price ? c.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'
                                    });
                                  }}
                                  className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                  title="Editar cidade"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = (settings.deliveryCities || []).filter(item => item.id !== c.id);
                                    setSettings(prev => ({ ...prev, deliveryCities: updated }));
                                    toast.success(`Cidade "${c.cityName}" excluída!`);
                                  }}
                                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Excluir cidade"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Permitir Retirada no Local */}
                    <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-200">
                      <div>
                        <span className="text-xs font-bold text-gray-900 block">Permitir Retirada no Estabelecimento (Takeaway)</span>
                        <span className="text-[11px] text-gray-500">O cliente pode optar por retirar o pedido no seu endereço sem taxa de entrega.</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={settings?.allowPickup !== false}
                          onChange={e => setSettings(prev => ({ ...prev, allowPickup: e.target.checked }))}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-700"></div>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* CONFIGURAÇÃO DA TELA DE BOAS VINDAS (TELA 1) */}
              <div className="glass p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif font-bold text-lg text-black">Tela de Boas-Vindas (Apresentação)</h4>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={settings?.introEnabled !== false}
                      onChange={e => setSettings({...settings, introEnabled: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-700"></div>
                    <span className="ml-2 text-xs font-bold uppercase opacity-65 text-black">Ativada</span>
                  </label>
                </div>
                
                {settings?.introEnabled !== false && (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase opacity-50 text-black">Título Principal</label>
                        <input 
                          type="text" 
                          className="w-full p-2.5 rounded-xl border border-gray-300 text-sm bg-white"
                          value={settings?.introTitle || ''}
                          onChange={e => setSettings({...settings, introTitle: e.target.value})}
                          placeholder="Ex: Escola de gastronomia"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase opacity-50 text-black">Texto do Botão</label>
                        <input 
                          type="text" 
                          className="w-full p-2.5 rounded-xl border border-gray-300 text-sm bg-white"
                          value={settings?.introButtonText || ''}
                          onChange={e => setSettings({...settings, introButtonText: e.target.value})}
                          placeholder="Ex: INICIAR OPERAÇÃO"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase opacity-50 text-black">Subtítulo Prato/Frase Cursiva</label>
                      <input 
                        type="text" 
                        className="w-full p-2.5 rounded-xl border border-gray-300 text-sm font-medium bg-white"
                        value={settings?.introSubtitle || ''}
                        onChange={e => setSettings({...settings, introSubtitle: e.target.value})}
                        placeholder="Ex: From sacred nature to your plate"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase opacity-50 text-black">Texto de Apresentação (Pequeno)</label>
                      <textarea 
                        rows={2}
                        className="w-full p-2.5 rounded-xl border border-gray-300 text-sm bg-white"
                        value={settings?.introDescription || ''}
                        onChange={e => setSettings({...settings, introDescription: e.target.value})}
                        placeholder="Ex: Descrição sobre o propósito do restaurante..."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase opacity-50 text-black">Texto Inferior (Rodapé)</label>
                      <input 
                        type="text" 
                        className="w-full p-2.5 rounded-xl border border-gray-300 text-sm font-mono bg-white"
                        value={settings?.introBottomText || ''}
                        onChange={e => setSettings({...settings, introBottomText: e.target.value})}
                        placeholder="Ex: 100% ARTESANAL & AFRO-BRASILEIRO"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* CONFIGURAÇÃO DA TELA SELETORA & GESTÃO DOS 6 CARDÁPIOS */}
              <div className="glass p-6 sm:p-8 rounded-3xl space-y-6 border border-white/20 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
                  <div>
                    <h4 className="font-serif font-black text-xl text-black flex items-center gap-2">
                       Gestão dos 6 Cardápios & Tela de Seleção
                    </h4>
                    <p className="text-xs text-gray-600 mt-1 max-w-xl">
                      Configure a tela intermediária com os 6 menus (Imagem 5) e personalize a foto, título e as informações de topo de cada cardápio (Imagem 6).
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-700">Tela Seletora:</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={settings?.selectorEnabled !== false}
                        onChange={e => setSettings({...settings, selectorEnabled: e.target.checked})}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-700"></div>
                      <span className="ml-2 text-xs font-bold uppercase opacity-75 text-black">
                        {settings?.selectorEnabled !== false ? 'Ativa' : 'Desativada'}
                      </span>
                    </label>
                  </div>
                </div>

                {settings?.selectorEnabled !== false && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase opacity-60 text-gray-700">Título da Tela de Escolha</label>
                      <input 
                        type="text" 
                        className="w-full p-2.5 rounded-xl border border-gray-300 text-sm font-bold bg-white text-black"
                        value={settings?.selectorTitle || ''}
                        onChange={e => setSettings({...settings, selectorTitle: e.target.value})}
                        placeholder="Ex: Grão & Sabor"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase opacity-60 text-gray-700">Subtítulo da Tela de Escolha</label>
                      <input 
                        type="text" 
                        className="w-full p-2.5 rounded-xl border border-gray-300 text-sm bg-white text-black font-medium"
                        value={settings?.selectorSubtitle || ''}
                        onChange={e => setSettings({...settings, selectorSubtitle: e.target.value})}
                        placeholder="Ex: Escolha seu cardápio"
                      />
                    </div>
                  </div>
                )}

                {/* Abas dos 6 Cardápios */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                      Selecione o Cardápio para Editar:
                    </span>
                    <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                      Editando: Menu {selectedAdminCatalogIndex}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    {([1, 2, 3, 4, 5, 6] as const).map(idx => {
                      const titleKey = `catalog${idx}Title` as keyof Settings;
                      const activeKey = `catalog${idx}Active` as keyof Settings;
                      const title = (settings?.[titleKey] as string) || `Menu ${idx}`;
                      const isActive = (settings?.[activeKey] as boolean) !== false;
                      const isSelected = selectedAdminCatalogIndex === idx;

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedAdminCatalogIndex(idx)}
                          className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-between min-h-[70px] ${
                            isSelected
                              ? 'bg-amber-900 text-white shadow-md border-amber-950 font-bold scale-[1.02]'
                              : 'bg-white hover:bg-amber-50/60 border-gray-200 text-gray-800'
                          }`}
                        >
                          <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">
                            Cardápio {idx}
                          </span>
                          <span className="text-xs font-bold truncate max-w-full px-1">
                            {title}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold mt-1 ${
                            isActive ? (isSelected ? 'bg-amber-800 text-amber-200' : 'bg-green-100 text-green-700') : 'bg-gray-100 text-gray-500'
                          }`}>
                            {isActive ? '● Ativo' : '○ Inativo'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Editor do Cardápio Selecionado */}
                  {(() => {
                    const idx = selectedAdminCatalogIndex;
                    const titleKey = `catalog${idx}Title` as keyof Settings;
                    const descKey = `catalog${idx}Desc` as keyof Settings;
                    const sloganKey = `catalog${idx}Slogan` as keyof Settings;
                    const imageKey = `catalog${idx}Image` as keyof Settings;
                    const activeKey = `catalog${idx}Active` as keyof Settings;

                    const titleVal = (settings?.[titleKey] as string) || '';
                    const descVal = (settings?.[descKey] as string) || '';
                    const sloganVal = (settings?.[sloganKey] as string) || '';
                    const imageVal = (settings?.[imageKey] as string) || '';
                    const activeVal = (settings?.[activeKey] as boolean) !== false;

                    const tagTitleKey = `catalog${idx}TagTitle` as keyof Settings;
                    const tagImageKey = `catalog${idx}TagImage` as keyof Settings;
                    const tagActiveKey = `catalog${idx}TagActive` as keyof Settings;

                    const tagTitleVal = (settings?.[tagTitleKey] as string) || '';
                    const tagImageVal = (settings?.[tagImageKey] as string) || '';
                    const tagActiveVal = (settings?.[tagActiveKey] as boolean) !== false;

                    return (
                      <div className="bg-white/95 rounded-2xl p-5 sm:p-6 border border-gray-200/80 shadow-inner space-y-5 animate-fade-in">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-amber-800 text-white flex items-center justify-center font-bold text-xs">
                              {idx}
                            </span>
                            <h5 className="font-bold text-base text-gray-900">
                              Configurações do Cardápio {idx} {titleVal ? `(${titleVal})` : ''}
                            </h5>
                          </div>
                          
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <span className="text-xs font-bold text-gray-700">Exibir este menu no app:</span>
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                              checked={activeVal}
                              onChange={e => setSettings({ ...settings, [activeKey]: e.target.checked })}
                            />
                          </label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="md:col-span-2 space-y-4">
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold uppercase text-gray-700">Título do Cardápio *</label>
                              <input 
                                type="text" 
                                className="w-full p-3 rounded-xl border border-gray-300 text-sm font-bold bg-white text-black"
                                value={titleVal}
                                onChange={e => setSettings({ ...settings, [titleKey]: e.target.value })}
                                placeholder={`Ex: ${idx === 1 ? 'Cardápio Principal' : idx === 2 ? 'Doces & Sobremesas' : idx === 3 ? 'Cafés & Bebidas' : idx === 4 ? 'Lanches & Salgados' : idx === 5 ? 'Linha Fit & Saudável' : 'Encomendas & Eventos'}`}
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-bold uppercase text-gray-700">Subtítulo / Descrição Curta (Aparece no card do seletor)</label>
                              <input 
                                type="text" 
                                className="w-full p-3 rounded-xl border border-gray-300 text-sm bg-white text-black font-medium"
                                value={descVal}
                                onChange={e => setSettings({ ...settings, [descKey]: e.target.value })}
                                placeholder="Ex: Nossos produtos frescos e opções exclusivas para você."
                              />
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <label className="text-[11px] font-bold uppercase text-gray-700 flex items-center gap-1">
                                  <span>✦ Informações / Tópicos do Topo do Cardápio</span>
                                  <span className="text-amber-700 font-semibold">(Imagem 6)</span>
                                </label>
                                <span className="text-[10px] text-gray-400 font-medium">1 tópico por linha</span>
                              </div>
                              <p className="text-[11px] text-gray-500 leading-snug">
                                Escreva cada informação em uma linha. Elas aparecerão no topo deste cardápio com estrelas ✦.
                              </p>
                              <textarea 
                                rows={6}
                                className="w-full p-3 rounded-xl border border-gray-300 text-xs bg-white text-black font-medium resize-y leading-relaxed font-sans"
                                value={sloganVal}
                                onChange={e => setSettings({ ...settings, [sloganKey]: e.target.value })}
                                placeholder={"Qualidade e sabor incomparáveis\nComida caseira com aquele tempero de verdade\nPedidos até sexta-feira\nEntregas: domingo e segunda\nPedido mínimo: 8 refeições\nConsulte a taxa de entrega\n50% de sinal para confirmar o pedido"}
                              />
                            </div>
                          </div>

                          {/* Foto de Capa do Cardápio */}
                          <div className="space-y-3 flex flex-col items-center">
                            <label className="text-[11px] font-bold uppercase text-gray-700 self-start">
                              Imagem / Capa do Cardápio {idx}
                            </label>
                            
                            <div className="w-full aspect-square rounded-2xl bg-white border border-gray-200 flex items-center justify-center overflow-hidden shadow-sm relative group p-1">
                              {imageVal ? (
                                <img 
                                  src={imageVal} 
                                  alt={`Capa Cardápio ${idx}`} 
                                  className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform duration-300"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="flex flex-col items-center gap-2 text-gray-400">
                                  <ImageIcon size={36} />
                                  <span className="text-xs font-semibold">Sem Imagem</span>
                                </div>
                              )}
                            </div>

                            <input 
                              type="file" 
                              id={`catalog-upload-${idx}`}
                              accept="image/*"
                              onChange={e => handleFileChange(e, (b64) => setSettings({ ...settings, [imageKey]: b64 }), 'catalog')}
                              className="hidden"
                            />
                            
                            <label 
                              htmlFor={`catalog-upload-${idx}`}
                              className="px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold cursor-pointer hover:bg-gray-50 text-black text-center w-full shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                               Trocar Imagem do Menu {idx}
                            </label>

                            <div className="w-full space-y-1">
                              <label className="text-[10px] font-bold uppercase text-gray-500">Ou cole a URL da imagem:</label>
                              <input 
                                type="text"
                                className="w-full p-2 text-xs border border-gray-300 rounded-lg bg-white text-black"
                                value={imageVal}
                                onChange={e => setSettings({ ...settings, [imageKey]: e.target.value })}
                                placeholder="https://..."
                              />
                            </div>
                          </div>
                        </div>

                        {/* Botão de Destaque / Tag Única no Final deste Cardápio (Imagem 1) */}
                        <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-300/80 space-y-4 pt-4 mt-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-3">
                            <div>
                              <h6 className="font-bold text-xs uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                                <span></span>
                                <span>Botão / Tag Única no Final do Cardápio {idx}</span>
                              </h6>
                              <p className="text-[11px] text-amber-800/80 mt-0.5">
                                Personalize o nome do botão que aparece no final deste cardápio e adicione uma imagem no formato 1080 x 1350.
                              </p>
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <span className="text-xs font-bold text-gray-700">Exibir este botão:</span>
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                                checked={tagActiveVal !== false}
                                onChange={e => setSettings({ ...settings, [tagActiveKey]: e.target.checked })}
                              />
                            </label>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold uppercase text-gray-700">
                                  Nome / Título do Botão (Ex: EVENTOS, MENTORIA, ENCOMENDAS)
                                </label>
                                <input 
                                  type="text" 
                                  className="w-full p-2.5 rounded-xl border border-gray-300 text-xs font-bold bg-white text-black"
                                  value={tagTitleVal}
                                  onChange={e => setSettings({ ...settings, [tagTitleKey]: e.target.value })}
                                  placeholder="Ex: EVENTOS ou MENTORIA"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[11px] font-bold uppercase text-gray-700">
                                  Upload da Imagem do Pop-up (Formato 1080 x 1350)
                                </label>
                                <input 
                                  type="file" 
                                  id={`catalog-tag-upload-${idx}`}
                                  accept="image/*"
                                  onChange={e => handleFileChange(e, (b64) => setSettings({ ...settings, [tagImageKey]: b64 }), 'tag')}
                                  className="hidden"
                                />
                                <label 
                                  htmlFor={`catalog-tag-upload-${idx}`}
                                  className="px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold cursor-pointer hover:bg-gray-50 text-black text-center w-full shadow-xs transition-all flex items-center justify-center gap-2 hover:scale-[1.01]"
                                >
                                   Carregar Imagem 1080 x 1350
                                </label>
                              </div>

                              {tagImageVal && (
                                <button
                                  type="button"
                                  onClick={() => setSettings({ ...settings, [tagImageKey]: '' })}
                                  className="text-xs text-red-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
                                >
                                  <Trash2 size={13} /> Remover imagem deste botão
                                </button>
                              )}
                            </div>

                            {/* Pré-visualização da Imagem 1080 x 1350 (Aspect 4:5) */}
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] font-bold uppercase text-gray-500 mb-1.5 self-start">
                                Pré-visualização (Proporção 1080 x 1350):
                              </span>
                              <div className="w-40 aspect-[1080/1350] rounded-2xl bg-white border border-gray-200 overflow-hidden shadow-sm flex items-center justify-center relative">
                                {tagImageVal ? (
                                  <img 
                                    src={tagImageVal} 
                                    alt={`Tag Cardápio ${idx}`} 
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="p-3 text-center text-gray-400 space-y-1">
                                    <ImageIcon size={28} className="mx-auto opacity-40" />
                                    <span className="text-[10px] font-medium block">Sem imagem 1080x1350</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="glass rounded-3xl p-8 space-y-6">
                <div className="space-y-1">
                  <h3 className="text-2xl font-serif font-medium" style={{ color: settings?.textColor || 'inherit' }}>Seu Cardápio Digital está Online!</h3>
                  <p className="opacity-40 text-sm" style={{ color: settings?.textColor || 'inherit' }}>Compartilhe o link ou o QR Code abaixo com seus clientes:</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  <div className="md:col-span-2 space-y-4">
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <div className="flex-grow w-full glass p-4 rounded-2xl font-mono text-xs break-all border border-white/10" style={{ color: settings?.textColor || 'inherit' }}>
                        {`${window.location.origin}/?slug=${settings?.slug || 'easy-cake-menu'}`}
                      </div>
                      <button 
                        onClick={copyLink}
                        className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold transition-all uppercase tracking-wider text-xs active:scale-95 text-center cursor-pointer border border-white/10 hover:bg-white/5 whitespace-nowrap"
                        style={{ color: settings?.primaryColor || '#865d39' }}
                      >
                        {copied ? 'COPIADO!' : 'COPIAR LINK'}
                      </button>
                    </div>

                    <div className="text-xs opacity-50 space-y-2 leading-relaxed" style={{ color: settings?.textColor || 'inherit' }}>
                      <p> <strong>Dica de Sucesso:</strong> Imprima o QR Code e coloque-o nas suas mesas, no balcão de atendimento ou nas embalagens de entrega para que os clientes acessem seu cardápio instantaneamente!</p>
                      <p> Você também pode publicá-lo nos Stories do Instagram, enviar no WhatsApp ou colocar no link da sua bio.</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                    <div className="p-3 bg-white rounded-xl shadow-md">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${window.location.origin}/?slug=${settings?.slug || 'easy-cake-menu'}`)}`}
                        alt="QR Code do Cardápio" 
                        className="w-32 h-32 object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const appLink = `${window.location.origin}/?slug=${settings?.slug || 'easy-cake-menu'}`;
                          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(appLink)}`;
                          const response = await fetch(qrUrl);
                          const blob = await response.blob();
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `qrcode-cardapio-${settings?.slug || 'menu'}.png`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          window.URL.revokeObjectURL(url);
                          toast.success('QR Code baixado com sucesso!');
                        } catch (error) {
                          console.error('Error downloading QR code:', error);
                          const appLink = `${window.location.origin}/?slug=${settings?.slug || 'easy-cake-menu'}`;
                          window.open(`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(appLink)}`, '_blank');
                        }
                      }}
                      className="w-full py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 cursor-pointer text-black shadow-sm"
                      style={{ backgroundColor: '#efedea', color: '#000000' }}
                    >
                      <Download size={14} className="text-black" />
                      <span className="text-black">Baixar QR Code</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* CONFIGURAÇÃO DE IMPRESSORA & FORMATO DE PAPEL */}
              <div className="p-6 rounded-2xl bg-white border border-gray-200/90 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-900 shadow-xs">
                      <Printer size={22} />
                    </div>
                    <div>
                      <h3 className="text-base font-serif font-bold text-gray-900 flex items-center gap-2">
                        Configuração de Impressão e Comandas
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {settings?.printerFormat === '58mm' ? 'Bobina 58mm' : settings?.printerFormat === '80mm' ? 'Bobina 80mm' : 'Folha A4 (Padrão)'}
                        </span>
                      </h3>
                      <p className="text-xs text-gray-500">
                        Escolha o tipo de papel e impressora para comandas de pedidos e relatórios de produção
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => printTestPage()}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-900 text-white hover:bg-amber-950 transition-all flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
                  >
                    <Printer size={15} /> Imprimir Página de Teste
                  </button>
                </div>

                {/* Seletores de formato */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-800 uppercase tracking-wide block">
                    Selecione o Formato do Papel / Impressora:
                  </label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Opção A4 */}
                    <div
                      onClick={() => setSettings({ ...settings, printerFormat: 'a4' })}
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                        (!settings?.printerFormat || settings.printerFormat === 'a4')
                          ? 'border-amber-900 bg-amber-50/50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm text-gray-900">Folha A4 / Sulfite</span>
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-200 text-amber-900">Recomendado</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Impressoras convencionais jato de tinta, laser ou salvar em PDF.
                          </p>
                        </div>
                        <input
                          type="radio"
                          name="printerFormat"
                          checked={!settings?.printerFormat || settings.printerFormat === 'a4'}
                          onChange={() => setSettings({ ...settings, printerFormat: 'a4' })}
                          className="mt-1 text-amber-900 focus:ring-amber-500 h-4 w-4"
                        />
                      </div>
                      <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-600">
                        <span>Largura: 210 mm</span>
                        <span className="font-bold text-amber-900">Enquadramento Total</span>
                      </div>
                    </div>

                    {/* Opção 80mm */}
                    <div
                      onClick={() => setSettings({ ...settings, printerFormat: '80mm' })}
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                        settings?.printerFormat === '80mm'
                          ? 'border-amber-900 bg-amber-50/50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-bold text-sm text-gray-900">Bobina 80 mm</span>
                          <p className="text-xs text-gray-500 mt-1">
                            Impressoras térmicas não-fiscais padrão (Epson TM-T20, Bematech, Elgin i9).
                          </p>
                        </div>
                        <input
                          type="radio"
                          name="printerFormat"
                          checked={settings?.printerFormat === '80mm'}
                          onChange={() => setSettings({ ...settings, printerFormat: '80mm' })}
                          className="mt-1 text-amber-900 focus:ring-amber-500 h-4 w-4"
                        />
                      </div>
                      <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-600">
                        <span>Largura: 80 mm</span>
                        <span className="font-bold text-amber-900">Cupom Térmico Largo</span>
                      </div>
                    </div>

                    {/* Opção 58mm */}
                    <div
                      onClick={() => setSettings({ ...settings, printerFormat: '58mm' })}
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                        settings?.printerFormat === '58mm'
                          ? 'border-amber-900 bg-amber-50/50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-bold text-sm text-gray-900">Bobina 58 mm</span>
                          <p className="text-xs text-gray-500 mt-1">
                            Mini impressoras térmicas compactas USB/Bluetooth (ex: POS-5890C, Luogao).
                          </p>
                        </div>
                        <input
                          type="radio"
                          name="printerFormat"
                          checked={settings?.printerFormat === '58mm'}
                          onChange={() => setSettings({ ...settings, printerFormat: '58mm' })}
                          className="mt-1 text-amber-900 focus:ring-amber-500 h-4 w-4"
                        />
                      </div>
                      <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-600">
                        <span>Largura: 58 mm</span>
                        <span className="font-bold text-amber-900">Mini Cupom 48mm útil</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dica sobre a tela de impressão do navegador */}
                <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/90 space-y-2 text-xs text-amber-950">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <CheckCircle2 size={16} />
                    <span>Importante: Por que apareceu o botão "Salvar" ao invés de "Imprimir"?</span>
                  </div>
                  <p className="leading-relaxed text-amber-900/90">
                    Na janela de impressão que abre no computador, o campo <strong>Destino</strong> estava selecionado como <em>"Salvar como PDF"</em> (por isso o botão vira "Salvar"). Para imprimir diretamente no papel da sua impressora física:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 pl-1 font-medium text-amber-950">
                    <li>Clique no campo <strong>Destino</strong> (no topo direito da janela de impressão).</li>
                    <li>Selecione o <strong>nome da sua impressora</strong> (ou clique em <em>"Ver mais..."</em> se ela não aparecer de primeira).</li>
                    <li>Assim que você selecionar a impressora física conectada, o botão mudará imediatamente para <strong>"Imprimir"</strong>!</li>
                  </ol>
                </div>
              </div>

              <div className="flex gap-4 pt-4 items-center">
                <button 
                  onClick={saveSettings}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold shadow-lg disabled:opacity-50"
                  style={{ 
                    backgroundColor: settings?.primaryColor || '#865d39',
                    color: getContrastText(settings?.primaryColor || '#865d39')
                  }}
                >
                  {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  Salvar Alterações
                </button>
                <AnimatePresence>
                  {saveSuccess && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-xl font-bold shadow-sm border border-green-200"
                    >
                      <CheckCircle2 size={18} /> Salvo com sucesso!
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}




        {activeTab === 'categories' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h2 className="text-3xl font-serif font-bold text-gray-900">Gerenciar Categorias</h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                Adicione categorias e organize a ordem em que elas aparecem separadamente em cada cardápio.
              </p>
            </div>
            
            {/* Formulário de Adicionar / Editar Categoria */}
            <form onSubmit={handleAddCategory} className="bg-white/95 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-black/10 flex flex-col gap-4">
              <span className="text-xs font-black uppercase tracking-wider text-gray-700">
                {isEditingCategory ? '✏️ Editar Categoria' : '+ Nova Categoria'}
              </span>
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" 
                  placeholder="Nome da categoria (Ex: Pratos Executivos)"
                  className="flex-grow p-3 rounded-xl border border-gray-300 w-full bg-white text-black font-semibold text-sm"
                  value={newCategory.title || ''}
                  onChange={e => setNewCategory({...newCategory, title: e.target.value})}
                />

                <select
                  className="p-3 rounded-xl border border-gray-300 bg-white text-black font-semibold text-xs sm:text-sm sm:w-64"
                  value={newCategory.catalog || 'all'}
                  onChange={e => setNewCategory({...newCategory, catalog: e.target.value as any})}
                >
                  <option value="all"> Em Todos os Menus</option>
                  <option value="catalog1">1. {settings?.catalog1Title || 'Cardápio 1'}</option>
                  <option value="catalog2">2. {settings?.catalog2Title || 'Cardápio 2'}</option>
                  <option value="catalog3">3. {settings?.catalog3Title || 'Cardápio 3'}</option>
                  <option value="catalog4">4. {settings?.catalog4Title || 'Cardápio 4'}</option>
                  <option value="catalog5">5. {settings?.catalog5Title || 'Cardápio 5'}</option>
                  <option value="catalog6">6. {settings?.catalog6Title || 'Cardápio 6'}</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button 
                  type="submit"
                  className="px-6 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-95"
                  style={{ 
                    backgroundColor: settings?.primaryColor || '#865d39',
                    color: getContrastText(settings?.primaryColor || '#865d39')
                  }}
                >
                  {isEditingCategory ? <Save size={18} /> : <Plus size={18} />}
                  {isEditingCategory ? 'Salvar Categoria' : 'Adicionar Categoria'}
                </button>
                {isEditingCategory && (
                  <button 
                    type="button"
                    onClick={() => {
                      setIsEditingCategory(null);
                      setNewCategory({ 
                        title: '', 
                        order: 0, 
                        catalog: (selectedCategoryCatalog !== 'all' && selectedCategoryCatalog !== 'global' ? selectedCategoryCatalog : 'all') as any 
                      });
                    }}
                    className="px-6 py-3 rounded-xl bg-gray-200 font-bold cursor-pointer text-black hover:bg-gray-300 transition-colors"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            {/* Seletor de Cardápio (Pills com contador conforme Imagem 2 / Organizar Cardápio) */}
            <div className="bg-white/95 backdrop-blur-md p-5 rounded-2xl shadow-sm border border-black/10 space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-700">
                  <Layers size={16} />
                  <span>Separar por Cardápio para Organizar Ordem</span>
                </div>
                <span className="text-xs font-semibold text-gray-500">
                  {categories.length} categoria(s) no total
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {categoryCatalogTabs.map((tab) => {
                  const isSelected = selectedCategoryCatalog === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategoryCatalog(tab.id);
                        if (!isEditingCategory) {
                          if (tab.id !== 'all' && tab.id !== 'global') {
                            setNewCategory(prev => ({ ...prev, catalog: tab.id as any }));
                          } else {
                            setNewCategory(prev => ({ ...prev, catalog: 'all' }));
                          }
                        }
                      }}
                      className={cn(
                        "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs border",
                        isSelected 
                          ? "shadow-md scale-[1.02]" 
                          : "bg-white hover:bg-gray-50 text-gray-700 border-gray-200"
                      )}
                      style={isSelected ? { 
                        backgroundColor: settings?.primaryColor || '#865d39', 
                        color: getContrastText(settings?.primaryColor || '#865d39'),
                        borderColor: settings?.primaryColor || '#865d39' 
                      } : {}}
                    >
                      <span>{tab.label}</span>
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-extrabold",
                        isSelected ? "bg-white/25 text-white" : "bg-gray-100 text-gray-600"
                      )}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedCategoryCatalog !== 'all' && (
                <div className="pt-1 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    Exibindo categorias do cardápio: <strong className="text-gray-900">{getCatalogLabel(selectedCategoryCatalog)}</strong>
                  </span>
                  <span className="text-[11px] text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                     Use ↑ e ↓ para definir a ordem neste cardápio
                  </span>
                </div>
              )}
            </div>

            {/* Lista de Categorias Filtradas */}
            <div className="space-y-3">
              {filteredCategoriesList.length === 0 ? (
                <div className="bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-sm border border-black/10 text-center space-y-2">
                  <p className="text-gray-500 font-semibold text-sm">
                    Nenhuma categoria vinculada a este cardápio ainda.
                  </p>
                  <p className="text-xs text-gray-400">
                    Cadastre uma nova categoria acima para adicioná-la a "{getCatalogLabel(selectedCategoryCatalog)}".
                  </p>
                </div>
              ) : (
                filteredCategoriesList.map((cat, idx) => {
                  const dishCount = products.filter(p => p.categoryId === cat.id || p.secondaryCategoryId === cat.id).length;
                  return (
                    <motion.div 
                      layout
                      key={cat.id} 
                      className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-black/10 flex items-center justify-between group hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col gap-1">
                          <button 
                            type="button"
                            onClick={() => moveCategory(cat.id, 'up', filteredCategoriesList)}
                            disabled={idx === 0}
                            className="p-1 hover:bg-black/5 rounded disabled:opacity-20 cursor-pointer transition-colors"
                            title="Mover para cima"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => moveCategory(cat.id, 'down', filteredCategoriesList)}
                            disabled={idx === filteredCategoriesList.length - 1}
                            className="p-1 hover:bg-black/5 rounded disabled:opacity-20 cursor-pointer transition-colors"
                            title="Mover para baixo"
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-gray-100 text-gray-700 font-black text-xs flex items-center justify-center shrink-0 border border-gray-200">
                            {idx + 1}
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                          <span className="font-bold text-base sm:text-lg text-black">{cat.title}</span>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-black/5 text-gray-600 border border-black/5 w-max">
                            {dishCount} {dishCount === 1 ? 'prato' : 'pratos'}
                          </span>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 w-max">
                            {cat.catalog === 'catalog1' ? (settings?.catalog1Title || 'Cardápio 1') :
                             cat.catalog === 'catalog2' ? (settings?.catalog2Title || 'Cardápio 2') :
                             cat.catalog === 'catalog3' ? (settings?.catalog3Title || 'Cardápio 3') :
                             cat.catalog === 'catalog4' ? (settings?.catalog4Title || 'Cardápio 4') :
                             cat.catalog === 'catalog5' ? (settings?.catalog5Title || 'Cardápio 5') :
                             cat.catalog === 'catalog6' ? (settings?.catalog6Title || 'Cardápio 6') :
                             'Todos os Menus'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button 
                          type="button"
                          onClick={() => {
                            setIsEditingCategory(cat);
                            setNewCategory({ title: cat.title, order: cat.order || 0, catalog: (cat.catalog || 'all') as any });
                            scrollToTop();
                          }}
                          className="p-2 text-amber-900 hover:bg-amber-50 bg-white shadow-sm border border-amber-200/80 rounded-xl cursor-pointer transition-all hover:scale-105 active:scale-95"
                          title="Editar Categoria"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => deleteCategory(cat.id)}
                          className="p-2 text-red-600 hover:bg-red-50 bg-white shadow-sm border border-black/5 rounded-xl cursor-pointer transition-all hover:scale-105 active:scale-95"
                          title="Excluir Categoria"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'menu' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-serif font-bold">Gerenciar Cardápio</h2>
            </div>

            <form onSubmit={handleAddProduct} className="glass p-5 sm:p-8 rounded-3xl space-y-8 text-black border border-white/40 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/10 pb-4">
                <div>
                  <h3 className="text-xl sm:text-2xl font-serif font-black text-gray-900">
                    {isEditingProduct ? 'Editar Prato / Marmita / Combo' : 'Novo Prato / Marmita / Combo'}
                  </h3>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Cadastre pratos individuais, combos promocionais, kits ou opções personalizadas para o seu cardápio.
                  </p>
                </div>
                {isEditingProduct && (
                  <button
                    type="button"
                    onClick={handleResetProductForm}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    Cancelar Edição
                  </button>
                )}
              </div>

              {/* SEÇÃO 1: INFORMAÇÕES BÁSICAS DO PRODUTO (Imagens 3, 4, 5) */}
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-5 sm:p-6 border border-amber-200/80 shadow-xs space-y-6">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-amber-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    1
                  </span>
                  <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-gray-900">
                    INFORMAÇÕES BÁSICAS DO PRODUTO
                  </h4>
                </div>

                {/* Formato do Item no Cardápio (Imagem 3 & 4) */}
                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-300/80 space-y-4">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-950 block">
                    FORMATO DO ITEM NO CARDÁPIO
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setItemFormat('individual')}
                      className={cn(
                        "p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center gap-3.5",
                        itemFormat === 'individual'
                          ? "bg-white border-amber-800 shadow-sm ring-1 ring-amber-800/20"
                          : "bg-white/60 border-gray-200 hover:border-amber-300"
                      )}
                    >
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center text-xl shrink-0">
                        
                      </div>
                      <div>
                        <span className="font-extrabold text-xs sm:text-sm text-gray-900 block leading-tight">
                          Prato / Item Individual
                        </span>
                        <span className="text-[11px] text-gray-500 font-medium leading-tight">
                          Marmita única, sobremesa ou item avulso
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setItemFormat('combo');
                        setHideIndividual(false);
                        if (allowedComboDishIds.length === 0) {
                          setAllowedComboDishIds(products.filter(p => p.isActive !== false).map(p => p.id));
                        }
                      }}
                      className={cn(
                        "p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center gap-3.5",
                        itemFormat === 'combo'
                          ? "bg-white border-amber-800 shadow-sm ring-1 ring-amber-800/20"
                          : "bg-white/60 border-gray-200 hover:border-amber-300"
                      )}
                    >
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-900 flex items-center justify-center text-xl shrink-0">
                        
                      </div>
                      <div>
                        <span className="font-extrabold text-xs sm:text-sm text-gray-900 block leading-tight">
                          Combo de Marmitas Personalizável
                        </span>
                        <span className="text-[11px] text-gray-500 font-medium leading-tight">
                          Ex: 5, 10, 20, 30+ com escolha de sabores
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Ocultar Avulso (se for item individual - Imagem 3) */}
                  {itemFormat === 'individual' && (
                    <div className="p-3.5 rounded-xl bg-purple-50/80 border border-purple-200/90 flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="hide-individual-check"
                        checked={hideIndividual}
                        onChange={e => setHideIndividual(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-gray-300 cursor-pointer"
                      />
                      <label htmlFor="hide-individual-check" className="text-xs text-purple-950 cursor-pointer space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold flex items-center gap-1">
                             Disponível apenas para montagem de combos
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-200 text-purple-900">
                            OCULTAR AVULSO
                          </span>
                        </div>
                        <p className="text-[11px] text-purple-800/90 font-medium leading-relaxed">
                          Marque esta opção se você só trabalha com combos. O prato <strong>não aparecerá avulso</strong> no cardápio do cliente, mas ficará disponível para ser selecionado dentro dos combos com suas respectivas gramaturas e estoque.
                        </p>
                      </label>
                    </div>
                  )}

                  {/* Configurações do Combo de Marmitas (Imagem 4) */}
                  {itemFormat === 'combo' && (
                    <div className="pt-3 border-t border-amber-300/60 space-y-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                          ⚙️ CONFIGURAÇÕES DO COMBO DE MARMITAS
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          Trava de seleção ativa para o cliente
                        </span>
                      </div>

                      {/* Quantidade Exata que o Cliente deve escolher */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-black uppercase text-gray-800">
                            QUANTIDADE EXATA DE MARMITAS QUE O CLIENTE DEVE ESCOLHER *
                          </label>
                          <span className="text-xs font-black text-amber-900">
                            LIMITE: {comboLimit} MARMITAS
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {[5, 10, 15, 20, 30, 40, 50].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setComboLimit(num)}
                              className={cn(
                                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                                comboLimit === num
                                  ? "bg-amber-800 text-white border-amber-900 shadow-sm"
                                  : "bg-white text-gray-800 border-gray-300 hover:border-gray-400"
                              )}
                            >
                              Combo {num}
                            </button>
                          ))}
                          <div className="flex items-center gap-1.5 ml-1">
                            <span className="text-xs text-gray-500 font-medium">Ou outro valor:</span>
                            <input
                              type="number"
                              min={1}
                              max={200}
                              value={comboLimit}
                              onChange={e => setComboLimit(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-16 p-1.5 text-xs font-bold text-center rounded-lg border border-gray-300 bg-white"
                            />
                          </div>
                        </div>
                        <p className="text-[11px] text-gray-500 font-medium italic">
                          O cliente só conseguirá adicionar o combo ao pedido quando selecionar exatamente {comboLimit} unidades entre os sabores permitidos.
                        </p>
                      </div>

                      {/* Quais pratos o cliente pode escolher neste combo */}
                      <div className="space-y-2.5 pt-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <span className="text-[11px] font-black uppercase text-gray-800 block">
                              QUAIS PRATOS O CLIENTE PODE ESCOLHER NESTE COMBO?
                            </span>
                            <span className="text-[10px] text-gray-500 font-medium">
                              Todos os pratos ativos cadastrados estão permitidos por padrão
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setAllowedComboDishIds(products.filter(p => p.isActive !== false && (!isEditingProduct || p.id !== isEditingProduct.id)).map(p => p.id))}
                              className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
                            >
                              ✓ Marcar Todos Ativos
                            </button>
                            <button
                              type="button"
                              onClick={() => setAllowedComboDishIds([])}
                              className="px-2.5 py-1 text-[11px] font-bold text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
                            >
                              ✕ Desmarcar Todos
                            </button>
                          </div>
                        </div>

                        {/* Filtro de pratos */}
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Filtrar pratos ativos para selecionar..."
                            value={comboDishSearch}
                            onChange={e => setComboDishSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-300 bg-white"
                          />
                        </div>

                        {/* Lista com scroll e checkboxes */}
                        <div className="max-h-56 overflow-y-auto space-y-1.5 p-1 border border-gray-200 rounded-xl bg-white">
                          {products
                            .filter(p => p.isActive !== false && (!isEditingProduct || p.id !== isEditingProduct.id))
                            .filter(p => !comboDishSearch.trim() || p.title.toLowerCase().includes(comboDishSearch.toLowerCase()))
                            .map((dish) => {
                              const isChecked = allowedComboDishIds.includes(dish.id);
                              const catTitle = categories.find(c => c.id === dish.categoryId)?.title || 'Prato';
                              return (
                                <label
                                  key={dish.id}
                                  className={cn(
                                    "flex items-center gap-3 p-2 rounded-lg border transition-colors cursor-pointer",
                                    isChecked ? "bg-amber-50/70 border-amber-200" : "bg-white border-transparent hover:bg-gray-50"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={e => {
                                      if (e.target.checked) {
                                        setAllowedComboDishIds([...allowedComboDishIds, dish.id]);
                                      } else {
                                        setAllowedComboDishIds(allowedComboDishIds.filter(id => id !== dish.id));
                                      }
                                    }}
                                    className="w-4 h-4 rounded text-amber-700 focus:ring-amber-600 border-gray-300 cursor-pointer"
                                  />
                                  <img
                                    src={dish.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&q=80'}
                                    alt={dish.title}
                                    className="w-8 h-8 rounded-lg object-cover shrink-0 border border-black/10"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-xs font-bold text-gray-900 block truncate">
                                      {dish.title}
                                    </span>
                                    <span className="text-[10px] text-gray-500 font-medium">
                                      {catTitle} {dish.nutritionalInfo?.calories ? `• ${dish.nutritionalInfo.calories} kcal` : ''}
                                    </span>
                                  </div>
                                </label>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Duplicar dados de um prato existente? [Agiliza Cadastro] (Imagem 5) */}
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black uppercase text-amber-950 flex items-center gap-1.5">
                       Duplicar dados de um prato existente?
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                      Agiliza Cadastro
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600 leading-tight">
                    Selecione um prato abaixo para copiar nome, fotos, valores, descrição e opções. Você poderá alterar o que desejar:
                  </p>
                  <select
                    value={duplicateSourceId}
                    onChange={e => handleDuplicateDish(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-amber-300 bg-white text-xs font-semibold text-gray-800"
                  >
                    <option value="">-- Escolher prato para duplicar seus dados... --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.title} {p.isCombo ? '(Combo)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Campos Principais: Nome, Categorias, Foto, Descrição (Imagem 5) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="md:col-span-2 space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase text-gray-800">
                        TÍTULO / NOME DO PRATO *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Beringela caprese e arroz negro - 350g"
                        value={newProduct.title || ''}
                        onChange={e => setNewProduct({ ...newProduct, title: e.target.value })}
                        className="w-full p-3 rounded-xl border border-gray-300 bg-white text-xs sm:text-sm font-semibold text-gray-900"
                      />
                    </div>

                    {/* Categoria */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase text-gray-800">
                        CATEGORIA *
                      </label>
                      <select
                        required
                        value={newProduct.categoryId || ''}
                        onChange={e => setNewProduct({ ...newProduct, categoryId: e.target.value })}
                        className="w-full p-3 rounded-xl border border-gray-300 bg-white text-xs sm:text-sm font-semibold text-gray-900"
                      >
                        <option value="">Selecione a categoria...</option>
                        {[...categories]
                          .sort((a, b) => (a.title || '').trim().localeCompare((b.title || '').trim(), 'pt-BR', { sensitivity: 'base' }))
                          .map(cat => {
                            const catLabel = cat.catalog && cat.catalog !== 'all' ? ` [${getCatalogLabel(cat.catalog)}]` : '';
                            return (
                              <option key={cat.id} value={cat.id}>
                                {cat.title}{catLabel}
                              </option>
                            );
                        })}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase text-gray-800">
                        DESCRIÇÃO / DETALHES DO PRODUTO
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Descreva os ingredientes principais, peso em gramas, modo de servir, etc..."
                        value={newProduct.description || ''}
                        onChange={e => setNewProduct({ ...newProduct, description: e.target.value })}
                        className="w-full p-3 rounded-xl border border-gray-300 bg-white text-xs font-semibold text-gray-900"
                      />
                    </div>
                  </div>

                  {/* Foto do Prato */}
                  <div className="space-y-2 flex flex-col items-center justify-center p-4 rounded-2xl bg-gray-50 border border-gray-200 text-center">
                    <span className="text-xs font-black uppercase text-gray-800 self-start">
                      FOTO DO PRODUTO
                    </span>
                    <div className="w-32 h-32 rounded-2xl bg-white border border-gray-300 flex items-center justify-center overflow-hidden shadow-xs my-2">
                      {newProduct.image ? (
                        <img
                          src={newProduct.image}
                          alt="Pré-visualização"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <ImageIcon size={36} className="text-gray-300" />
                      )}
                    </div>
                    <input
                      type="file"
                      id="product-photo-upload"
                      accept="image/*"
                      onChange={e => handleFileChange(e, (b64) => setNewProduct({ ...newProduct, image: b64 }))}
                      className="hidden"
                    />
                    <label
                      htmlFor="product-photo-upload"
                      className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 rounded-xl text-xs font-bold text-gray-800 cursor-pointer shadow-xs transition-colors"
                    >
                       Enviar Foto do Prato
                    </label>
                    <span className="text-[10px] text-gray-400 font-medium">
                      JPG, PNG, WEBP (fotos nítidas aumentam pedidos!)
                    </span>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 2: PREÇO & OPÇÕES DE TAMANHO (Imagens 6, 7, 8) */}
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-5 sm:p-6 border border-amber-200/80 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-amber-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                      2
                    </span>
                    <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-gray-900">
                      PREÇO & OPÇÕES DE TAMANHO
                    </h4>
                  </div>
                  {/* Segmented Controls (Imagem 6, 7, 8) */}
                  <div className="flex bg-gray-100 p-1 rounded-xl self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setSizeOptionMode('single')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                        sizeOptionMode === 'single' ? "bg-white text-gray-900 shadow-xs" : "text-gray-600 hover:text-gray-900"
                      )}
                    >
                      Preço Único
                    </button>
                    <button
                      type="button"
                      onClick={() => setSizeOptionMode('two')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                        sizeOptionMode === 'two' ? "bg-amber-800 text-white shadow-xs" : "text-gray-600 hover:text-gray-900"
                      )}
                    >
                      ● 2 Opções de Tamanho
                    </button>
                    <button
                      type="button"
                      onClick={() => setSizeOptionMode('multiple')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                        sizeOptionMode === 'multiple' ? "bg-amber-800 text-white shadow-xs" : "text-gray-600 hover:text-gray-900"
                      )}
                    >
                      Mais Opções / Combos
                    </button>
                  </div>
                </div>

                {/* Modo 1: Preço Único (Imagem 6) */}
                {sizeOptionMode === 'single' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase text-gray-800">
                        PREÇO PROMOCIONAL (POR) ({currencySymbol}) *
                      </label>
                      <input
                        type="text"
                        placeholder="R$ 0,00"
                        value={priceInput}
                        onChange={e => handlePriceChange(e.target.value)}
                        className="w-full p-3 rounded-xl border border-gray-300 bg-white font-bold text-sm text-gray-900"
                      />
                      <span className="text-[10px] text-gray-400 font-medium">
                        Valor principal de venda cobrado no cardápio.
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase text-gray-800">
                        PREÇO ORIGINAL RISCADO (DE) ({currencySymbol}) (OPCIONAL)
                      </label>
                      <input
                        type="text"
                        placeholder="R$ 0,00"
                        value={oldPriceInput}
                        onChange={e => handleOldPriceChange(e.target.value)}
                        className="w-full p-3 rounded-xl border border-gray-300 bg-white font-bold text-sm text-gray-900"
                      />
                      <span className="text-[10px] text-gray-400 font-medium">
                        Se preenchido, aparecerá como desconto "De R$ XX por R$ YY".
                      </span>
                    </div>
                  </div>
                )}

                {/* Modo 2: 2 Opções de Tamanho (Imagem 7) */}
                {sizeOptionMode === 'two' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-medium">
                      <span className="font-bold">2x 2 Opções de Tamanho do Mesmo Prato (com valores diferentes):</span> O prato é o mesmo, mas o cliente escolherá qual tamanho prefere no pop-up do cardápio e o valor correspondente será somado ao pedido.
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Opção 1 */}
                      <div className="p-4 rounded-2xl border border-amber-300/80 bg-white space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase text-amber-950 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold flex items-center justify-center">1</span>
                            1ª OPÇÃO DE TAMANHO
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium">Ex: Menor / Individual</span>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-gray-700">NOME / IDENTIFICAÇÃO DA OPÇÃO 1 *</label>
                          <input
                            type="text"
                            placeholder="Ex: 300g, Meia Porção, Individual..."
                            value={twoSize1.name}
                            onChange={e => setTwoSize1({ ...twoSize1, name: e.target.value })}
                            className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-semibold text-gray-900"
                          />
                        </div>
                        {/* Chips rápidos */}
                        <div className="flex gap-1.5 flex-wrap">
                          {['+ 300g', '+ Individual', '+ Meia Porção', '+ 350g', '+ 1 Pessoa'].map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => setTwoSize1({ ...twoSize1, name: chip.replace(/^\+\s*/, '') })}
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-700">PREÇO PROMOCIONAL *</label>
                            <input
                              type="text"
                              placeholder="R$ 0,00"
                              value={twoSize1.price}
                              onChange={e => {
                                const digits = e.target.value.replace(/\D/g, '');
                                const formatted = digits ? (parseInt(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
                                setTwoSize1({ ...twoSize1, price: formatted });
                              }}
                              className="w-full p-2 rounded-lg border border-gray-300 text-xs font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-700">PREÇO ORIGINAL</label>
                            <input
                              type="text"
                              placeholder="R$ 0,00"
                              value={twoSize1.oldPrice}
                              onChange={e => {
                                const digits = e.target.value.replace(/\D/g, '');
                                const formatted = digits ? (parseInt(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
                                setTwoSize1({ ...twoSize1, oldPrice: formatted });
                              }}
                              className="w-full p-2 rounded-lg border border-gray-300 text-xs font-bold"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-700">ESTOQUE / QUANTIDADE (UNIDADES)</label>
                          <input
                            type="number"
                            placeholder="Ex: 10 unidades (Opcional)"
                            value={twoSize1.stock}
                            onChange={e => setTwoSize1({ ...twoSize1, stock: e.target.value })}
                            className="w-full p-2 rounded-lg border border-gray-300 text-xs font-semibold"
                          />
                        </div>
                        <p className="text-[10px] text-amber-800 bg-amber-50 p-2 rounded-lg leading-tight">
                           <strong>Quando usar:</strong> Use se produziu um lote separado para esta opção (ex: 10 marmitas de 300g).
                        </p>
                      </div>

                      {/* Opção 2 */}
                      <div className="p-4 rounded-2xl border border-amber-300/80 bg-white space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase text-amber-950 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold flex items-center justify-center">2</span>
                            2ª OPÇÃO DE TAMANHO
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium">Ex: Maior / Família</span>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-gray-700">NOME / IDENTIFICAÇÃO DA OPÇÃO 2 *</label>
                          <input
                            type="text"
                            placeholder="Ex: 500g, Porção Inteira, Família..."
                            value={twoSize2.name}
                            onChange={e => setTwoSize2({ ...twoSize2, name: e.target.value })}
                            className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-semibold text-gray-900"
                          />
                        </div>
                        {/* Chips rápidos */}
                        <div className="flex gap-1.5 flex-wrap">
                          {['+ 500g', '+ Porção Inteira', '+ Família', '+ 700g', '+ 2 Pessoas'].map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => setTwoSize2({ ...twoSize2, name: chip.replace(/^\+\s*/, '') })}
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-700">PREÇO PROMOCIONAL *</label>
                            <input
                              type="text"
                              placeholder="R$ 0,00"
                              value={twoSize2.price}
                              onChange={e => {
                                const digits = e.target.value.replace(/\D/g, '');
                                const formatted = digits ? (parseInt(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
                                setTwoSize2({ ...twoSize2, price: formatted });
                              }}
                              className="w-full p-2 rounded-lg border border-gray-300 text-xs font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-700">PREÇO ORIGINAL</label>
                            <input
                              type="text"
                              placeholder="R$ 0,00"
                              value={twoSize2.oldPrice}
                              onChange={e => {
                                const digits = e.target.value.replace(/\D/g, '');
                                const formatted = digits ? (parseInt(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
                                setTwoSize2({ ...twoSize2, oldPrice: formatted });
                              }}
                              className="w-full p-2 rounded-lg border border-gray-300 text-xs font-bold"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-700">ESTOQUE / QUANTIDADE (UNIDADES)</label>
                          <input
                            type="number"
                            placeholder="Ex: 15 unidades (Opcional)"
                            value={twoSize2.stock}
                            onChange={e => setTwoSize2({ ...twoSize2, stock: e.target.value })}
                            className="w-full p-2 rounded-lg border border-gray-300 text-xs font-semibold"
                          />
                        </div>
                        <p className="text-[10px] text-amber-800 bg-amber-50 p-2 rounded-lg leading-tight">
                           <strong>Quando usar:</strong> Se esta opção zerar o estoque, o outro tamanho continuará disponível para compra!
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Modo 3: Mais Opções / Combos (Imagem 8) */}
                {sizeOptionMode === 'multiple' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="font-bold text-xs text-amber-950 block">Combos e Variações de Preço</span>
                        <span className="text-[11px] text-amber-800/80">
                          Configure opções como Marmita Individual, Combo 5 Marmitas, Combo 10, Combo 20 ou tamanhos P/M/G.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleLoadStandardMarmitaSizes}
                        className="px-4 py-2.5 rounded-xl text-xs font-black text-white bg-amber-800 hover:bg-amber-900 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0"
                      >
                        ⚡ Carregar Tabela Padrão de Marmitas (Individual + Combos 5, 10, 20, 30)
                      </button>
                    </div>

                    {/* Adicionar / Editar Opção */}
                    <div className={`p-4 rounded-2xl border transition-all ${
                      editingSizeIndex !== null 
                        ? 'border-amber-400 bg-amber-50/40 shadow-xs' 
                        : 'border-gray-200 bg-white'
                    } space-y-3`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-gray-900 block flex items-center gap-1.5">
                          {editingSizeIndex !== null ? (
                            <>
                              <Edit2 size={13} className="text-amber-800" />
                              <span>EDITANDO OPÇÃO #{editingSizeIndex + 1}</span>
                            </>
                          ) : (
                            <span>+ ADICIONAR NOVA OPÇÃO DE TAMANHO OU COMBO</span>
                          )}
                        </span>
                        {editingSizeIndex !== null && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSizeIndex(null);
                              setMultipleSizeForm({ name: '', price: '', stock: '' });
                            }}
                            className="text-[11px] font-bold text-gray-500 hover:text-gray-800 underline cursor-pointer"
                          >
                            Cancelar Edição
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">NOME DA OPÇÃO / COMBO *</label>
                          <input
                            type="text"
                            placeholder="Ex: Marmita individual, Porção 500g..."
                            value={multipleSizeForm.name}
                            onChange={e => setMultipleSizeForm({ ...multipleSizeForm, name: e.target.value })}
                            className="w-full p-2.5 rounded-xl border border-gray-300 text-xs font-semibold bg-white text-black"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase">PREÇO ({currencySymbol}) *</label>
                          <input
                            type="text"
                            placeholder="R$ 0,00"
                            value={multipleSizeForm.price}
                            onChange={e => {
                              const digits = e.target.value.replace(/\D/g, '');
                              const formatted = digits ? (parseInt(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
                              setMultipleSizeForm({ ...multipleSizeForm, price: formatted });
                            }}
                            className="w-full p-2.5 rounded-xl border border-gray-300 text-xs font-bold bg-white text-black"
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">ESTOQUE</label>
                            <input
                              type="number"
                              placeholder="Qtd."
                              value={multipleSizeForm.stock}
                              onChange={e => setMultipleSizeForm({ ...multipleSizeForm, stock: e.target.value })}
                              className="w-full p-2.5 rounded-xl border border-gray-300 text-xs font-semibold bg-white text-black"
                            />
                          </div>
                          {editingSizeIndex !== null ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (!multipleSizeForm.name.trim()) {
                                  toast.error('Informe o nome da opção.');
                                  return;
                                }
                                const p = multipleSizeForm.price ? (parseFloat(multipleSizeForm.price.replace(/\D/g, '')) / 100) : 0;
                                const s = multipleSizeForm.stock ? parseInt(multipleSizeForm.stock) : undefined;
                                const updatedSizes = [...(newProduct.sizes || [])];
                                updatedSizes[editingSizeIndex] = {
                                  ...updatedSizes[editingSizeIndex],
                                  name: multipleSizeForm.name.trim(),
                                  price: p,
                                  stock: s
                                };
                                setNewProduct({
                                  ...newProduct,
                                  sizes: updatedSizes
                                });
                                setEditingSizeIndex(null);
                                setMultipleSizeForm({ name: '', price: '', stock: '' });
                                toast.success('Opção atualizada com sucesso!');
                              }}
                              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1 shadow-xs"
                            >
                              <Save size={13} /> Salvar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (!multipleSizeForm.name.trim()) {
                                  toast.error('Informe o nome da opção.');
                                  return;
                                }
                                const p = multipleSizeForm.price ? (parseFloat(multipleSizeForm.price.replace(/\D/g, '')) / 100) : 0;
                                const s = multipleSizeForm.stock ? parseInt(multipleSizeForm.stock) : undefined;
                                const newSize: ProductSize = {
                                  id: Math.random().toString(36).substr(2, 9),
                                  name: multipleSizeForm.name.trim(),
                                  price: p,
                                  stock: s
                                };
                                setNewProduct({
                                  ...newProduct,
                                  hasSizes: true,
                                  sizes: [...(newProduct.sizes || []), newSize]
                                });
                                setMultipleSizeForm({ name: '', price: '', stock: '' });
                                toast.success('Opção adicionada!');
                              }}
                              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                            >
                              + Adicionar
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Lista de tamanhos configurados com Ordenação e Edição */}
                      <div className="space-y-1.5 pt-2">
                        {(newProduct.sizes || []).map((s, idx) => {
                          const isBeingEdited = editingSizeIndex === idx;
                          return (
                            <div 
                              key={idx} 
                              className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
                                isBeingEdited 
                                  ? 'bg-amber-100/70 border-amber-400 ring-2 ring-amber-300' 
                                  : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="font-bold text-gray-900">{s.name}</span>
                                <span className="font-black text-amber-900">{currencySymbol} {s.price.toFixed(2).replace('.', ',')}</span>
                                {s.stock !== undefined && (
                                  <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                                    Estoque: {s.stock} un
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                {/* Botão Mover para Cima */}
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => {
                                    if (idx === 0) return;
                                    const sizes = [...(newProduct.sizes || [])];
                                    const temp = sizes[idx - 1];
                                    sizes[idx - 1] = sizes[idx];
                                    sizes[idx] = temp;
                                    setNewProduct({ ...newProduct, sizes });
                                    if (editingSizeIndex === idx) setEditingSizeIndex(idx - 1);
                                    else if (editingSizeIndex === idx - 1) setEditingSizeIndex(idx);
                                  }}
                                  className="p-1.5 text-gray-600 hover:text-black hover:bg-white rounded-lg border border-transparent hover:border-gray-300 disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                                  title="Subir posição"
                                >
                                  <ArrowUp size={13} />
                                </button>

                                {/* Botão Mover para Baixo */}
                                <button
                                  type="button"
                                  disabled={idx === (newProduct.sizes || []).length - 1}
                                  onClick={() => {
                                    if (idx >= (newProduct.sizes || []).length - 1) return;
                                    const sizes = [...(newProduct.sizes || [])];
                                    const temp = sizes[idx + 1];
                                    sizes[idx + 1] = sizes[idx];
                                    sizes[idx] = temp;
                                    setNewProduct({ ...newProduct, sizes });
                                    if (editingSizeIndex === idx) setEditingSizeIndex(idx + 1);
                                    else if (editingSizeIndex === idx + 1) setEditingSizeIndex(idx);
                                  }}
                                  className="p-1.5 text-gray-600 hover:text-black hover:bg-white rounded-lg border border-transparent hover:border-gray-300 disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                                  title="Descer posição"
                                >
                                  <ArrowDown size={13} />
                                </button>

                                {/* Botão Editar */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSizeIndex(idx);
                                    setMultipleSizeForm({
                                      name: s.name,
                                      price: s.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                                      stock: s.stock !== undefined ? String(s.stock) : ''
                                    });
                                  }}
                                  className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-white rounded-lg border border-transparent hover:border-blue-200 cursor-pointer"
                                  title="Editar esta opção"
                                >
                                  <Edit2 size={13} />
                                </button>

                                {/* Botão Excluir */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (editingSizeIndex === idx) {
                                      setEditingSizeIndex(null);
                                      setMultipleSizeForm({ name: '', price: '', stock: '' });
                                    }
                                    setNewProduct({
                                      ...newProduct,
                                      sizes: (newProduct.sizes || []).filter((_, i) => i !== idx)
                                    });
                                  }}
                                  className="p-1.5 text-red-600 hover:text-red-800 hover:bg-white rounded-lg border border-transparent hover:border-red-200 cursor-pointer"
                                  title="Excluir"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {(newProduct.sizes || []).length === 0 && (
                          <p className="text-xs text-gray-400 italic text-center py-2">
                            Nenhum tamanho adicionado. Clique no botão de carregar tabela padrão acima ou adicione manualmente.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SEÇÃO 3: TABELA NUTRICIONAL (PADRÃO ANVISA - OPCIONAL) (Imagem 9 & 15) */}
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-5 sm:p-6 border border-amber-200/80 shadow-xs space-y-4">
                <div
                  onClick={() => setIsNutritionalExpanded(!isNutritionalExpanded)}
                  className="flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-amber-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                      3
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-gray-900">
                          Tabela Nutricional
                        </h4>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                          PADRÃO ANVISA (OPCIONAL)
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 font-medium">
                        Clique para expandir e informar calorias, carboidratos, proteínas, etc.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-bold text-gray-600 hover:text-gray-900 flex items-center gap-1 cursor-pointer"
                  >
                    <span>{isNutritionalExpanded ? 'Recolher' : 'Expandir'}</span>
                    <ChevronDown size={16} className={cn("transition-transform duration-200", isNutritionalExpanded ? "rotate-180" : "")} />
                  </button>
                </div>

                {isNutritionalExpanded && (
                  <div className="space-y-4 pt-3 border-t border-gray-100 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-700">PORÇÕES POR EMBALAGEM</label>
                        <input
                          type="text"
                          placeholder="Ex: 1 porção ou 4 porções"
                          value={newProduct.nutritionalInfo?.servingsPerPackage || ''}
                          onChange={e => setNewProduct({
                            ...newProduct,
                            nutritionalInfo: { ...(newProduct.nutritionalInfo || {}), servingsPerPackage: e.target.value }
                          })}
                          className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-semibold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-700">PORÇÃO DE / MEDIDA CASEIRA</label>
                        <input
                          type="text"
                          placeholder="Ex: 350 g (1 marmita inteira)"
                          value={newProduct.nutritionalInfo?.servingSize || ''}
                          onChange={e => setNewProduct({
                            ...newProduct,
                            nutritionalInfo: { ...(newProduct.nutritionalInfo || {}), servingSize: e.target.value }
                          })}
                          className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-semibold"
                        />
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white text-xs divide-y divide-gray-100">
                      <div className="grid grid-cols-12 bg-gray-50 p-2.5 font-black text-gray-700 text-[10px] uppercase">
                        <div className="col-span-6">NUTRIENTE</div>
                        <div className="col-span-3">QUANTIDADE</div>
                        <div className="col-span-3 text-right">% VD*</div>
                      </div>

                      {/* Linhas Nutricionais */}
                      {[
                        { label: 'Valor energético (kcal)', key: 'calories', vdKey: 'caloriesVd', placeholder: 'Ex: 350' },
                        { label: 'Carboidratos totais (g)', key: 'carbs', vdKey: 'carbsVd', placeholder: 'Ex: 45' },
                        { label: '↳ Açúcares totais (g)', key: 'totalSugars', vdKey: undefined, placeholder: 'Ex: 2', indent: true },
                        { label: '↳ Açúcares adicionados (g)', key: 'addedSugars', vdKey: 'addedSugarsVd', placeholder: 'Ex: 0', indent: true },
                        { label: 'Proteínas (g)', key: 'proteins', vdKey: 'proteinsVd', placeholder: 'Ex: 18' },
                        { label: 'Gorduras totais (g)', key: 'totalFat', vdKey: 'totalFatVd', placeholder: 'Ex: 8' },
                        { label: '↳ Gorduras saturadas (g)', key: 'saturatedFat', vdKey: 'saturatedFatVd', placeholder: 'Ex: 2', indent: true },
                        { label: '↳ Gorduras trans (g)', key: 'transFat', vdKey: 'transFatVd', placeholder: 'Ex: 0', indent: true },
                        { label: 'Fibra alimentar (g)', key: 'fiber', vdKey: 'fiberVd', placeholder: 'Ex: 6' },
                        { label: 'Sódio (mg)', key: 'sodium', vdKey: 'sodiumVd', placeholder: 'Ex: 140' },
                      ].map((item, idx) => (
                        <div key={idx} className={cn("grid grid-cols-12 p-2 items-center gap-2", item.indent ? "bg-amber-50/20 pl-4 border-l-2 border-l-amber-500" : "")}>
                          <div className={cn("col-span-6 font-bold text-gray-800", item.indent ? "text-[11px] text-gray-600" : "text-xs")}>
                            {item.label}
                          </div>
                          <div className="col-span-3">
                            <input
                              type="text"
                              placeholder={item.placeholder}
                              value={(newProduct.nutritionalInfo as any)?.[item.key] || ''}
                              onChange={e => setNewProduct({
                                ...newProduct,
                                nutritionalInfo: {
                                  ...(newProduct.nutritionalInfo || {}),
                                  [item.key]: e.target.value
                                }
                              })}
                              className="w-full p-1.5 rounded-lg border border-gray-300 text-xs font-semibold"
                            />
                          </div>
                          <div className="col-span-3 text-right">
                            {item.vdKey ? (
                              <input
                                type="text"
                                placeholder="%"
                                value={(newProduct.nutritionalInfo as any)?.[item.vdKey] || ''}
                                onChange={e => setNewProduct({
                                  ...newProduct,
                                  nutritionalInfo: {
                                    ...(newProduct.nutritionalInfo || {}),
                                    [item.vdKey!]: e.target.value
                                  }
                                })}
                                className="w-16 p-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-right inline-block"
                              />
                            ) : (
                              <span className="text-gray-300 text-center block">-</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* SEÇÃO 4: CONTROLE DE ESTOQUE & QUANTIDADE DISPONÍVEL (Imagens 10 & 11) */}
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-5 sm:p-6 border border-amber-200/80 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 text-base flex items-center justify-center shrink-0">
                      
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-gray-900">
                          CONTROLE DE ESTOQUE & QUANTIDADE DISPONÍVEL
                        </h4>
                        {trackStock && parseInt(stockQuantityInput, 10) === 0 && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-100 text-red-700">
                            ESGOTADO
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 font-medium">
                        Defina quantas unidades deste prato estão prontas para venda. O contador diminui automaticamente a cada pedido.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={trackStock}
                      onChange={e => setTrackStock(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-700 focus:ring-amber-600 border-gray-300 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-gray-800">Controlar estoque deste prato</span>
                  </label>
                </div>

                {/* Guia em qual caso usar (Imagem 10) */}
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-2 text-xs">
                  <span className="font-black text-amber-950 flex items-center gap-1.5 text-[11px] uppercase">
                     GUIA: EM QUAL CASO USAR CADA CONTROLE DE ESTOQUE?
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div className="bg-white p-3 rounded-xl border border-amber-200">
                      <span className="font-bold text-amber-900 block text-[11px]">1 Estoque Global (Nesta Seção 4)</span>
                      <p className="text-[10px] text-gray-600 mt-1">
                        <strong>Quando usar:</strong> Para pratos de Preço Único ou quando você quer um limite total fixo para o prato inteiro.
                      </p>
                      <p className="text-[10px] text-amber-800 font-medium mt-1">
                        Exemplo: Você tem 20 marmitas prontas. Marque a caixa e coloque 20. A cada compra, diminui 1. Ao atingir 0, o prato aparece como <strong>ESGOTADO</strong>.
                      </p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-amber-200">
                      <span className="font-bold text-amber-900 block text-[11px]">2 Estoque por Tamanho (Na Seção 2 Acima)</span>
                      <p className="text-[10px] text-gray-600 mt-1">
                        <strong>Quando usar:</strong> Quando você ativou "2 Opções de Tamanho" (ex: 300g e 500g) e possui estoques diferentes para cada pote.
                      </p>
                      <p className="text-[10px] text-amber-800 font-medium mt-1">
                        Exemplo: 10 potes de 300g e 5 de 500g. Preencha direto lá na seção de tamanhos. Se o de 500g esgotar, o de 300g continua à venda!
                      </p>
                    </div>
                  </div>
                </div>

                {/* Input de Estoque Global (Imagem 11) */}
                {trackStock && (
                  <div className="p-4 rounded-xl bg-white border border-amber-300 space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase text-gray-800">
                        QUANTIDADE DISPONÍVEL EM ESTOQUE *
                      </label>
                      {parseInt(stockQuantityInput, 10) === 0 && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-100 text-red-700">
                          ESGOTADO
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={stockQuantityInput}
                      onChange={e => setStockQuantityInput(e.target.value)}
                      className="w-32 p-3 text-lg font-black text-center rounded-xl border border-gray-300 bg-white"
                    />
                    <p className="text-xs text-gray-500 font-medium">
                      Digite a quantidade pronta entrega. Se colocar 0, o cliente verá como <strong className="text-red-700">ESGOTADO</strong> e não conseguirá adicionar ao carrinho.
                    </p>
                    <div className="p-2.5 rounded-lg bg-amber-50 text-[11px] text-amber-900 font-medium">
                      ⚡ <strong>Baixa Automática nas Vendas:</strong> Conforme os clientes fizerem pedidos no cardápio e finalizarem, a quantidade diminuirá automaticamente aqui no painel e no link do cliente em tempo real.
                    </div>
                  </div>
                )}
              </div>

              {/* Botões de Ação do Formulário */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 text-white cursor-pointer hover:brightness-110 active:scale-95 transition-all text-sm"
                  style={{
                    backgroundColor: settings?.primaryColor || '#865d39',
                    color: getContrastText(settings?.primaryColor || '#865d39'),
                  }}
                >
                  {isEditingProduct ? <Save size={18} /> : <Plus size={18} />}
                  {isEditingProduct ? 'Salvar Alterações' : 'Adicionar ao Cardápio'}
                </button>
                {isEditingProduct && (
                  <button
                    type="button"
                    onClick={handleResetProductForm}
                    className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gray-200 font-bold text-black cursor-pointer hover:bg-gray-300 transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-black/10 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar produto pelo nome..."
                  className="w-full p-3 pl-10 rounded-xl border border-gray-300 bg-white text-black"
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={printAllProductsList}
                className="w-full md:w-auto px-6 py-3 rounded-xl bg-gray-900 hover:bg-slate-800 text-white font-bold flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <Printer size={18} /> Imprimir Todos os Produtos
              </button>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="text-center p-12 bg-white/95 backdrop-blur-md rounded-2xl shadow-sm border border-black/10">
                <p className="text-gray-500 font-bold text-black opacity-60">Nenhum produto encontrado com a pesquisa atual.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map(product => (
                  <motion.div 
                    layout
                    key={product.id} 
                    className={cn(
                      "bg-white/95 backdrop-blur-md rounded-2xl overflow-hidden flex flex-col border transition-all shadow-sm hover:shadow-md",
                      product.isActive === false ? "opacity-50 grayscale border-black/10" : "border-black/10"
                    )}
                  >
                    <div className="h-48 relative">
                      <img src={product.image} alt={product.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute top-3 right-3 flex gap-2">
                        <button 
                           onClick={() => toggleProductStatus(product)}
                          className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm text-gray-700 hover:text-black"
                          title={product.isActive === false ? "Ativar" : "Desativar"}
                        >
                          {product.isActive === false ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                        <button 
                          onClick={() => {
                            handleStartEditProduct(product);
                            scrollToTop();
                          }}
                          className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Editar Prato / Combo"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => deleteProduct(product.id)}
                          className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm text-red-600 hover:bg-red-50 transition-colors"
                          title="Excluir Prato / Combo"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="p-5 flex-grow flex flex-col gap-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="space-y-1">
                          <h4 className="font-serif font-bold text-lg leading-tight">{product.title}</h4>
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {product.isCombo ? (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black rounded-lg uppercase">
                                 Combo {product.comboLimit || 5} marmitas
                              </span>
                            ) : product.hideIndividual ? (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-black rounded-lg uppercase">
                                 Só em combos
                              </span>
                            ) : null}

                            {product.trackStock && (
                              (product.stockQuantity ?? 0) <= 0 ? (
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 border border-red-300 text-[10px] font-black rounded-lg uppercase">
                                   ESGOTADO
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-bold rounded-lg uppercase">
                                   {product.stockQuantity} un
                                </span>
                              )
                            )}

                            {product.nutritionalInfo?.servingSize && (
                              <span className="px-2 py-0.5 bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-bold rounded-lg">
                                 Tabela ANVISA
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          {product.sizes && product.sizes.length > 0 ? (
                            <>
                              <span className="text-[10px] font-bold uppercase opacity-40">Tamanhos múltiplos</span>
                              <span className="font-bold text-blue-600">
                                A partir de: {currencySymbol} {Math.min(...product.sizes.map(s => s.price)).toFixed(2).replace('.', ',')}
                              </span>
                            </>
                          ) : (
                            <>
                              {Boolean(product.price > 0 && product.oldPrice && product.oldPrice > 0) && (
                                <span className="text-xs line-through opacity-40">
                                  {currencySymbol} {product.oldPrice!.toFixed(2).replace('.', ',')}
                                </span>
                              )}
                              <span className="font-bold text-blue-600">
                                {currencySymbol} {(product.price > 0 ? product.price : (product.oldPrice || 0)).toFixed(2).replace('.', ',')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="text-sm opacity-60 line-clamp-2">{product.description}</p>
                      
                      {product.sizes && product.sizes.length > 0 && (
                        <div className="bg-black/5 p-2 rounded-xl text-[11px] space-y-1 mt-2">
                          <span className="font-bold opacity-60">Tamanhos:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {product.sizes.map((s, idx) => (
                              <span key={idx} className="bg-white/70 px-2 py-0.5 rounded border border-black/5 font-medium text-black">
                                {s.name} ({currencySymbol} {s.price.toFixed(2).replace('.', ',')})
                                {s.stock !== undefined && ` [${s.stock} un]`}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-auto pt-3 flex items-center justify-between border-t border-black/5">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-40">
                          {categories.find(c => c.id === product.categoryId)?.title || 'Sem categoria'}
                        </span>
                        <div className="flex gap-1.5">
                          {product.isMeal && (
                            <span className="px-2 py-1 bg-green-50 text-green-600 text-[10px] font-bold rounded-full uppercase">
                              Opções de Personalização
                            </span>
                          )}
                          {product.sizes && product.sizes.length > 0 && (
                            <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full uppercase">
                              Múltiplos Tamanhos
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'sortMenu' && (
          <SortMenuAdmin 
            categories={categories}
            products={products}
            settings={settings}
            onGoToProducts={() => setActiveTab('menu')}
            onEditProduct={(prod) => {
              setIsEditingProduct(prod);
              setActiveTab('menu');
            }}
          />
        )}

        {activeTab === 'orders' && (
          <div className="space-y-8">
            {/* Dynamic Orders Calendar */}
            <OrdersCalendar 
              orders={orders} 
              settings={settings}
              products={products}
              onSelectOrderInList={(orderId) => {
                const el = document.getElementById(`order-${orderId}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.classList.add('ring-4', 'ring-blue-400');
                  setTimeout(() => el.classList.remove('ring-4', 'ring-blue-400'), 2500);
                } else {
                  setStartDate('');
                  setEndDate('');
                  setOrderSearch('');
                  setSelectedHistoryCatalog('all');
                  setFilterValidatedOnly(false);
                  setShowBatchSummary(false);
                  setTimeout(() => {
                    const target = document.getElementById(`order-${orderId}`);
                    if (target) {
                      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      target.classList.add('ring-4', 'ring-blue-400');
                      setTimeout(() => target.classList.remove('ring-4', 'ring-blue-400'), 2500);
                    }
                  }, 150);
                }
              }}
              onPrintOrder={(ord) => printOrder(ord)}
              onEditOrder={(ord) => {
                setIsEditingOrder(ord);
                setEditOrderForm({ ...ord, phone: formatPhoneByCountry(ord.phone || '', settings?.whatsappCountryCode || '+55') });
              }}
            />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-3xl font-serif font-bold">Histórico de Pedidos</h2>
              <div className="flex flex-wrap items-center gap-3">
                <button 
                  onClick={() => {
                    setManualOrderForm({
                      customerName: '',
                      phone: '',
                      email: '',
                      address: '',
                      street: '',
                      number: '',
                      zipCode: '',
                      city: '',
                      pickupDate: '',
                      observation: '',
                      birthday: ''
                    });
                    setManualOrderItems([]);
                    setOrderCustomerSearch('');
                    setIsAddingOrder(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-white bg-green-600 hover:bg-green-700 shadow-md transition-all cursor-pointer"
                >
                  <Plus size={18} /> Adicionar Pedido
                </button>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input 
                    type="text" 
                    placeholder="DD/MM/AAAA"
                    className="pl-10 p-2 rounded-xl border border-gray-300 bg-white text-black font-semibold text-sm w-36 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#865d39]"
                    value={startDate}
                    onChange={e => {
                      let val = e.target.value.replace(/\D/g, '');
                      if (val.length > 8) val = val.slice(0, 8);
                      if (val.length > 4) val = val.slice(0, 2) + '/' + val.slice(2, 4) + '/' + val.slice(4);
                      else if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2);
                      setStartDate(val);
                    }}
                  />
                </div>
                <span className="text-gray-800 font-bold">até</span>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input 
                    type="text" 
                    placeholder="DD/MM/AAAA"
                    className="pl-10 p-2 rounded-xl border border-gray-300 bg-white text-black font-semibold text-sm w-36 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#865d39]"
                    value={endDate}
                    onChange={e => {
                      let val = e.target.value.replace(/\D/g, '');
                      if (val.length > 8) val = val.slice(0, 8);
                      if (val.length > 4) val = val.slice(0, 2) + '/' + val.slice(2, 4) + '/' + val.slice(4);
                      else if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2);
                      setEndDate(val);
                    }}
                  />
                </div>
                <button 
                  onClick={() => {
                    setShowBatchSummary(false);
                    setStartDate('');
                    setEndDate('');
                    setSelectedHistoryCatalog('all');
                    setFilterValidatedOnly(false);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all cursor-pointer",
                    (selectedHistoryCatalog === 'all' && !startDate && !endDate && !showBatchSummary && !filterValidatedOnly) 
                      ? "bg-gray-800 text-white shadow-md" 
                      : "bg-white border border-gray-300 text-gray-600"
                  )}
                >
                  <History size={18} /> Todos os Pedidos
                </button>
                <button 
                  onClick={() => {
                    setShowBatchSummary(false);
                    setFilterValidatedOnly(!filterValidatedOnly);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all cursor-pointer",
                    filterValidatedOnly 
                      ? "bg-amber-900 text-white shadow-md font-extrabold ring-2 ring-amber-300" 
                      : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <CheckCircle2 size={18} className={filterValidatedOnly ? "text-white" : "text-amber-800"} /> Pedidos Validados
                </button>

                <button 
                  onClick={() => {
                    if (!startDate || !endDate) {
                      toast.error('Por favor, selecione um intervalo de datas primeiro.');
                      return;
                    }
                    setShowBatchSummary(!showBatchSummary);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all cursor-pointer",
                    showBatchSummary ? "bg-amber-900 text-white shadow-md font-extrabold" : "bg-white border border-gray-300 text-gray-600"
                  )}
                >
                  <Layers size={18} /> Resumo de Produção
                </button>
                {showBatchSummary ? (
                  <button 
                    onClick={printProductionSummary}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-white transition-all shadow-md cursor-pointer hover:brightness-110"
                    style={{ backgroundColor: settings?.primaryColor || '#865d39' }}
                  >
                    <Printer size={18} /> Imprimir Resumo
                  </button>
                ) : (
                  <button 
                    onClick={printOrdersList}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-white transition-all shadow-md cursor-pointer hover:brightness-110"
                    style={{ backgroundColor: settings?.primaryColor || '#865d39' }}
                  >
                    <Printer size={18} /> Imprimir Lista
                  </button>
                )}
              </div>
            </div>

            <div className="glass p-4 rounded-2xl flex flex-col gap-2">
              <input 
                type="text" 
                placeholder="Buscar por nome do cliente, telefone ou ID..."
                className="w-full p-3 rounded-xl border border-gray-300 bg-white"
                value={orderSearch}
                onChange={e => setOrderSearch(e.target.value)}
              />
              <div className="flex justify-between items-center px-1 text-xs">
                <span className="font-bold text-gray-600">
                  Exibindo {filteredOrders.length} {filteredOrders.length === 1 ? 'pedido' : 'pedidos'} no histórico
                </span>
                {orders.length > 0 && filteredOrders.length !== orders.length && (
                  <button
                    onClick={() => {
                      setOrderSearch('');
                      setStartDate('');
                      setEndDate('');
                      setFilterValidatedOnly(false);
                      setSelectedHistoryCatalog('all');
                    }}
                    className="text-amber-900 font-bold hover:underline cursor-pointer"
                  >
                    Limpar filtros ({orders.length} pedidos no total)
                  </button>
                )}
              </div>
            </div>

            {showBatchSummary ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl space-y-4 shadow-sm border border-black/10">
                  <h3 className="text-xl font-serif font-bold flex items-center gap-2">
                    <Package size={20} className="text-amber-900" />
                    Total de Itens
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(batchSummary.items).length > 0 ? (
                      Object.entries(batchSummary.items).map(([title, qty]) => (
                        <div key={title} className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                          <span className="font-bold">{title}</span>
                          <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-full font-bold">{qty}x</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-gray-500 py-4">Nenhum item no período</p>
                    )}
                  </div>
                </div>

                <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl space-y-4 shadow-sm border border-black/10">
                  <h3 className="text-xl font-serif font-bold flex items-center gap-2">
                    <Plus size={20} className="text-amber-800" />
                    Total de Acompanhamentos
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(batchSummary.sides).length > 0 ? (
                      Object.entries(batchSummary.sides).map(([name, qty]) => (
                        <div key={name} className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                          <span className="font-bold">{name}</span>
                          <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-full font-bold">{qty}x</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-gray-500 py-4">Nenhum acompanhamento no período</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map(order => (
                <motion.div 
                  layout
                  key={order.id} 
                  id={`order-${order.id}`}
                  className="bg-white/95 backdrop-blur-md p-6 rounded-2xl space-y-4 border border-black/10 shadow-sm hover:shadow-md"
                >
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-serif font-bold text-black">
                          {order.isB2B || order.isPJ 
                            ? (order.b2bCompanyName || order.customerName)
                            : order.customerName
                          }
                        </h3>
                        {(order.isB2B || order.isPJ) && (
                          <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-black rounded-full flex items-center gap-1 border border-amber-200 uppercase tracking-widest animate-pulse">
                            ★ Corporate PJ
                          </span>
                        )}
                        {isBirthdayThisWeek(order.birthday, order.orderLanguage) && (
                          <span className="px-3 py-1 bg-pink-100 text-pink-600 text-xs font-bold rounded-full flex items-center gap-1">
                            <Cake size={12} /> Aniversariante! ({order.birthday})
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-700 font-medium">
                        <a 
                          href={`https://wa.me/${getCleanWhatsAppPhone(order.phone)}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-green-600 transition-colors font-bold text-black"
                        >
                          <MessageCircle size={14} className="text-green-600" /> {order.phone}
                        </a>
                        <span className="flex items-center gap-1">
                          <Calendar size={14} /> Criado em: {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString('pt-BR') : (order.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000).toLocaleString('pt-BR') : (order.createdAt ? new Date(order.createdAt as any).toLocaleString('pt-BR') : 'N/A'))}
                        </span>
                        {order.pickupDate && (
                          <span 
                            className="flex items-center gap-1.5 font-black px-3 py-1 rounded-xl shadow-sm text-xs"
                            style={{ 
                              backgroundColor: settings?.primaryColor || '#865d39',
                              color: getContrastText(settings?.primaryColor || '#865d39')
                            }}
                          >
                             Agendado para: {order.pickupDate}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 mt-2">
                        <span className="text-xs font-bold text-gray-500 mr-1 uppercase">Sinalizar Pagamento:</span>
                        <button
                          onClick={() => updateOrderPaymentStatus(order.id, 'pending')}
                          className={cn(
                            "px-2.5 py-1 text-xs font-bold rounded-lg transition-all border cursor-pointer",
                            (!order.paymentStatus || order.paymentStatus === 'pending')
                              ? "bg-red-50 text-red-700 border-red-300 shadow-sm"
                              : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                          )}
                        >
                          ❌ Não Recebido
                        </button>
                        <button
                          onClick={() => updateOrderPaymentStatus(order.id, 'half')}
                          className={cn(
                            "px-2.5 py-1 text-xs font-bold rounded-lg transition-all border flex items-center gap-1 cursor-pointer",
                            order.paymentStatus === 'half'
                              ? "bg-amber-100 text-amber-800 border-amber-400 shadow-sm font-extrabold ring-2 ring-amber-200"
                              : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                          )}
                        >
                          ⏳ 50% Recebido
                        </button>
                        <button
                          onClick={() => updateOrderPaymentStatus(order.id, 'full')}
                          className={cn(
                            "px-2.5 py-1 text-xs font-bold rounded-lg transition-all border flex items-center gap-1 cursor-pointer",
                            order.paymentStatus === 'full'
                              ? "bg-amber-100 text-amber-900 border-amber-400 shadow-sm font-extrabold ring-2 ring-amber-200"
                              : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                          )}
                        >
                          ✅ Valor Integral
                        </button>
                        {(order.paymentStatus === 'half' || order.paymentStatus === 'full') && (
                          <span 
                            className="ml-1 px-2.5 py-1 text-xs font-black text-white rounded-lg uppercase tracking-wider shadow-md"
                            style={{ backgroundColor: settings?.primaryColor || '#865d39' }}
                          >
                             Validado para Produção
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-4 w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <button 
                          onClick={() => sendOrderToWhatsApp(order, settings)}
                          className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm transition-all cursor-pointer hover:bg-gray-50"
                          style={{ color: settings?.primaryColor || '#865d39' }}
                          title="Reenviar Resumo do Pedido pelo WhatsApp"
                        >
                          <MessageCircle size={20} />
                        </button>
                        <button 
                          onClick={() => printOrder(order)}
                          className="p-3 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 shadow-sm cursor-pointer"
                          title="Imprimir Comanda"
                        >
                          <Printer size={20} />
                        </button>
                        <button 
                          onClick={() => {
                            setIsEditingOrder(order);
                            setEditOrderForm({ ...order, phone: formatPhoneByCountry(order.phone || '', settings?.whatsappCountryCode || '+55') });
                          }}
                          className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm cursor-pointer hover:bg-gray-50"
                          style={{ color: settings?.primaryColor || '#865d39' }}
                          title="Editar Pedido"
                        >
                          <Edit2 size={20} />
                        </button>
                        <button 
                          onClick={() => deleteOrder(order.id)}
                          className="p-3 bg-white border border-gray-200 rounded-xl text-red-600 hover:bg-red-50 shadow-sm"
                        >
                          <Trash2 size={20} />
                        </button>
                        <button 
                          onClick={() => toggleOrder(order.id)}
                          className="p-3 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 shadow-sm transition-all"
                          title={expandedOrders.includes(order.id) ? "Recolher" : "Expandir"}
                        >
                          {expandedOrders.includes(order.id) ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold uppercase opacity-40">
                          Total do Pedido
                        </div>
                        <div className="text-xl font-extrabold" style={{ color: settings?.primaryColor || '#865d39' }}>
                          {currencySymbol} {order.total.toFixed(2).replace('.', ',')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedOrders.includes(order.id) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-4"
                      >
                        <div className="bg-white rounded-xl p-4 space-y-3 border border-gray-200 shadow-sm">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-start border-b border-black/5 last:border-0 pb-2 last:pb-0">
                              <div className="space-y-1">
                                <div className="font-bold text-black">{item.quantity}x {item.title}{item.selectedSize ? ` (${item.selectedSize.name})` : ''}</div>
                                {item.cakeOptions && (
                                  <div className="text-xs text-gray-700 space-y-0.5 font-medium">
                                    {item.cakeOptions.size && <div><span className="font-bold">Tamanho:</span> {item.cakeOptions.size}</div>}
                                    {item.cakeOptions.dough && <div><span className="font-bold">Massa:</span> {item.cakeOptions.dough}</div>}
                                    {item.cakeOptions.fillings && item.cakeOptions.fillings.length > 0 && (
                                      <div><span className="font-bold">Recheios:</span> {item.cakeOptions.fillings.join(', ')}</div>
                                    )}
                                    {item.cakeOptions.topping && <div><span className="font-bold">Cobertura:</span> {item.cakeOptions.topping}</div>}
                                    {item.cakeOptions.topper && <div><span className="font-bold">Topper:</span> {item.cakeOptions.topper}</div>}
                                  </div>
                                )}
                                {item.sandwichOptions && item.sandwichOptions.fillings && item.sandwichOptions.fillings.length > 0 && (
                                  <div className="text-xs text-gray-700 font-medium">
                                    <div><span className="font-bold">Recheios:</span> {item.sandwichOptions.fillings.join(', ')}</div>
                                  </div>
                                )}
                                {item.mealOptions && (
                                  <div className="text-xs text-gray-700 space-y-1 font-medium">
                                    {item.mealOptions.removals.length > 0 && (
                                      <div><span className="font-bold">Remover:</span> {item.mealOptions.removals.join(', ')}</div>
                                    )}
                                    {item.mealOptions.sides.length > 0 && (
                                      <div><span className="font-bold">Acompanhamentos:</span> {item.mealOptions.sides.map(s => s.name).join(', ')}</div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="font-bold text-black">{currencySymbol} {(item.price * item.quantity).toFixed(2).replace('.', ',')}</div>
                            </div>
                          ))}
                          
                          {order.total > 0 && !(order.isB2B || order.isPJ) && (
                            <div className="border-t border-black/10 pt-3 mt-3 space-y-1.5 text-xs text-black font-semibold">
                              {(order.taxAmount && order.taxAmount > 0) ? (
                                <>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 font-medium">Subtotal:</span>
                                    <span>{currencySymbol} {(order.subtotal || (order.total - order.taxAmount)).toFixed(2).replace('.', ',')}</span>
                                  </div>
                                  <div className="flex justify-between text-amber-900">
                                    <span className="text-gray-600 font-medium">Sales Tax ({order.taxRate || 8.25}%):</span>
                                    <span>+ {currencySymbol} {order.taxAmount.toFixed(2).replace('.', ',')}</span>
                                  </div>
                                  <div className="flex justify-between text-base font-extrabold border-t border-black/5 pt-1.5" style={{ color: settings?.primaryColor || '#865d39' }}>
                                    <span>Total com Tax:</span>
                                    <span>{currencySymbol} {order.total.toFixed(2).replace('.', ',')}</span>
                                  </div>
                                </>
                              ) : (
                                <div className="space-y-1">
                                  {(order.deliveryFee !== undefined && order.deliveryFee > 0) ? (
                                    <>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600 font-medium">Subtotal dos Itens:</span>
                                        <span>{currencySymbol} {(order.subtotal || (order.total - order.deliveryFee)).toFixed(2).replace('.', ',')}</span>
                                      </div>
                                      <div className="flex justify-between text-blue-800">
                                        <span className="text-gray-600 font-medium flex items-center gap-1">
                                          <Truck size={13} /> Frete ({order.deliveryDistanceKm ? `${order.deliveryDistanceKm} km` : 'KM'}):
                                        </span>
                                        <span>+ {currencySymbol} {order.deliveryFee.toFixed(2).replace('.', ',')}</span>
                                      </div>
                                    </>
                                  ) : order.deliveryType === 'pickup' ? (
                                    <div className="flex justify-between text-green-700">
                                      <span className="text-gray-600 font-medium flex items-center gap-1">
                                        <Truck size={13} /> Retirada no Local:
                                      </span>
                                      <span>Grátis</span>
                                    </div>
                                  ) : null}
                                  <div className="flex justify-between text-base font-extrabold pt-1.5" style={{ color: settings?.primaryColor || '#865d39' }}>
                                    <span>Total:</span>
                                    <span>{currencySymbol} {order.total.toFixed(2).replace('.', ',')}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                          <div className="space-y-1">
                            <div className="font-bold uppercase text-gray-500 text-[10px] flex items-center justify-between">
                              <span>{(order.isB2B || order.isPJ) ? "Endereço Comercial / Delivery" : "Endereço de Entrega/Retirada"}</span>
                              {order.deliveryType && (
                                <span className={cn(
                                  "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider",
                                  order.deliveryType === 'pickup' ? "bg-amber-100 text-amber-900" : "bg-stone-200 text-stone-900"
                                )}>
                                  {order.deliveryType === 'pickup' ? ' Retirada' : ' Delivery'}
                                </span>
                              )}
                            </div>
                            <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm font-medium text-black">
                              <div>{order.b2bAddress || order.address}</div>
                              {order.neighborhood && (
                                <div className="text-xs text-gray-600 mt-1">Bairro: <span className="font-bold text-black">{order.neighborhood}</span></div>
                              )}
                            </div>
                          </div>

                          {(order.isB2B || order.isPJ) ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <div className="font-bold uppercase text-gray-500 text-[10px]">Responsável / Contato</div>
                                  <div className="p-2.5 bg-black/5 rounded-lg border border-black/10 font-bold text-black">{order.b2bManagerName || 'N/A'}</div>
                                </div>
                                <div className="space-y-1">
                                  <div className="font-bold uppercase text-gray-500 text-[10px]">Frequência do Plano</div>
                                  <div className="p-2.5 bg-amber-500/10 text-amber-900 rounded-lg border border-amber-500/20 font-extrabold uppercase text-xs flex items-center justify-center text-center">
                                    {order.b2bFrequency === 'weekly' ? ' Weekly' : ' One-Time'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : null}

                          <div className="space-y-1 md:col-span-2">
                            <div className="font-bold uppercase text-gray-500 text-[10px]">Observações / Requisitos Especiais</div>
                            <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm italic text-black">
                              {order.observation || 'Nenhuma observação informada.'}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
              {filteredOrders.length === 0 && (
                <div className="glass p-12 rounded-2xl text-center text-gray-500">
                  Nenhum pedido encontrado com os filtros aplicados.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'customers' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-3xl font-serif font-bold">Clientes</h2>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => {
                  setNewCustomerForm({
                    name: '', phone: '', email: '', birthday: '', isB2B: false, managerName: '', frequency: '', address: '', street: '', number: '', zipCode: '', city: ''
                  });
                  setIsRegisteringCustomer(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-white shadow-md transition-all cursor-pointer hover:brightness-110 active:scale-95"
                style={{ backgroundColor: settings?.primaryColor || '#865d39' }}
              >
                <Plus size={18} /> Cadastrar Cliente
              </button>
              <button 
                onClick={() => {
                  setShowBirthdaysOnly(!showBirthdaysOnly);
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all cursor-pointer",
                  showBirthdaysOnly ? "bg-pink-500 text-white shadow-md" : "bg-white border border-gray-300 text-gray-600"
                )}
              >
                <Cake size={18} /> Aniversários da Semana
              </button>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-black/10">
            <input 
              type="text" 
              placeholder="Buscar por nome, telefone, nº do pedido ou item do cardápio..."
              className="w-full p-3 rounded-xl border border-gray-300 bg-white text-black"
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {combinedCustomers
              .filter(c => {
                const query = customerSearch.trim().toLowerCase();
                const cleanQueryPhone = customerSearch.replace(/\D/g, '');

                let matchesSearch = true;
                if (query) {
                  const matchesName = (c.name || '').toLowerCase().includes(query);
                  const matchesPhone = cleanQueryPhone.length > 0 && (c.phone || '').replace(/\D/g, '').includes(cleanQueryPhone);
                  const matchesEmail = (c.email || '').toLowerCase().includes(query);

                  // Buscar por histórico de pedidos / pratos / itens do cardápio pedidos pelo cliente
                  const customerOrders: Order[] = (c.orders && c.orders.length > 0)
                    ? c.orders
                    : orders.filter((o: Order) => 
                        (o.phone && c.phone && o.phone.replace(/\D/g, '') === c.phone.replace(/\D/g, '')) ||
                        (o.customerName && c.name && o.customerName.trim().toLowerCase() === c.name.trim().toLowerCase())
                      );

                  const matchesOrderOrItem = customerOrders.some((order: Order) => {
                    // Match por código / ID do pedido
                    if (order.id && order.id.toLowerCase().includes(query)) return true;
                    if (order.observation && order.observation.toLowerCase().includes(query)) return true;

                    // Match por itens do cardápio pedidos
                    if (order.items && Array.isArray(order.items)) {
                      return order.items.some((item: any) => {
                        if (item.title && item.title.toLowerCase().includes(query)) return true;
                        if (item.selectedSize?.name && item.selectedSize.name.toLowerCase().includes(query)) return true;
                        if (item.observation && item.observation.toLowerCase().includes(query)) return true;

                        // Pratos de combos
                        if (item.comboSelections && Array.isArray(item.comboSelections)) {
                          if (item.comboSelections.some((d: any) => d.dishTitle && d.dishTitle.toLowerCase().includes(query))) return true;
                        }

                        // Opções de bolos / massas / recheios
                        if (item.cakeOptions) {
                          if (item.cakeOptions.size && item.cakeOptions.size.toLowerCase().includes(query)) return true;
                          if (item.cakeOptions.dough && item.cakeOptions.dough.toLowerCase().includes(query)) return true;
                          if (item.cakeOptions.topping && item.cakeOptions.topping.toLowerCase().includes(query)) return true;
                          if (item.cakeOptions.fillings && Array.isArray(item.cakeOptions.fillings)) {
                            if (item.cakeOptions.fillings.some((f: string) => f.toLowerCase().includes(query))) return true;
                          }
                        }

                        // Opções de sanduíches
                        if (item.sandwichOptions?.fillings && Array.isArray(item.sandwichOptions.fillings)) {
                          if (item.sandwichOptions.fillings.some((f: string) => f.toLowerCase().includes(query))) return true;
                        }

                        // Acompanhamentos
                        if (item.mealOptions?.sides && Array.isArray(item.mealOptions.sides)) {
                          if (item.mealOptions.sides.some((s: any) => s.name && s.name.toLowerCase().includes(query))) return true;
                        }

                        return false;
                      });
                    }
                    return false;
                  });

                  matchesSearch = matchesName || matchesPhone || matchesEmail || matchesOrderOrItem;
                }
                
                let matchesBirthday = true;
                if (showBirthdaysOnly) {
                  matchesBirthday = isBirthdayThisWeek(c.birthday, c.orderLanguage);
                }
                
                return matchesSearch && matchesBirthday;
              })
              .sort((a, b) => {
                const getTimestamp = (customer: any) => {
                  if (customer.lastOrder) {
                    if (customer.lastOrder.toDate) return customer.lastOrder.toDate().getTime();
                    if (customer.lastOrder instanceof Date) return customer.lastOrder.getTime();
                    const parsed = Date.parse(customer.lastOrder);
                    if (!isNaN(parsed)) return parsed;
                  }
                  if (customer.createdAt) {
                    if (customer.createdAt.toDate) return customer.createdAt.toDate().getTime();
                    if (customer.createdAt instanceof Date) return customer.createdAt.getTime();
                    const parsed = Date.parse(customer.createdAt);
                    if (!isNaN(parsed)) return parsed;
                  }
                  return 0;
                };
                const timeA = getTimestamp(a);
                const timeB = getTimestamp(b);
                return timeB - timeA;
              })
              .map((customer, idx) => {
                const isBdayUpcoming = customer.birthday && isBirthdayThisWeek(customer.birthday, customer.orderLanguage);
                return (
                  <motion.div 
                    key={customer.id || idx}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className={cn(
                      "p-6 rounded-[2rem] space-y-4 relative overflow-hidden group transition-all duration-300 bg-white border shadow-sm hover:shadow-md",
                      isBdayUpcoming 
                        ? "border-2 border-pink-400 shadow-[0_12px_30px_rgba(244,63,94,0.15)] scale-[1.01]" 
                        : "border-gray-200"
                    )}
                  >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1 flex-grow pr-4">
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-serif font-bold text-black">{customer.name}</h3>
                          </div>
                          <a 
                            href={`https://wa.me/${getCleanWhatsAppPhone(customer.phone, settings?.whatsappCountryCode || '+55')}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-gray-700 hover:text-green-600 transition-colors font-semibold"
                          >
                            <MessageCircle size={14} className="text-green-600" />
                            <span className="text-black">{customer.phone}</span>
                          </a>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button 
                            onClick={() => setViewingCustomerOrders(customer)}
                            className="bg-[#865d39]/10 hover:bg-[#865d39]/20 text-[#865d39] px-2.5 py-1 rounded-full text-xs font-black whitespace-nowrap cursor-pointer transition-all border border-[#865d39]/20"
                            title="Ver Histórico de Pedidos"
                          >
                            {customer.totalOrders} {customer.totalOrders === 1 ? 'Pedido' : 'Pedidos'}
                          </button>
                          <button 
                            onClick={() => {
                              setIsEditingCustomer(customer);
                              setEditCustomerForm({
                                name: customer.name,
                                phone: formatPhoneByCountry(customer.phone, settings?.whatsappCountryCode || '+55'),
                                email: customer.email,
                                birthday: customer.birthday,
                                address: customer.address,
                                isB2B: customer.isB2B,
                                managerName: customer.managerName,
                                street: customer.street,
                                number: customer.number,
                                zipCode: customer.zipCode,
                                city: customer.city,
                                frequency: customer.frequency
                              });
                            }}
                            className="p-1.5 text-amber-900 hover:bg-amber-50 hover:text-amber-950 bg-white shadow-sm border border-amber-200 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                            title="Editar Cliente"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => {
                              setConfirmModal({
                                  isOpen: true,
                                  title: 'Excluir Cliente',
                                  message: `Tem certeza que deseja excluir o cliente ${customer.name} e todos os seus ${customer.totalOrders} pedidos?`,
                                  onConfirm: () => deleteCustomer(customer)
                              });
                            }}
                            className="p-1.5 text-red-650 hover:bg-red-50 hover:text-red-700 bg-white shadow-sm border border-gray-200 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                            title="Excluir Cliente"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        {customer.email && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <span className="font-bold text-black">E-mail:</span>
                            <span className="text-black">{customer.email}</span>
                          </div>
                        )}
                        {customer.birthday && (() => {
                          const isBdayUpcoming = isBirthdayThisWeek(customer.birthday, customer.orderLanguage);
                          return (
                            <div className="space-y-2">
                              {isBdayUpcoming ? (
                                <>
                                  <div className="flex items-center gap-2 text-pink-600 font-bold">
                                    <Cake size={14} />
                                    <span>Aniversário: {customer.birthday} (Esta semana! )</span>
                                  </div>
                                  <div className="flex flex-col gap-1.5 p-3 bg-pink-500/10 border border-pink-500/20 rounded-2xl mt-1.5">
                                    <span className="text-[10px] uppercase font-black text-pink-800 tracking-wider">
                                       Enviar Mensagem de Feliz Aniversário:
                                    </span>
                                    <div className="w-full">
                                      <a 
                                        href={`https://wa.me/${getCleanWhatsAppPhone(customer.phone)}?text=${encodeURIComponent(
                                          `Parabéns, ${customer.name}!  A equipe da ${settings?.brandName || 'Escola de gastronomia e negócios'} te deseja um feliz aniversário! Que o seu dia seja repleto de realizações, sucesso e muito aprendizado. Como nosso presente para comemorar seu dia, preparamos uma oferta especial com surpresa no seu próximo pedido! `
                                        )}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-1.5 w-full py-1.5 bg-[#4a2e18] hover:bg-[#3b2413] active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                                      >
                                        <MessageCircle size={13} className="text-white" />
                                        <span>WhatsApp</span>
                                      </a>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="flex items-center gap-2 text-gray-700">
                                  <span className="font-bold text-black">Aniversário:</span>
                                  <span className="text-black">{customer.birthday}</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {customer.address && (
                          <div className="flex items-start gap-2 text-gray-700">
                            <span className="font-bold text-black flex-shrink-0">Endereço:</span>
                            <span className="line-clamp-2 text-black font-medium">{customer.address}</span>
                          </div>
                        )}
                      </div>

                  {/* Tag indicativa quando o termo de busca bate com itens de pedidos do cliente */}
                  {customerSearch.trim() && (() => {
                    const q = customerSearch.trim().toLowerCase();
                    const matchedItems: string[] = [];
                    const custOrders: Order[] = (customer.orders && customer.orders.length > 0)
                      ? customer.orders
                      : orders.filter((o: Order) => 
                          (o.phone && customer.phone && o.phone.replace(/\D/g, '') === customer.phone.replace(/\D/g, '')) ||
                          (o.customerName && customer.name && o.customerName.trim().toLowerCase() === customer.name.trim().toLowerCase())
                        );

                    custOrders.forEach((o: Order) => {
                      (o.items || []).forEach((it: any) => {
                        if (it.title && it.title.toLowerCase().includes(q)) {
                          if (!matchedItems.includes(it.title)) matchedItems.push(it.title);
                        }
                        (it.comboSelections || []).forEach((cs: any) => {
                          if (cs.dishTitle && cs.dishTitle.toLowerCase().includes(q)) {
                            if (!matchedItems.includes(cs.dishTitle)) matchedItems.push(cs.dishTitle);
                          }
                        });
                      });
                    });

                    if (matchedItems.length > 0) {
                      return (
                        <div className="bg-amber-50 text-amber-950 border border-amber-300/80 rounded-xl px-3 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 shadow-2xs">
                          <span className="font-extrabold text-amber-900 uppercase text-[9px] tracking-wider shrink-0">Item pedido:</span>
                          <span className="truncate">{matchedItems.slice(0, 2).join(', ')}{matchedItems.length > 2 ? ` (+${matchedItems.length - 2})` : ''}</span>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="pt-4 border-t border-gray-100 flex justify-between items-center text-xs text-gray-600 font-medium">
                    <span>Último pedido:</span>
                    <span className="font-bold text-black">
                      {customer.lastOrder?.toDate 
                        ? customer.lastOrder.toDate().toLocaleDateString('pt-BR') 
                        : 'N/A'}
                    </span>
                  </div>
                </motion.div>
              )})}
          </div>
        </motion.div>
      )}

      {activeTab === 'posvenda' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/60 backdrop-blur-md p-6 rounded-3xl border border-black/5 shadow-xs">
            <div>
              <h2 className="text-2xl font-serif font-bold text-black">Instruções de Pós-Venda</h2>
              <p className="text-sm text-black/60">
                Configure os campos e modelos de mensagens que aparecerão como botões rápidos na janela do pedido para envio direto no WhatsApp do cliente.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <button
                type="button"
                onClick={() => {
                  const newId = `inst-${Date.now()}`;
                  setInstructionsList(prev => [
                    ...prev,
                    { id: newId, title: `Nova Instrução ${prev.length + 1}`, message: '', active: true }
                  ]);
                }}
                className="px-4 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95 transition-all flex-1 md:flex-none"
              >
                <Plus size={16} /> Adicionar Campo
              </button>
              <button
                type="button"
                onClick={() => handleSaveInstructions()}
                disabled={isSavingInstructions}
                className="px-6 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-95 transition-all flex-1 md:flex-none"
                style={{
                  backgroundColor: settings?.primaryColor || '#865d39',
                  color: getContrastText(settings?.primaryColor || '#865d39')
                }}
              >
                {isSavingInstructions ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Salvar Instruções
              </button>
            </div>
          </div>

          {/* Dica / Info Card */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-950 flex items-start gap-3">
            <Info size={18} className="shrink-0 mt-0.5 text-amber-800" />
            <div className="space-y-1">
              <p className="font-bold">Como funciona no WhatsApp do cliente:</p>
              <p>
                Ao clicar em qualquer um dos botões dentro do popup do pedido, o sistema abrirá o WhatsApp do cliente iniciando com a saudação automática personalizada:
                <strong className="block text-amber-900 mt-0.5">
                  "Olá [Nome do Cliente]! Aqui é da {settings?.brandName || 'Grão & Sabor'}."
                </strong>
                seguida exatamente das instruções que você cadastrar abaixo.
              </p>
            </div>
          </div>

          {/* Grid de Campos de Instruções */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {instructionsList.map((inst, idx) => (
              <div 
                key={inst.id}
                className="bg-white p-5 md:p-6 rounded-3xl border border-gray-200/90 shadow-xs space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wider text-black/70">
                        Campo de Instrução {idx + 1}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-700 select-none">
                        <input 
                          type="checkbox"
                          checked={inst.active !== false}
                          onChange={e => {
                            const val = e.target.checked;
                            setInstructionsList(prev => prev.map(item => item.id === inst.id ? { ...item, active: val } : item));
                          }}
                          className="rounded text-amber-700 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                        />
                        Ativo no Pedido
                      </label>
                      {instructionsList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setInstructionsList(prev => prev.filter(item => item.id !== inst.id));
                          }}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Excluir este campo"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
                      Nome / Título do Botão (Exibido no Pedido)
                    </label>
                    <input
                      type="text"
                      value={inst.title}
                      placeholder="Ex: Instruções de Retirada"
                      onChange={e => {
                        const val = e.target.value;
                        setInstructionsList(prev => prev.map(item => item.id === inst.id ? { ...item, title: val } : item));
                      }}
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white font-bold text-sm text-gray-900 outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
                      Mensagem de Instruções Enviada ao Cliente
                    </label>
                    <textarea
                      rows={5}
                      value={inst.message}
                      placeholder="Digite aqui as instruções que o cliente receberá no WhatsApp..."
                      onChange={e => {
                        const val = e.target.value;
                        setInstructionsList(prev => prev.map(item => item.id === inst.id ? { ...item, message: val } : item));
                      }}
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-xs text-gray-800 outline-none focus:ring-2 focus:ring-amber-500/20 resize-y"
                    />
                  </div>

                  {/* Prévia */}
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200/60 text-[11px] text-gray-700 space-y-1">
                    <span className="font-bold text-gray-500 uppercase text-[10px] tracking-wide block">
                      Exemplo no WhatsApp do Cliente:
                    </span>
                    <p className="font-bold text-gray-900">
                      Olá [Nome do Cliente]! Aqui é da {settings?.brandName || 'Grão & Sabor'}.
                    </p>
                    <p className="whitespace-pre-wrap text-gray-600">
                      {inst.message || '(Nenhum texto cadastrado ainda)'}
                    </p>
                  </div>
                </div>

                {/* Botão de Salvar dedicado para este campo */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-gray-500 font-semibold">
                    {inst.active !== false ? '• Ativo no pedido' : '• Desativado'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSaveInstructions(inst.id)}
                    disabled={isSavingInstructions}
                    className="px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs hover:shadow-md cursor-pointer active:scale-95 transition-all"
                    style={{
                      backgroundColor: settings?.primaryColor || '#865d39',
                      color: getContrastText(settings?.primaryColor || '#865d39')
                    }}
                  >
                    {isSavingInstructions && savingCardId === inst.id ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Save size={15} />
                    )}
                    <span>Salvar Campo {idx + 1}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      
      <div className="mt-32 pt-16 pb-32 border-t border-gray-200/40 w-full">
        <Footer settings={settings} hideActionButtons={true} />
      </div>
      </main>

      <AnimatePresence>
        {isEditingCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-6 md:p-8 rounded-3xl w-full max-w-2xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto border border-gray-200 text-black"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-serif font-bold">Editar Cliente</h3>
                <button onClick={() => setIsEditingCustomer(null)} className="p-2 hover:bg-black/5 rounded-full">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={updateCustomer} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">Nome do Cliente</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300"
                      value={editCustomerForm.name || ''}
                      onChange={e => setEditCustomerForm({...editCustomerForm, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">WhatsApp</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300"
                      value={formatPhoneByCountry(editCustomerForm.phone || '', settings?.whatsappCountryCode || '+55')}
                      placeholder={COUNTRY_OPTIONS[settings?.whatsappCountryCode || '+55']?.placeholder || '(99) 99999-9999'}
                      onChange={e => setEditCustomerForm({...editCustomerForm, phone: formatPhoneByCountry(e.target.value, settings?.whatsappCountryCode || '+55')})}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">E-mail</label>
                    <input 
                      type="email" 
                      className="w-full p-3 rounded-xl border border-gray-300"
                      value={editCustomerForm.email || ''}
                      onChange={e => setEditCustomerForm({...editCustomerForm, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">Aniversário (Dia/Mês)</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300"
                      value={editCustomerForm.birthday || ''}
                      placeholder="DD/MM"
                      onChange={e => {
                        let val = e.target.value.replace(/\D/g, '');
                        if (val.length > 4) val = val.slice(0, 4);
                        if (val.length > 2) {
                          val = val.slice(0, 2) + '/' + val.slice(2);
                        }
                        setEditCustomerForm({...editCustomerForm, birthday: val});
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">Rua / Logradouro</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300"
                      value={editCustomerForm.street || ''}
                      onChange={e => setEditCustomerForm({...editCustomerForm, street: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">Número</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300"
                      value={editCustomerForm.number || ''}
                      onChange={e => setEditCustomerForm({...editCustomerForm, number: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">CEP</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 font-mono"
                      value={editCustomerForm.zipCode || ''}
                      onChange={e => setEditCustomerForm({...editCustomerForm, zipCode: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">Cidade / Estado</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300"
                      value={editCustomerForm.city || ''}
                      onChange={e => setEditCustomerForm({...editCustomerForm, city: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase opacity-60">Endereço Completo</label>
                  <input 
                    type="text" 
                    className="w-full p-3 rounded-xl border border-gray-300 opacity-80"
                    value={editCustomerForm.address || ''}
                    onChange={e => setEditCustomerForm({...editCustomerForm, address: e.target.value})}
                  />
                </div>
                 <button 
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2"
                  style={{ 
                    backgroundColor: settings?.primaryColor || '#865d39',
                    color: getContrastText(settings?.primaryColor || '#865d39')
                  }}
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : 'Salvar Alterações'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {isRegisteringCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-6 md:p-8 rounded-3xl w-full max-w-2xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto border border-gray-200 text-black"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-serif font-bold">Cadastrar Cliente</h3>
                <button onClick={() => setIsRegisteringCustomer(false)} className="p-2 hover:bg-black/5 rounded-full">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={saveNewCustomer} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">Nome do Cliente</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-black"
                      value={newCustomerForm.name || ''}
                      onChange={e => setNewCustomerForm({...newCustomerForm, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">WhatsApp / Telefone</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-black"
                      value={formatPhoneByCountry(newCustomerForm.phone || '', settings?.whatsappCountryCode || '+55')}
                      placeholder={COUNTRY_OPTIONS[settings?.whatsappCountryCode || '+55']?.placeholder || '(99) 99999-9999'}
                      onChange={e => setNewCustomerForm({...newCustomerForm, phone: formatPhoneByCountry(e.target.value, settings?.whatsappCountryCode || '+55')})}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">E-mail</label>
                    <input 
                      type="email" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-black"
                      value={newCustomerForm.email || ''}
                      onChange={e => setNewCustomerForm({...newCustomerForm, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">Aniversário (Dia/Mês)</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-black"
                      value={newCustomerForm.birthday || ''}
                      placeholder="DD/MM"
                      onChange={e => {
                        let val = e.target.value.replace(/\D/g, '');
                        if (val.length > 4) val = val.slice(0, 4);
                        if (val.length > 2) {
                          val = val.slice(0, 2) + '/' + val.slice(2);
                        }
                        setNewCustomerForm({...newCustomerForm, birthday: val});
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">Rua / Logradouro</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-black"
                      value={newCustomerForm.street || ''}
                      onChange={e => setNewCustomerForm({...newCustomerForm, street: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">Número</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-black"
                      value={newCustomerForm.number || ''}
                      onChange={e => setNewCustomerForm({...newCustomerForm, number: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">CEP</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-black font-mono"
                      value={newCustomerForm.zipCode || ''}
                      onChange={e => setNewCustomerForm({...newCustomerForm, zipCode: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">Cidade / Estado</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-black"
                      value={newCustomerForm.city || ''}
                      onChange={e => setNewCustomerForm({...newCustomerForm, city: e.target.value})}
                    />
                  </div>
                </div>
                 <button 
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2"
                  style={{ 
                    backgroundColor: settings?.primaryColor || '#865d39',
                    color: getContrastText(settings?.primaryColor || '#865d39')
                  }}
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : 'Cadastrar Cliente'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {isEditingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-6 md:p-8 rounded-3xl w-full max-w-2xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto border border-gray-200 text-black"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-serif font-bold">Editar Pedido</h3>
                <button onClick={() => setIsEditingOrder(null)} className="p-2 hover:bg-black/5 rounded-full">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleEditOrder} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">Nome do Cliente</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300"
                      value={editOrderForm.customerName || ''}
                      onChange={e => setEditOrderForm({...editOrderForm, customerName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">WhatsApp</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300"
                      value={formatPhoneByCountry(editOrderForm.phone || '', settings?.whatsappCountryCode || '+55')}
                      placeholder={COUNTRY_OPTIONS[settings?.whatsappCountryCode || '+55']?.placeholder || '(99) 99999-9999'}
                      onChange={e => setEditOrderForm({...editOrderForm, phone: formatPhoneByCountry(e.target.value, settings?.whatsappCountryCode || '+55')})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">Email</label>
                    <input 
                      type="email" 
                      className="w-full p-3 rounded-xl border border-gray-300"
                      value={editOrderForm.email || ''}
                      onChange={e => setEditOrderForm({...editOrderForm, email: e.target.value})}
                    />
                  </div>
                   <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">Aniversário (Dia/Mês)</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300"
                      value={editOrderForm.birthday || ''}
                      placeholder="DD/MM"
                      onChange={e => {
                        let val = e.target.value.replace(/\D/g, '');
                        if (val.length > 4) val = val.slice(0, 4);
                        if (val.length > 2) {
                          val = val.slice(0, 2) + '/' + val.slice(2);
                        }
                        setEditOrderForm({...editOrderForm, birthday: val});
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase opacity-60">Endereço</label>
                  <input 
                    type="text" 
                    className="w-full p-3 rounded-xl border border-gray-300"
                    value={editOrderForm.address || ''}
                    onChange={e => setEditOrderForm({...editOrderForm, address: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-amber-800" /> Data de Entrega / Retirada
                      </span>
                      {editOrderForm.pickupDate && (
                        <span className="text-[11px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                          {editOrderForm.pickupDate}
                        </span>
                      )}
                    </label>
                    <div className="space-y-1.5">
                      <input 
                        type="date" 
                        className="w-full p-3 rounded-xl border border-gray-300 bg-white font-bold text-gray-900 cursor-pointer shadow-xs outline-none focus:ring-2 focus:ring-amber-500/20"
                        style={{ colorScheme: 'light' }}
                        value={(() => {
                          const val = editOrderForm.pickupDate || '';
                          if (val.includes('/')) {
                            const [d, m, y] = val.split('/');
                            if (d && m && y && y.length === 4) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                          }
                          return val;
                        })()}
                        onChange={e => {
                          const dateVal = e.target.value; // YYYY-MM-DD
                          if (dateVal.includes('-')) {
                            const [y, m, d] = dateVal.split('-');
                            setEditOrderForm({...editOrderForm, pickupDate: `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`});
                          } else {
                            setEditOrderForm({...editOrderForm, pickupDate: dateVal});
                          }
                        }}
                        onClick={e => {
                          try {
                            (e.target as any).showPicker?.();
                          } catch (_) {}
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">Preço Final (Total)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold opacity-40">{currencySymbol}</span>
                      <input 
                        type="number" 
                        step="0.01"
                        className="w-full p-3 pl-12 rounded-xl border border-gray-300 font-bold text-gray-900 focus:ring-2 focus:ring-amber-500/20"
                        value={editOrderForm.total || 0}
                        onChange={e => setEditOrderForm({...editOrderForm, total: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                </div>

                {/* --- SEÇÃO DE ITENS DO PEDIDO --- */}
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-gray-800">Itens do Pedido</h4>
                    <span className="text-xs font-semibold text-gray-500">
                      {(editOrderForm.items || []).length} { (editOrderForm.items || []).length === 1 ? 'item' : 'itens' }
                    </span>
                  </div>
                  
                  {editOrderForm.items && editOrderForm.items.length > 0 ? (
                    <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-1">
                      {editOrderForm.items.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-200 gap-3 text-gray-900 shadow-xs">
                          <div className="flex-grow min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-sm text-gray-900">{item.title}</p>
                              {item.isCustomItem && (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                                  Item Avulso (Fora do Cardápio)
                                </span>
                              )}
                            </div>
                            {item.selectedSize && (
                              <p className="text-xs text-gray-600 font-semibold">Tamanho: {item.selectedSize.name}</p>
                            )}
                            {item.sandwichOptions && item.sandwichOptions.fillings && item.sandwichOptions.fillings.length > 0 && (
                              <div className="text-xs text-gray-600 space-y-0.5 mt-0.5">
                                <p>Recheios: {item.sandwichOptions.fillings.join(', ')}</p>
                              </div>
                            )}
                            {item.cakeOptions && (
                              <div className="text-xs text-gray-600 space-y-0.5 mt-0.5">
                                {item.cakeOptions.size && <p>Tamanho: {item.cakeOptions.size}</p>}
                                {item.cakeOptions.dough && <p>Massa: {item.cakeOptions.dough}</p>}
                                {item.cakeOptions.fillings && item.cakeOptions.fillings.length > 0 && (
                                  <p>Recheios: {item.cakeOptions.fillings.join(', ')}</p>
                                )}
                                {item.cakeOptions.topping && <p>Cobertura: {item.cakeOptions.topping}</p>}
                                {item.cakeOptions.topper && <p>Topper: {item.cakeOptions.topper}</p>}
                              </div>
                            )}
                            {item.mealOptions && (
                              <div className="text-xs text-gray-600 space-y-0.5 mt-0.5">
                                {item.mealOptions.removals && item.mealOptions.removals.length > 0 && (
                                  <p>Sem: {item.mealOptions.removals.join(', ')}</p>
                                )}
                                {item.mealOptions.sides && item.mealOptions.sides.length > 0 && (
                                  <p>Extras: {item.mealOptions.sides.map(s => s.name).join(', ')}</p>
                                )}
                              </div>
                            )}
                            {item.observation && (
                              <p className="text-xs text-amber-800 italic mt-0.5">Obs: {item.observation}</p>
                            )}
                            
                            {/* Editable price input with currency formatting */}
                            <div className="flex items-center gap-1.5 mt-2 text-xs">
                              <span className="font-bold text-gray-500">Preço Unitário: {currencySymbol}</span>
                              <input 
                                type="number" 
                                step="0.01" 
                                className="w-24 px-2.5 py-1 rounded-lg border border-gray-300 bg-white text-gray-900 font-bold text-xs" 
                                value={item.price} 
                                onChange={e => {
                                  const newPrice = parseFloat(e.target.value) || 0;
                                  const updatedItems = [...(editOrderForm.items || [])];
                                  updatedItems[index].price = newPrice;
                                  updateOrderFormWithItems(updatedItems);
                                }} 
                              />
                              <span className="text-gray-400 font-bold">× {item.quantity} =</span>
                              <strong className="text-gray-900 font-bold">
                                {currencySymbol} {((item.price || 0) * (item.quantity || 1)).toFixed(2).replace('.', ',')}
                              </strong>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden bg-white shadow-xs">
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedItems = [...(editOrderForm.items || [])];
                                  if (updatedItems[index].quantity > 1) {
                                    updatedItems[index].quantity -= 1;
                                    updateOrderFormWithItems(updatedItems);
                                  }
                                }}
                                className="px-2.5 py-1 hover:bg-gray-100 font-bold border-r border-gray-200 text-black cursor-pointer"
                              >
                                -
                              </button>
                              <span className="px-3 py-1 font-bold text-sm min-w-[24px] text-center text-black">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedItems = [...(editOrderForm.items || [])];
                                  updatedItems[index].quantity += 1;
                                  updateOrderFormWithItems(updatedItems);
                                }}
                                className="px-2.5 py-1 hover:bg-gray-100 font-bold border-l border-gray-200 text-black cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const updatedItems = (editOrderForm.items || []).filter((_, idx) => idx !== index);
                                updateOrderFormWithItems(updatedItems);
                              }}
                              className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-xl transition-all cursor-pointer"
                              title="Excluir item"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm opacity-50 italic text-gray-500">Nenhum item neste pedido.</p>
                  )}

                  {/* Add item interface with tabs */}
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-700">Adicionar Item ao Pedido</p>
                      <div className="flex items-center bg-gray-200/80 p-0.5 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setEditItemTab('catalog')}
                          className={cn(
                            "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                            editItemTab === 'catalog' ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                          )}
                        >
                          Do Cardápio
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditItemTab('custom')}
                          className={cn(
                            "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                            editItemTab === 'custom' ? "bg-purple-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
                          )}
                        >
                          Fora do Cardápio (Avulso)
                        </button>
                      </div>
                    </div>

                    {editItemTab === 'catalog' ? (
                      <div className="flex flex-col sm:flex-row gap-3">
                        <select
                          value={selectedProductId}
                          onChange={e => setSelectedProductId(e.target.value)}
                          className="flex-grow p-3 rounded-xl border border-gray-300 bg-white text-sm text-black"
                        >
                          <option value="">-- Selecione um produto do cardápio --</option>
                          {products.flatMap(p => {
                            if (p.hasSizes && p.sizes && p.sizes.length > 0) {
                              return p.sizes.map(s => (
                                <option key={`${p.id}::${s.id || s.name}`} value={`${p.id}::${s.id || s.name}`}>
                                  {p.title} - {s.name} ({currencySymbol} {s.price.toFixed(2)})
                                </option>
                              ));
                            } else {
                              const activePrice = (p.price && p.price > 0) ? p.price : (p.oldPrice || 0);
                              return (
                                <option key={p.id} value={p.id}>
                                  {p.title} ({currencySymbol} {activePrice.toFixed(2)})
                                </option>
                              );
                            }
                          })}
                        </select>
                        
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="1"
                            className="w-16 p-3 rounded-xl border border-gray-300 text-center font-bold text-black bg-white"
                            value={addItemQuantity}
                            onChange={e => setAddItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!selectedProductId) return;
                              
                              let prodId = selectedProductId;
                              let sizeKey = '';
                              
                              if (selectedProductId.includes('::')) {
                                const parts = selectedProductId.split('::');
                                prodId = parts[0];
                                sizeKey = parts[1];
                              }
                              
                              const prod = products.find(p => p.id === prodId);
                              if (!prod) return;
                              
                              let activePrice = 0;
                              let itemTitle = prod.title;
                              let selectedSizeObj: any = undefined;
                              
                              if (sizeKey && prod.sizes) {
                                const foundSize = prod.sizes.find(s => (s.id === sizeKey || s.name === sizeKey));
                                if (foundSize) {
                                  activePrice = foundSize.price;
                                  selectedSizeObj = foundSize;
                                } else {
                                  activePrice = (prod.price && prod.price > 0) ? prod.price : (prod.oldPrice || 0);
                                }
                              } else {
                                activePrice = (prod.price && prod.price > 0) ? prod.price : (prod.oldPrice || 0);
                              }
                              
                              const newItem = {
                                title: itemTitle,
                                quantity: addItemQuantity,
                                price: activePrice,
                                selectedSize: selectedSizeObj,
                                cakeOptions: {},
                                mealOptions: {
                                  removals: [],
                                  sides: []
                                }
                              };
                              
                              const updatedItems = [...(editOrderForm.items || []), newItem];
                              updateOrderFormWithItems(updatedItems);
                              
                              // Reset selection
                              setSelectedProductId('');
                              setAddItemQuantity(1);
                              toast.success(`"${itemTitle}" adicionado ao pedido!`);
                            }}
                            disabled={!selectedProductId}
                            className="px-4 py-3 text-white font-bold rounded-xl text-xs sm:text-sm transition-all whitespace-nowrap uppercase tracking-wider cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ backgroundColor: settings?.primaryColor || '#865d39' }}
                          >
                            Adicionar
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Formulário de Item Fora do Cardápio (Avulso / Personalizado) */
                      <div className="space-y-3 p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2 space-y-1">
                            <label className="text-[10px] font-black uppercase text-amber-900 tracking-wider">
                              Nome do Item / Produto Avulso *
                            </label>
                            <input
                              type="text"
                              placeholder="Ex: Bolo Especial 3 Andares / Taxa Decoração"
                              className="w-full p-2.5 rounded-xl border border-amber-300 bg-white text-xs font-bold text-gray-900 focus:ring-2 focus:ring-amber-400 outline-none"
                              value={customItemTitle}
                              onChange={e => setCustomItemTitle(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-amber-900 tracking-wider">
                              Preço Unitário ({currencySymbol}) *
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="0,00"
                              className="w-full p-2.5 rounded-xl border border-amber-300 bg-white text-xs font-bold text-gray-900 focus:ring-2 focus:ring-amber-400 outline-none font-mono"
                              value={customItemPriceInput}
                              onChange={e => {
                                const digits = e.target.value.replace(/\D/g, '');
                                if (!digits) {
                                  setCustomItemPriceInput('');
                                  return;
                                }
                                const num = parseInt(digits, 10) / 100;
                                setCustomItemPriceInput(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                              }}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-amber-900 tracking-wider">
                              Quantidade
                            </label>
                            <input
                              type="number"
                              min="1"
                              className="w-full p-2.5 rounded-xl border border-amber-300 bg-white text-xs font-bold text-center text-gray-900"
                              value={customItemQuantity}
                              onChange={e => setCustomItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                            />
                          </div>
                          <div className="sm:col-span-3 space-y-1">
                            <label className="text-[10px] font-black uppercase text-amber-900 tracking-wider">
                              Detalhes / Observação do Item (Opcional)
                            </label>
                            <input
                              type="text"
                              placeholder="Ex: Recheio artesanal de nozes, topo de flores"
                              className="w-full p-2.5 rounded-xl border border-amber-300 bg-white text-xs text-gray-800"
                              value={customItemNotes}
                              onChange={e => setCustomItemNotes(e.target.value)}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (!customItemTitle.trim()) {
                              toast.error('Informe o nome do item avulso.');
                              return;
                            }
                            const priceVal = customItemPriceInput 
                              ? (parseFloat(customItemPriceInput.replace(/\D/g, '')) / 100) 
                              : 0;
                            const newItem = {
                              title: customItemTitle.trim(),
                              quantity: customItemQuantity || 1,
                              price: priceVal,
                              observation: customItemNotes.trim() || undefined,
                              isCustomItem: true
                            };
                            const updatedItems = [...(editOrderForm.items || []), newItem];
                            updateOrderFormWithItems(updatedItems);
                            setCustomItemTitle('');
                            setCustomItemPriceInput('');
                            setCustomItemQuantity(1);
                            setCustomItemNotes('');
                            toast.success(`"${newItem.title}" adicionado como item avulso!`);
                          }}
                          className="w-full py-2.5 rounded-xl text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-98 flex items-center justify-center gap-1.5"
                          style={{ backgroundColor: settings?.primaryColor || '#865d39' }}
                        >
                          <Plus size={15} /> Inserir Item Fora do Cardápio
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase opacity-60">Observações Gerais</label>
                  <textarea 
                    className="w-full p-3 rounded-xl border border-gray-300 text-black text-sm"
                    rows={3}
                    value={editOrderForm.observation || ''}
                    onChange={e => setEditOrderForm({...editOrderForm, observation: e.target.value})}
                  />
                </div>

                {/* Seção de Envio de Instruções de Pós-Venda via WhatsApp */}
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-amber-950">
                      Enviar Mensagem de Pós-Venda (WhatsApp)
                    </h4>
                    <span className="text-[11px] text-amber-800/80">
                      Inicia com "Olá {editOrderForm.customerName || 'Cliente'}! Aqui é da {settings?.brandName || 'Grão & Sabor'}."
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {(settings?.quickInstructions && settings.quickInstructions.length > 0 ? settings.quickInstructions : DEFAULT_QUICK_INSTRUCTIONS)
                      .filter(i => i.active !== false)
                      .map(inst => {
                        const fullMsg = formatInstructionWhatsAppMessage(inst.message, editOrderForm as any, settings);
                        const cleanPhone = getCleanWhatsAppPhone(editOrderForm.phone || '', settings?.whatsappCountryCode || '+55');
                        const waUrl = cleanPhone 
                          ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(fullMsg)}` 
                          : '#';

                        return (
                          <a
                            key={inst.id}
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => {
                              if (!cleanPhone) {
                                e.preventDefault();
                                toast.error('Telefone do cliente não informado ou inválido.');
                              }
                            }}
                            className="p-2.5 sm:p-3 rounded-xl border border-amber-300 bg-white hover:bg-amber-100 text-amber-950 font-bold text-xs text-center transition-all shadow-xs active:scale-98 cursor-pointer"
                          >
                            {inst.title || 'Instrução'}
                          </a>
                        );
                      })}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => {
                      if (editOrderForm) {
                        sendOrderToWhatsApp(editOrderForm as Order, settings);
                      }
                    }}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all active:scale-95 bg-[#4a2e18] hover:bg-[#3b2413]"
                    title="Enviar resumo atualizado do pedido ao cliente pelo WhatsApp"
                  >
                    <MessageCircle size={18} /> Reenviar no WhatsApp
                  </button>

                  <button 
                    type="submit"
                    className="flex-grow py-3.5 rounded-xl font-bold text-base shadow-lg transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                    style={{ 
                      backgroundColor: settings?.primaryColor || '#865d39',
                      color: getContrastText(settings?.primaryColor || '#865d39')
                    }}
                  >
                    <Save size={18} /> Salvar Alterações do Pedido
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isAddingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-6 md:p-8 rounded-3xl w-full max-w-3xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto text-black border border-gray-200"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-serif font-bold">Criar Pedido Manual</h3>
                <button onClick={() => setIsAddingOrder(false)} className="p-2 hover:bg-black/5 rounded-full">
                  <X size={24} />
                </button>
              </div>

              {/* Buscar Cliente Cadastrado (Opcional) */}
              <div className="space-y-2 relative">
                <label className="text-xs font-bold uppercase opacity-60">Buscar Cliente Cadastrado (Opcional)</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-450" size={18} />
                  <input 
                    type="text" 
                    className="pl-10 w-full p-3 rounded-xl border border-gray-300 bg-white text-black"
                    placeholder="Digite o nome, whatsapp ou e-mail do cliente..."
                    value={orderCustomerSearch}
                    onChange={e => setOrderCustomerSearch(e.target.value)}
                  />
                </div>
                {orderCustomerSearch.trim().length > 0 && (() => {
                  const filtered = combinedCustomers.filter(c => 
                    c.name.toLowerCase().includes(orderCustomerSearch.toLowerCase()) ||
                    c.phone.includes(orderCustomerSearch) ||
                    (c.email && c.email.toLowerCase().includes(orderCustomerSearch.toLowerCase()))
                  );
                  if (filtered.length === 0) return null;
                  return (
                    <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto mt-1 divide-y divide-gray-100">
                      {filtered.map((c, i) => (
                        <button
                          key={i}
                          type="button"
                          className="w-full text-left p-3 hover:bg-gray-50 flex flex-col cursor-pointer"
                          onClick={() => {
                            setManualOrderForm({
                              ...manualOrderForm,
                              customerName: c.name,
                              phone: c.phone || '',
                              email: c.email || '',
                              address: c.address || '',
                              street: c.street || '',
                              number: c.number || '',
                              zipCode: c.zipCode || '',
                              city: c.city || '',
                              birthday: c.birthday || ''
                            });
                            setOrderCustomerSearch('');
                          }}
                        >
                          <span className="font-bold text-sm text-black">{c.name}</span>
                          <span className="text-xs text-gray-500">{c.phone} {c.email ? `| ${c.email}` : ''}</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Form de Dados do Cliente e Pedido */}
              <form onSubmit={e => { e.preventDefault(); handleCreateManualOrder(); }} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">Nome do Cliente</label>
                    <input 
                      type="text" 
                      required
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-black"
                      value={manualOrderForm.customerName || ''}
                      onChange={e => setManualOrderForm({...manualOrderForm, customerName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">WhatsApp</label>
                    <input 
                      type="text" 
                      required
                      placeholder={COUNTRY_OPTIONS[settings?.whatsappCountryCode || '+55']?.placeholder || '(99) 99999-9999'}
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-black"
                      value={formatPhoneByCountry(manualOrderForm.phone || '', settings?.whatsappCountryCode || '+55')}
                      onChange={e => setManualOrderForm({...manualOrderForm, phone: formatPhoneByCountry(e.target.value, settings?.whatsappCountryCode || '+55')})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">E-mail</label>
                    <input 
                      type="email" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-black"
                      value={manualOrderForm.email || ''}
                      onChange={e => setManualOrderForm({...manualOrderForm, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">Aniversário (Dia/Mês)</label>
                    <input 
                      type="text" 
                      placeholder="DD/MM"
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-black"
                      value={manualOrderForm.birthday || ''}
                      onChange={e => {
                        let val = e.target.value.replace(/\D/g, '');
                        if (val.length > 4) val = val.slice(0, 4);
                        if (val.length > 2) {
                          val = val.slice(0, 2) + '/' + val.slice(2);
                        }
                        setManualOrderForm({...manualOrderForm, birthday: val});
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">Rua / Logradouro</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-black"
                      value={manualOrderForm.street || ''}
                      onChange={e => setManualOrderForm({...manualOrderForm, street: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">Número</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-black"
                      value={manualOrderForm.number || ''}
                      onChange={e => setManualOrderForm({...manualOrderForm, number: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">CEP</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-black font-mono"
                      value={manualOrderForm.zipCode || ''}
                      onChange={e => setManualOrderForm({...manualOrderForm, zipCode: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">Cidade / Estado</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-black"
                      value={manualOrderForm.city || ''}
                      onChange={e => setManualOrderForm({...manualOrderForm, city: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase opacity-60">Endereço Completo</label>
                  <input 
                    type="text" 
                    className="w-full p-3 rounded-xl border border-gray-300 bg-white text-black opacity-80"
                    value={manualOrderForm.address || ''}
                    onChange={e => setManualOrderForm({...manualOrderForm, address: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase opacity-60 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={14} className="text-amber-800" /> Data de Retirada / Entrega
                    </span>
                    {manualOrderForm.pickupDate && (
                      <span className="text-[11px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                        {manualOrderForm.pickupDate}
                      </span>
                    )}
                  </label>
                  <div className="space-y-1.5">
                    <input 
                      type="date" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white font-bold text-gray-900 cursor-pointer shadow-xs outline-none focus:ring-2 focus:ring-amber-500/20"
                      style={{ colorScheme: 'light' }}
                      value={(() => {
                        const val = manualOrderForm.pickupDate || '';
                        if (val.includes('/')) {
                          const [d, m, y] = val.split('/');
                          if (d && m && y && y.length === 4) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                        }
                        return val;
                      })()}
                      onChange={e => {
                        const dateVal = e.target.value;
                        if (dateVal.includes('-')) {
                          const [y, m, d] = dateVal.split('-');
                          setManualOrderForm({...manualOrderForm, pickupDate: `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`});
                        } else {
                          setManualOrderForm({...manualOrderForm, pickupDate: dateVal});
                        }
                      }}
                      onClick={e => {
                        try {
                          (e.target as any).showPicker?.();
                        } catch (_) {}
                      }}
                    />
                  </div>
                </div>

                {/* Seção Adicionar Itens */}
                <div className="space-y-4 p-4 rounded-2xl bg-white/40 border border-gray-200">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-gray-800">Adicionar Itens ao Pedido</h4>
                  
                  <div className="space-y-3">
                    <label className="text-xs font-bold uppercase opacity-60">Selecione o Produto</label>
                    <select
                      value={selectedManualProduct ? selectedManualProduct.id : ''}
                      onChange={e => {
                        const prod = products.find(p => p.id === e.target.value);
                        setSelectedManualProduct(prod || null);
                        setSelectedManualSize(null);
                        setSelectedManualMealRemovals([]);
                        setSelectedManualMealSides([]);
                        setSelectedManualCakeOptions({
                          size: '',
                          dough: '',
                          fillings: [],
                          topping: '',
                          topper: '',
                          styleNumber: 1
                        });
                      }}
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-black"
                    >
                      <option value="">-- Selecione um produto --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>

                  {selectedManualProduct && (
                    <div className="space-y-4 p-4 rounded-xl bg-white border border-gray-200/60 shadow-sm">
                      <p className="font-bold text-sm text-gray-800">{selectedManualProduct.title}</p>

                      {/* Variantes/Tamanhos */}
                      {selectedManualProduct.hasSizes && selectedManualProduct.sizes && selectedManualProduct.sizes.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase opacity-60">Escolha o Tamanho</label>
                          <select
                            value={selectedManualSize ? selectedManualSize.name : ''}
                            onChange={e => {
                              const sz = selectedManualProduct.sizes?.find(s => s.name === e.target.value);
                              setSelectedManualSize(sz || null);
                            }}
                            className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-black text-sm"
                          >
                            <option value="">-- Escolha um tamanho --</option>
                            {selectedManualProduct.sizes.map((s, idx) => (
                              <option key={idx} value={s.name}>
                                {s.name} - {currencySymbol} {s.price.toFixed(2)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Marmita/Prato */}
                      {selectedManualProduct.isMeal && (
                        <div className="space-y-3">
                          {selectedManualProduct.ingredients && (
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase opacity-60">Remover Ingredientes (Se desejar)</label>
                              <div className="flex flex-wrap gap-2">
                                {selectedManualProduct.ingredients.split(',').map(i => i.trim()).filter(Boolean).map((ing, idx) => {
                                  const isRemoved = selectedManualMealRemovals.includes(ing);
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => {
                                        if (isRemoved) {
                                          setSelectedManualMealRemovals(selectedManualMealRemovals.filter(r => r !== ing));
                                        } else {
                                          setSelectedManualMealRemovals([...selectedManualMealRemovals, ing]);
                                        }
                                      }}
                                      className={cn(
                                        "px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer",
                                        isRemoved 
                                          ? "bg-red-50 border-red-200 text-red-600 line-through" 
                                          : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                                      )}
                                    >
                                      Sem {ing}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {sides.length > 0 && (
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase opacity-60">Adicionar Acompanhamentos</label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {sides.map((sideOpt, idx) => {
                                  const isSelected = selectedManualMealSides.some(s => s.name === sideOpt.name);
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => {
                                        if (isSelected) {
                                          setSelectedManualMealSides(selectedManualMealSides.filter(s => s.name !== sideOpt.name));
                                        } else {
                                          setSelectedManualMealSides([...selectedManualMealSides, sideOpt]);
                                        }
                                      }}
                                      className={cn(
                                        "p-2.5 rounded-xl border transition-all flex items-center justify-between text-left text-xs font-bold cursor-pointer",
                                        isSelected 
                                          ? "border-[#865d39] bg-[#865d39]/10 text-[#865d39]" 
                                          : "bg-white border-gray-200 hover:border-gray-300 text-gray-750"
                                      )}
                                    >
                                      <span>{sideOpt.name}</span>
                                      <span className="opacity-70 font-mono">+{currencySymbol} {sideOpt.price.toFixed(2)}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Custom Cake */}
                      {selectedManualProduct.isCustomCake && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Cake Size */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase opacity-60">Tamanho do Bolo</label>
                              <select
                                value={selectedManualCakeOptions.size || ''}
                                onChange={e => setSelectedManualCakeOptions({...selectedManualCakeOptions, size: e.target.value})}
                                className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-black text-xs"
                              >
                                <option value="">-- Escolha o tamanho --</option>
                                {(settings.cakeSizes || []).map((sz, idx) => (
                                  <option key={idx} value={sz}>{sz}</option>
                                ))}
                              </select>
                            </div>

                            {/* Cake Dough */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase opacity-60">Massa do Bolo</label>
                              <select
                                value={selectedManualCakeOptions.dough || ''}
                                onChange={e => setSelectedManualCakeOptions({...selectedManualCakeOptions, dough: e.target.value})}
                                className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-black text-xs"
                              >
                                <option value="">-- Escolha a massa --</option>
                                {(settings.cakeDoughs || []).map((dg, idx) => (
                                  <option key={idx} value={dg}>{dg}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Cake Fillings */}
                          {(settings.cakeFillings || []).length > 0 && (
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center text-[10px] font-bold uppercase opacity-60">
                                <span>Opções de Recheio</span>
                                <span className="opacity-60">Escolha até {settings.cakeFillingsMax || 2}</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {(settings.cakeFillings || []).map((fill, idx) => {
                                  const isSelected = (selectedManualCakeOptions.fillings || []).includes(fill);
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => {
                                        const current = selectedManualCakeOptions.fillings || [];
                                        if (isSelected) {
                                          setSelectedManualCakeOptions({
                                            ...selectedManualCakeOptions,
                                            fillings: current.filter((f: string) => f !== fill)
                                          });
                                        } else {
                                          const max = settings.cakeFillingsMax || 2;
                                          if (current.length >= max) {
                                            toast.error(`Você pode escolher no máximo ${max} recheios!`);
                                            return;
                                          }
                                          setSelectedManualCakeOptions({
                                            ...selectedManualCakeOptions,
                                            fillings: [...current, fill]
                                          });
                                        }
                                      }}
                                      className={cn(
                                        "p-2 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer",
                                        isSelected 
                                          ? "border-[#865d39] bg-[#865d39]/10 text-[#865d39]" 
                                          : "bg-white border-gray-200 hover:border-gray-300 text-gray-750"
                                      )}
                                    >
                                      {fill}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Cake Topping */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase opacity-60">Cobertura do Bolo</label>
                              <select
                                value={selectedManualCakeOptions.topping || ''}
                                onChange={e => setSelectedManualCakeOptions({...selectedManualCakeOptions, topping: e.target.value})}
                                className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-black text-xs"
                              >
                                <option value="">-- Escolha a cobertura --</option>
                                {(settings.cakeToppings || []).map((tp, idx) => (
                                  <option key={idx} value={tp}>{tp}</option>
                                ))}
                              </select>
                            </div>

                            {/* Cake Topper */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase opacity-60">Texto do Topper (Opcional)</label>
                              <input
                                type="text"
                                placeholder="Ex: Feliz Aniversário!"
                                className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-black text-xs"
                                value={selectedManualCakeOptions.topper || ''}
                                onChange={e => setSelectedManualCakeOptions({...selectedManualCakeOptions, topper: e.target.value})}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Quantidade e Adicionar */}
                      <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden bg-white">
                          <button
                            type="button"
                            onClick={() => setManualProductQty(Math.max(1, manualProductQty - 1))}
                            className="px-3 py-2 hover:bg-gray-150 font-bold border-r border-gray-250 text-black text-sm cursor-pointer"
                          >
                            -
                          </button>
                          <span className="px-4 py-2 font-bold text-sm min-w-[32px] text-center text-black">{manualProductQty}</span>
                          <button
                            type="button"
                            onClick={() => setManualProductQty(manualProductQty + 1)}
                            className="px-3 py-2 hover:bg-gray-150 font-bold border-l border-gray-250 text-black text-sm cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                        
                        <button
                          type="button"
                          onClick={handleAddManualItem}
                          className="flex-grow py-3 text-white font-bold rounded-xl text-sm transition-all uppercase tracking-wider shadow-md cursor-pointer active:scale-98"
                          style={{ backgroundColor: settings?.primaryColor || '#865d39' }}
                        >
                          Adicionar Item ao Pedido
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Lista de Itens no Pedido Manual */}
                  {manualOrderItems.length > 0 ? (
                    <div className="space-y-2 mt-4">
                      <p className="text-xs font-bold uppercase opacity-60 text-gray-700">Itens Adicionados ({manualOrderItems.length})</p>
                      <div className="space-y-2 max-h-[25vh] overflow-y-auto pr-1">
                        {manualOrderItems.map((item, idx) => (
                          <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl shadow-sm gap-3">
                            <div>
                              <p className="font-bold text-sm text-black">{item.title}</p>
                              <p className="text-xs text-gray-500 font-semibold">
                                {item.quantity}x {currencySymbol} {item.price.toFixed(2)} | Subtotal: {currencySymbol} {(item.price * item.quantity).toFixed(2)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setManualOrderItems(manualOrderItems.filter(it => it.id !== item.id));
                              }}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                              title="Remover Item"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                        <span className="font-bold text-sm text-gray-700">Total do Pedido:</span>
                        <span className="font-black text-lg text-amber-900" style={{ color: settings?.primaryColor || '#865d39' }}>
                          {currencySymbol} {manualOrderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-400 text-xs italic bg-white/50 border border-dashed border-gray-200 rounded-xl">
                      Nenhum item adicionado a este pedido ainda.
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase opacity-60">Observações Gerais</label>
                  <textarea 
                    className="w-full p-3 rounded-xl border border-gray-300 bg-white text-black"
                    rows={3}
                    placeholder="Ex: Cliente vai retirar às 14h, embalar para presente..."
                    value={manualOrderForm.observation || ''}
                    onChange={e => setManualOrderForm({...manualOrderForm, observation: e.target.value})}
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2"
                  style={{ 
                    backgroundColor: settings?.primaryColor || '#865d39',
                    color: getContrastText(settings?.primaryColor || '#865d39')
                  }}
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : 'Confirmar e Criar Pedido'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {viewingCustomerOrders && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-6 md:p-8 rounded-3xl w-full max-w-3xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto border border-gray-200 text-black"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-xs uppercase font-extrabold tracking-widest bg-[#865d39]/10 text-[#865d39] px-2.5 py-1 rounded-full border border-[#865d39]/10">
                    Histórico do Cliente
                  </span>
                  <h3 className="text-2xl font-serif font-bold text-black">{viewingCustomerOrders.name}</h3>
                  <p className="text-sm opacity-60">
                    {viewingCustomerOrders.phone} | {viewingCustomerOrders.email || 'Sem e-mail'}
                  </p>
                </div>
                <button 
                  onClick={() => setViewingCustomerOrders(null)} 
                  className="p-2 hover:bg-black/5 rounded-full cursor-pointer"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-sm uppercase tracking-wider opacity-50">
                  Pedidos Realizados ({viewingCustomerOrders.orders.length})
                </h4>
                
                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                  {viewingCustomerOrders.orders.map((order: Order, index: number) => (
                    <div 
                      key={order.id} 
                      className="p-5 bg-white/50 border border-black/5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/70 transition-all"
                    >
                      <div className="space-y-2 flex-grow">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 bg-black/5 rounded text-gray-700">
                            #{order.id.slice(-6).toUpperCase()}
                          </span>
                          <span className="text-xs opacity-60 font-medium">
                            {(() => {
                              const c = order.createdAt;
                              let d: Date | null = null;
                              if (typeof c?.toDate === 'function') d = c.toDate();
                              else if (c instanceof Date) d = c;
                              else if (typeof c === 'string' || typeof c === 'number') d = new Date(c);
                              else if (c?.seconds) d = new Date(c.seconds * 1000);
                              if (!d || isNaN(d.getTime())) return 'N/A';
                              return d.toLocaleString('pt-BR');
                            })()}
                          </span>
                          {order.pickupDate && (
                            <span 
                              className="text-[10px] font-black px-2 py-0.5 rounded-md text-white whitespace-nowrap"
                              style={{ backgroundColor: settings?.primaryColor || '#865d39' }}
                            >
                               Entrega: {order.pickupDate}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 text-sm">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between font-medium">
                              <span>{item.quantity}x {item.title}</span>
                              <span className="opacity-60">{currencySymbol} {((item.price || 0) * item.quantity).toFixed(2).replace('.', ',')}</span>
                            </div>
                          ))}
                          
                          {(order.taxAmount && order.taxAmount > 0 && order.total > 0) ? (
                            <div className="border-t border-black/5 pt-2 space-y-1 text-xs text-black/60 font-semibold">
                              <div className="flex justify-between">
                                <span className="opacity-60">Subtotal:</span>
                                <span>{currencySymbol} {(order.subtotal || (order.total - order.taxAmount)).toFixed(2).replace('.', ',')}</span>
                              </div>
                              <div className="flex justify-between text-amber-900">
                                <span className="opacity-60">Sales Tax ({order.taxRate || 8.25}%):</span>
                                <span>+ {currencySymbol} {order.taxAmount.toFixed(2).replace('.', ',')}</span>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        {order.observation && (
                          <p className="text-xs italic bg-amber-500/10 text-amber-800 p-2.5 rounded-xl border border-amber-500/20">
                            <strong>Obs:</strong> {order.observation}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-row md:flex-col items-end justify-between md:justify-center gap-3 border-t md:border-t-0 border-black/5 pt-3 md:pt-0">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold opacity-40 block">Valor Pago</span>
                          <span className="text-lg font-black" style={{ color: settings?.primaryColor || '#865d39' }}>
                            {currencySymbol} {order.total.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => printOrder(order)}
                            className="p-2 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 shadow-sm cursor-pointer"
                            title="Imprimir"
                          >
                            <Printer size={16} />
                          </button>
                          <button 
                            onClick={() => {
                              setIsEditingOrder(order);
                              setEditOrderForm({ ...order, phone: formatPhoneByCountry(order.phone || '', settings?.whatsappCountryCode || '+55') });
                              setViewingCustomerOrders(null);
                            }}
                            className="p-2 bg-white border border-amber-200 rounded-xl text-amber-900 hover:bg-amber-50 shadow-sm cursor-pointer"
                            title="Editar Pedido"
                          >
                            <Edit2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass p-8 rounded-3xl w-full max-w-sm shadow-2xl text-center space-y-6"
            >
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-serif font-bold">{confirmModal.title}</h3>
                <p className="text-sm opacity-60">{confirmModal.message}</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-3 rounded-xl bg-gray-100 font-bold text-black cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold shadow-lg"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
