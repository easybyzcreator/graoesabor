import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, serverTimestamp, doc, query, orderBy } from 'firebase/firestore';
import { Product, Order, Settings, Category, CartItem, Side, ProductSize, ImageGallery } from '../types';
import { Plus, Minus, ShoppingBag, X, MessageCircle, MessageSquare, Check, Calendar, Building2, User, Phone, MapPin, RefreshCw, ChevronDown, Truck, Navigation, Loader2, Lock, ArrowLeft, Info, ArrowRight, Layers, Search, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { COUNTRY_OPTIONS, formatPhoneByCountry, getCleanWhatsAppPhone, getCurrencySymbol } from '../utils/countryUtils';
import { geocodeAddress, calculateDistanceKm, calculateDeliveryFee, fetchViaCep, DeliveryCalculation } from '../utils/deliveryUtils';
import { AnimatedProductCard } from './AnimatedProductCard';
import { PWAInstallButton } from './PWAInstallButton';

const translations = {
  pt: {
    cartTitle: 'Seu Carrinho',
    emptyCart: 'Seu carrinho está vazio',
    total: 'Total',
    next: 'Próximo: Seus Dados',
    back: 'Voltar',
    finish: 'Finalizar Pedido',
    fullName: 'Nome Completo',
    phone: 'Telefone',
    email: 'E-mail',
    birthday: 'Aniversário (Dia/Mês)',
    birthdayPlaceholder: 'DD/MM',
    street: 'Rua/Avenida',
    number: 'Nº/Apto',
    zipCode: 'CEP',
    city: 'Cidade',
    state: 'Estado',
    observation: 'Observação',
    orderDetails: 'Detalhes do seu Pedido',
    customCakeTitle: 'Opções de Personalização',
    chooseModel: 'Escolha o Modelo',
    chooseSize: 'Escolha o Tamanho',
    chooseDough: 'Escolha a Massa',
    chooseFillings: 'Escolha os Recheios',
    chooseFrosting: 'Escolha a Cobertura',
    chooseSides: 'Escolha os Acompanhamentos',
    excludeIngredients: 'Excluir Ingredientes',
    limitReached: 'Limite atingido',
    addToCart: 'Adicionar ao Carrinho',
    whatsappOrder: 'Pedido',
    whatsappData: 'Dados do Cliente',
    whatsappItems: 'Itens do Pedido',
    whatsappTotal: 'Total do Pedido',
    whatsappDate: 'Data',
    whatsappAt: 'às',
    pickupDate: 'Data de Entrega/Retirada',
    pickupDatePlaceholder: 'DD/MM/AAAA',
    consultMessage: 'Existem itens no pedido com valores a consultar. Aguarde a confirmação pelo WhatsApp.'
  },
  en: {
    cartTitle: 'Your Cart',
    emptyCart: 'Your cart is empty',
    total: 'Total',
    next: 'Next: Your Details',
    back: 'Back',
    finish: 'Finish Order',
    fullName: 'Full Name',
    phone: 'Phone',
    email: 'E-mail',
    birthday: 'Birthday (Day/Month)',
    birthdayPlaceholder: 'DD/MM',
    street: 'Street/Avenue',
    number: 'No./Apt',
    zipCode: 'Zip Code',
    city: 'City',
    state: 'State',
    observation: 'Observation',
    orderDetails: 'Order Details',
    customCakeTitle: 'Customize your Order',
    chooseModel: 'Choose Model',
    chooseSize: 'Choose Size',
    chooseDough: 'Choose Dough',
    chooseFillings: 'Choose Fillings',
    chooseFrosting: 'Choose Frosting',
    chooseSides: 'Choose Sides',
    excludeIngredients: 'Exclude Ingredients',
    limitReached: 'Limit reached',
    addToCart: 'Add to Cart',
    whatsappOrder: 'Order',
    whatsappData: 'Customer Data',
    whatsappItems: 'Order Items',
    whatsappTotal: 'Order Total',
    whatsappDate: 'Date',
    whatsappAt: 'at',
    pickupDate: 'Pickup/Delivery Date',
    pickupDatePlaceholder: 'MM/DD/YYYY',
    consultMessage: 'There are items with values to be consulted. Please wait for confirmation via WhatsApp.'
  }
};

export const getContrastText = (hexColor?: string): string => {
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

export const getColorWithLegibility = (hexColor?: string, defaultColor: string = '#865d39'): string => {
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

const translateSettingsToEnglish = (s: Settings): Settings => {
  return {
    ...s,
    language: 'en',
    currency: 'USD',
    brandName: s.brandName || 'Escola de gastronomia e negócios',
    slogan: !s.slogan || s.slogan.includes('Alimentação saudável') || s.slogan.includes('Cursos completos')
      ? 'Complete gastronomy, confectionery, baking, and culinary business courses.'
      : s.slogan,
    introTitle: s.introTitle || 'Escola de gastronomia e negócios',
    introSubtitle: !s.introSubtitle || s.introSubtitle.includes('Alimentação Saudável') || s.introSubtitle.includes('Aprenda Gastronomia')
      ? 'Learn Authentic Gastronomy and Management'
      : s.introSubtitle,
    introDescription: !s.introDescription || s.introDescription.includes('Pratos nutritivos') || s.introDescription.includes('Acesse nossos')
      ? 'Access our professional trainings, signature recipes, consulting, and culinary business mentorship.'
      : s.introDescription,
    introButtonText: !s.introButtonText || s.introButtonText.includes('INICIAR') || s.introButtonText.includes('ACESSAR')
      ? 'ACCESS OUR MENU / COURSES'
      : s.introButtonText,
    introBottomText: !s.introBottomText || s.introBottomText.includes('ARTESANAL') || s.introBottomText.includes('CURSOS DE')
      ? 'GASTRONOMY & BUSINESS COURSES'
      : s.introBottomText,
    selectorTitle: s.selectorTitle || 'Escola de gastronomia e negócios',
    selectorSubtitle: !s.selectorSubtitle || s.selectorSubtitle.includes('Escolha')
      ? 'Choose your experience'
      : s.selectorSubtitle,
    catalog1Title: !s.catalog1Title || s.catalog1Title.includes('Cardápio') || s.catalog1Title.includes('Acarajé')
      ? 'Main Menu'
      : s.catalog1Title,
    catalog1Desc: !s.catalog1Desc || s.catalog1Desc.includes('Nossos pratos')
      ? 'Our fitness dishes and traditional healthy meals.'
      : s.catalog1Desc,
    catalog1Slogan: !s.catalog1Slogan || s.catalog1Slogan.includes('Refeições')
      ? 'Balanced meals made with love'
      : s.catalog1Slogan,
    catalog2Title: !s.catalog2Title || s.catalog2Title.includes('Bebidas')
      ? 'Drinks & Fit Sweets'
      : s.catalog2Title,
    catalog2Desc: !s.catalog2Desc || s.catalog2Desc.includes('Sucos')
      ? 'Natural juices, smoothies and sugar-free desserts.'
      : s.catalog2Desc,
    catalog2Slogan: !s.catalog2Slogan || s.catalog2Slogan.includes('Refrescância')
      ? 'Healthy freshness and sweetness for your day'
      : s.catalog2Slogan,
    catalog3Title: !s.catalog3Title || s.catalog3Title.includes('Low Carb') || s.catalog3Title.includes('Dietas')
      ? 'Low Carb Diets'
      : s.catalog3Title,
    catalog3Desc: !s.catalog3Desc || s.catalog3Desc.includes('Pratos com baixo')
      ? 'Low-carb, high-protein dishes.'
      : s.catalog3Desc,
    catalog3Slogan: !s.catalog3Slogan || s.catalog3Slogan.includes('Mais foco')
      ? 'More focus on your health and energy'
      : s.catalog3Slogan,
    catalog4Title: !s.catalog4Title || s.catalog4Title.includes('Hipertróficas') || s.catalog4Title.includes('Dietas')
      ? 'Hypertrophy Diets'
      : s.catalog4Title,
    catalog4Desc: !s.catalog4Desc || s.catalog4Desc.includes('Refeições com alto')
      ? 'Healthy high-calorie, protein-rich meals for muscle gain.'
      : s.catalog4Desc,
    catalog4Slogan: !s.catalog4Slogan || s.catalog4Slogan.includes('Combustível')
      ? 'High quality fuel for your workout'
      : s.catalog4Slogan,
    checkoutTitle: !s.checkoutTitle || s.checkoutTitle.includes('Ficamos')
      ? 'We are very happy with your order! Please review the details below.'
      : s.checkoutTitle,
    infoBlock1Title: !s.infoBlock1Title || s.infoBlock1Title.includes('CONFIRMAÇÃO')
      ? 'ORDER CONFIRMATION'
      : s.infoBlock1Title,
    infoBlock1Text: !s.infoBlock1Text || s.infoBlock1Text.includes('WhatsApp')
      ? 'After sending your request, we will contact you on WhatsApp to confirm details.'
      : s.infoBlock1Text,
    infoBlock2Title: !s.infoBlock2Title || s.infoBlock2Title.includes('RETIRADA')
      ? 'STORE PICKUP'
      : s.infoBlock2Title,
    infoBlock2Text: !s.infoBlock2Text || s.infoBlock2Text.includes('endereço') || s.infoBlock2Text.includes('retirada')
      ? 'Check our pickup hours and address details on the final confirmation.'
      : s.infoBlock2Text,
    whatsappClosingMessage: !s.whatsappClosingMessage || s.whatsappClosingMessage.includes('Obrigada')
      ? 'Thank you for your order, we will contact you shortly for confirmation!'
      : s.whatsappClosingMessage
  };
};

const cleanFirestoreObject = <T extends Record<string, any>>(obj: T): T => {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
};

export const hasNutritionalData = (prod?: Product | null): boolean => {
  if (!prod || !prod.nutritionalInfo) return false;
  return Object.values(prod.nutritionalInfo).some(
    (val) => typeof val === 'string' && val.trim().length > 0
  );
};


export default function Menu({ 
  settings: initialSettings,
  onScreenChange,
  onCatalogChange
}: { 
  settings: Settings;
  onScreenChange?: (screen: 'intro' | 'selector' | 'menu') => void;
  onCatalogChange?: (catalog: string | null) => void;
}) {
  const settings = {
    ...initialSettings,
    language: (initialSettings?.language || 'pt') as 'pt' | 'en' | 'es',
    currency: initialSettings?.currency || 'BRL'
  };
  const t = translations['pt'];
  const currencySymbol = getCurrencySymbol(settings.currency);

  const renderTitle = (title: string) => {
    if (title && title.toLowerCase() === 'escola de gastronomia e negócios') {
      return (
        <>
          Escola de gastronomia<br />e negócios
        </>
      );
    }
    return title;
  };

  const DEFAULT_CAKE_SIZES = [
    '7" - 15 a 20 Fatias (Aprox. 1.5kg)',
    '9" - 25 a 30 Fatias (Aprox. 2.5kg)',
    '12" - 40 a 50 Fatias (Aprox. 4.0kg)'
  ];

  const DEFAULT_CAKE_DOUGHS = [
    'Massa de Baunilha',
    'Massa de Chocolate 50% Cacau',
    'Massa Red Velvet'
  ];

  const DEFAULT_CAKE_FILLINGS = [
    'Brigadeiro Gourmet (Chocolate Belga)',
    'Beijinho de Coco (Tradicional)',
    'Doce de Leite Tradicional',
    'Creme de Ninho com Frutas Vermelhas'
  ];

  const DEFAULT_CAKE_TOPPINGS = [
    'Chantininho Cremoso (Ninho)',
    'Ganache de Chocolate Belga',
    'Buttercream Clássico'
  ];

  const DEFAULT_CAKE_TOPPERS = [
    'Nenhum',
    'Feliz Aniversário',
    'Parabéns'
  ];

  const cakeSizesList = (settings.cakeSizes && settings.cakeSizes.length > 0) ? settings.cakeSizes : DEFAULT_CAKE_SIZES;
  const cakeDoughsList = (settings.cakeDoughs && settings.cakeDoughs.length > 0) ? settings.cakeDoughs : DEFAULT_CAKE_DOUGHS;
  const cakeFillingsList = (settings.cakeFillings && settings.cakeFillings.length > 0) ? settings.cakeFillings : DEFAULT_CAKE_FILLINGS;
  const cakeToppingsList = (settings.cakeToppings && settings.cakeToppings.length > 0) ? settings.cakeToppings : DEFAULT_CAKE_TOPPINGS;
  const cakeToppersList = (settings.cakeToppers && settings.cakeToppers.length > 0) ? settings.cakeToppers : DEFAULT_CAKE_TOPPERS;

  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const cached = localStorage.getItem('grao_sabor_cached_products');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const cached = localStorage.getItem('grao_sabor_cached_categories');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      const cached = localStorage.getItem('grao_sabor_cached_products');
      return !cached;
    } catch {
      return true;
    }
  });
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('grao_sabor_cart_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [sides, setSides] = useState<Side[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [selectedProductForCustom, setSelectedProductForCustom] = useState<Product | null>(null);
  const [isDietsModalOpen, setIsDietsModalOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState<ProductSize | null>(null);
  const [mealSelections, setMealSelections] = useState<{
    removals: string[];
    sides: Side[];
  }>({
    removals: [],
    sides: []
  });
  const [sideQuantities, setSideQuantities] = useState<Record<string, number>>({});
  const [selectedCakeSize, setSelectedCakeSize] = useState<string>('');
  const [selectedDough, setSelectedDough] = useState<string>('');
  const [selectedFillings, setSelectedFillings] = useState<string[]>([]);
  const [selectedSandwichFillings, setSelectedSandwichFillings] = useState<string[]>([]);
  const [selectedTopping, setSelectedTopping] = useState<string>('');
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]); // dummy if needed, but not used now
  const [selectedTopper, setSelectedTopper] = useState<string>('');
  const [b2bName, setB2bName] = useState(() => {
    try {
      const saved = localStorage.getItem('b2b_profile_save');
      return saved ? JSON.parse(saved).name || '' : '';
    } catch {
      return '';
    }
  });
  const [b2bResponsibleName, setB2bResponsibleName] = useState(() => {
    try {
      const saved = localStorage.getItem('b2b_profile_save');
      return saved ? JSON.parse(saved).manager || '' : '';
    } catch {
      return '';
    }
  });
  const [b2bPhone, setB2bPhone] = useState(() => {
    try {
      const saved = localStorage.getItem('b2b_profile_save');
      return saved ? JSON.parse(saved).phone || '' : '';
    } catch {
      return '';
    }
  });
  const [b2bAddress, setB2bAddress] = useState(() => {
    try {
      const saved = localStorage.getItem('b2b_profile_save');
      return saved ? JSON.parse(saved).address || '' : '';
    } catch {
      return '';
    }
  });
  const [b2bZipCode, setB2bZipCode] = useState(() => {
    try {
      const saved = localStorage.getItem('b2b_profile_save');
      return saved ? JSON.parse(saved).zipCode || '' : '';
    } catch {
      return '';
    }
  });
  const [b2bCity, setB2bCity] = useState(() => {
    try {
      const saved = localStorage.getItem('b2b_profile_save');
      return saved ? JSON.parse(saved).city || '' : '';
    } catch {
      return '';
    }
  });
  const [b2bFrequency, setB2bFrequency] = useState<'one-time' | 'weekly'>('one-time');
  const [isReturningB2b, setIsReturningB2b] = useState(() => {
    try {
      return localStorage.getItem('b2b_profile_save') ? true : false;
    } catch {
      return false;
    }
  });
  const [b2bSearchResults, setB2bSearchResults] = useState<any[]>([]);
  const [showB2bSearchDropdown, setShowB2bSearchDropdown] = useState(false);
  const [b2bProfiles, setB2bProfiles] = useState<any[]>([]);
  const [pqCoquetel, setPqCoquetel] = useState(0);
  const [pqMedio, setPqMedio] = useState(0);
  const [pqPremium, setPqPremium] = useState(0);
  const [b2bDate, setB2bDate] = useState('');
  const [b2bObservation, setB2bObservation] = useState('');
  const [checkoutStep, setCheckoutStep] = useState<'summary' | 'form' | 'channels' | 'b2b_channels'>('summary');
  const [hasRedirected, setHasRedirected] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProductForDetails, setSelectedProductForDetails] = useState<Product | null>(null);
  const [b2bSuccessUrls, setB2bSuccessUrls] = useState<{ whatsapp: string } | null>(null);
  const [standardSuccessUrls, setStandardSuccessUrls] = useState<{ whatsapp: string } | null>(null);
  const [galleries, setGalleries] = useState<ImageGallery[]>([]);
  const [selectedStyleNumber, setSelectedStyleNumber] = useState<number | null>(null);
  const [customItemQuantity, setCustomItemQuantity] = useState<number>(1);
  const [sandwichFillingQuantities, setSandwichFillingQuantities] = useState<Record<string, number>>({});
  const [showNutritional, setShowNutritional] = useState(false);

  // Estados e Handlers Módulo Marmitas & Combos (Imagens 12 a 15)
  const [comboModalProduct, setComboModalProduct] = useState<Product | null>(null);
  const [comboSelections, setComboSelections] = useState<Record<string, number>>({});
  const [comboSearchQuery, setComboSearchQuery] = useState('');
  const [nutritionalModalProduct, setNutritionalModalProduct] = useState<Product | null>(null);
  const [comboDetailDish, setComboDetailDish] = useState<Product | null>(null);

  const handleOpenCombo = (product: Product) => {
    setComboModalProduct(product);
    setComboSelections({});
    setComboSearchQuery('');
  };

  const handleOpenNutritional = (product: Product) => {
    setNutritionalModalProduct(product);
  };

  const handleIncrementComboDish = (dishId: string) => {
    if (!comboModalProduct) return;
    const limit = comboModalProduct.comboLimit || 5;
    const currentTotal = Object.values(comboSelections).reduce((a, b) => a + b, 0);
    if (currentTotal >= limit) {
      toast.info(`Você já selecionou as ${limit} marmitas permitidas neste combo.`);
      return;
    }
    setComboSelections(prev => ({
      ...prev,
      [dishId]: (prev[dishId] || 0) + 1
    }));
  };

  const handleDecrementComboDish = (dishId: string) => {
    setComboSelections(prev => {
      const current = prev[dishId] || 0;
      if (current <= 1) {
        const next = { ...prev };
        delete next[dishId];
        return next;
      }
      return { ...prev, [dishId]: current - 1 };
    });
  };

  const handleAddComboToCart = () => {
    if (!comboModalProduct) return;
    const limit = comboModalProduct.comboLimit || 5;
    const currentTotal = Object.values(comboSelections).reduce((a, b) => a + b, 0);
    if (currentTotal !== limit) {
      toast.error(`Por favor, complete a seleção de ${limit} marmitas para poder adicionar à sacola.`);
      return;
    }

    const selectionsArray = Object.entries(comboSelections)
      .filter(([_, count]) => count > 0)
      .map(([dishId, count]) => {
        const dish = products.find(p => p.id === dishId);
        return {
          dishId,
          dishTitle: dish ? dish.title : 'Marmita',
          quantity: count,
          count
        };
      });

    const newCartItem: CartItem = {
      id: Math.random().toString(36).substr(2, 9),
      productId: comboModalProduct.id,
      quantity: 1,
      comboSelections: selectionsArray
    };

    setCart(prev => [...prev, newCartItem]);
    setComboModalProduct(null);
    setComboSelections({});
    toast.success(` ${comboModalProduct.title} adicionado à sacola!`);
  };

  useEffect(() => {
    if (isCustomModalOpen || selectedProductForDetails) {
      const activeProd = selectedProductForDetails || selectedProductForCustom;
      const minQ = activeProd?.minQuantity && activeProd.minQuantity > 1 ? activeProd.minQuantity : 1;
      setCustomItemQuantity(minQ);
      setSandwichFillingQuantities({});
      setShowNutritional(false);
    }
  }, [isCustomModalOpen, selectedProductForDetails, selectedProductForCustom]);

  // Persistência contínua do Carrinho (não perde itens ao receber chamada, fechar ou atualizar)
  useEffect(() => {
    try {
      localStorage.setItem('grao_sabor_cart_v1', JSON.stringify(cart));
    } catch (err) {
      console.warn('Erro ao salvar carrinho no localStorage:', err);
    }
  }, [cart]);

  // Preenchimento automático do Cliente (recupera dados salvos do checkout anterior)
  const [formData, setFormData] = useState(() => {
    try {
      const saved = localStorage.getItem('grao_sabor_customer_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          nome: parsed.nome || '',
          telefone: parsed.telefone || '',
          endereco: parsed.endereco || '',
          street: parsed.street || '',
          number: parsed.number || '',
          bairro: parsed.bairro || '',
          zipCode: parsed.zipCode || '',
          city: parsed.city || '',
          state: parsed.state || '',
          aniversario: parsed.aniversario || '',
          observacao: parsed.observacao || '',
          email: parsed.email || ''
        };
      }
    } catch {
      // fallback
    }
    return {
      nome: '',
      telefone: '',
      endereco: '',
      street: '',
      number: '',
      bairro: '',
      zipCode: '',
      city: '',
      state: '',
      aniversario: '',
      observacao: '',
      email: ''
    };
  });

  // Salvar perfil do cliente sempre que ele preencher ou alterar os dados
  useEffect(() => {
    try {
      if (formData.nome || formData.telefone || formData.street) {
        localStorage.setItem('grao_sabor_customer_profile', JSON.stringify(formData));
      }
    } catch (err) {
      console.warn('Erro ao salvar perfil do cliente:', err);
    }
  }, [formData]);

  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryCalculation, setDeliveryCalculation] = useState<DeliveryCalculation | null>(null);
  const [selectedDeliveryCityId, setSelectedDeliveryCityId] = useState<string>('');
  const [isCalculatingDelivery, setIsCalculatingDelivery] = useState(false);
  const [isSearchingCep, setIsSearchingCep] = useState(false);

  const handleCalculateDelivery = async (customFormData = formData) => {
    if (!settings.deliveryEnabled) return;
    
    let originLat = settings.deliveryOriginLat;
    let originLng = settings.deliveryOriginLng;

    if ((!originLat || !originLng) && settings.deliveryOriginAddress) {
      try {
        const originGeo = await geocodeAddress({ street: settings.deliveryOriginAddress });
        if (originGeo) {
          originLat = originGeo.lat;
          originLng = originGeo.lng;
        }
      } catch (e) {
        console.warn('Could not geocode origin address:', e);
      }
    }

    if (!originLat || !originLng) {
      if (settings.deliveryFallbackPrice !== undefined) {
        setDeliveryCalculation({
          fee: settings.deliveryFallbackPrice,
          isFree: settings.deliveryFallbackPrice === 0,
          isBeyondMax: false,
          distanceKm: 0,
          isEstimate: true
        });
      }
      return;
    }

    const street = customFormData.street?.trim();
    const number = customFormData.number?.trim();
    const neighborhood = customFormData.bairro?.trim();
    const city = customFormData.city?.trim();
    const state = customFormData.state?.trim();
    const cep = customFormData.zipCode?.trim();

    if (!street && !neighborhood && !cep) {
      return;
    }

    setIsCalculatingDelivery(true);
    try {
      const destGeo = await geocodeAddress({
        street,
        number,
        neighborhood,
        city,
        state,
        cep
      });

      if (!destGeo) {
        const fallback = settings.deliveryFallbackPrice ?? 0;
        setDeliveryCalculation({
          fee: fallback,
          isFree: fallback === 0,
          isBeyondMax: false,
          distanceKm: 0,
          isEstimate: true
        });
        toast.info('Não foi possível identificar a rota exata no mapa. Taxa de entrega padrão aplicada.');
        return;
      }

      const dist = await calculateDistanceKm(originLat, originLng, destGeo.lat, destGeo.lng);
      const calc = calculateDeliveryFee(dist.distanceKm, settings, cartTotal, dist.isEstimate);
      setDeliveryCalculation(calc);

      if (calc.isBeyondMax) {
        toast.warning(`A distância (${calc.distanceKm} km) ultrapassa nosso raio padrão de atendimento (${settings.deliveryMaxKm || 15} km).`);
      } else if (calc.isFree) {
        toast.success(`Parabéns! Frete Grátis aplicado (${calc.distanceKm} km)!`);
      } else {
        toast.success(`Frete calculado: ${currencySymbol} ${calc.fee.toFixed(2)} (${calc.distanceKm} km)`);
      }
    } catch (err) {
      console.warn('Delivery calculation error:', err);
      if (settings.deliveryFallbackPrice !== undefined) {
        setDeliveryCalculation({
          fee: settings.deliveryFallbackPrice,
          isFree: settings.deliveryFallbackPrice === 0,
          isBeyondMax: false,
          distanceKm: 0,
          isEstimate: true
        });
      }
    } finally {
      setIsCalculatingDelivery(false);
    }
  };

  const handleCepLookup = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      setIsSearchingCep(true);
      try {
        const address = await fetchViaCep(cleanCep);
        if (address) {
          const updated = {
            ...formData,
            zipCode: cepValue,
            street: address.logradouro || formData.street,
            bairro: address.bairro || formData.bairro,
            city: address.localidade || formData.city,
            state: address.uf || formData.state
          };
          setFormData(updated);
          toast.success('Endereço localizado pelo CEP!');
          if (settings.deliveryEnabled) {
            handleCalculateDelivery(updated);
          }
        }
      } catch (e) {
        console.warn('CEP lookup error:', e);
      } finally {
        setIsSearchingCep(false);
      }
    }
  };

  const [activeScreen, setActiveScreen] = useState<'intro' | 'selector' | 'menu'>(() => {
    if (settings.introEnabled !== false) return 'intro';
    return 'selector';
  });

  useEffect(() => {
    onScreenChange?.(activeScreen);
  }, [activeScreen, onScreenChange]);
  const [selectedCatalog, setSelectedCatalog] = useState<'catalog1' | 'catalog2' | 'catalog3' | 'catalog4' | 'catalog5' | 'catalog6' | null>('catalog1');

  useEffect(() => {
    onCatalogChange?.(selectedCatalog);
  }, [selectedCatalog, onCatalogChange]);

  useEffect(() => {
    if (settings) {
      if (settings.introEnabled === false && settings.selectorEnabled === false) {
        setActiveScreen('menu');
      }
    }
  }, [settings]);

  useEffect(() => {
    if (selectedProductForDetails) {
      const product = selectedProductForDetails;
      if (product.sizes && product.sizes.length > 0) {
        setSelectedSize(product.sizes[0]);
      } else {
        setSelectedSize(null);
      }

      if (product.isCustomCake) {
        setSelectedCakeSize('');
        setSelectedDough('');
        setSelectedFillings([]);
        setSelectedTopping('');
        setSelectedTopper('');
        setSelectedStyleNumber(null);
      }

      if (product.isCustomSandwich) {
        setSelectedSandwichFillings([]);
      }

      setMealSelections({
        removals: [],
        sides: []
      });
      setSideQuantities({});
    }
  }, [selectedProductForDetails]);

  useEffect(() => {
    // Inicia ouvintes do Firestore com cache local
    const unsubProducts = onSnapshot(query(collection(db, 'produtos'), orderBy('title')), (snapshot) => {
      const fetchedProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(fetchedProducts);
      setLoading(false);
      try {
        localStorage.setItem('grao_sabor_cached_products', JSON.stringify(fetchedProducts));
      } catch (e) {
        // ignore quota
      }
    }, (error) => {
      console.error('Menu: Erro ao carregar produtos:', error);
      setLoading(false);
    });

    const unsubCategories = onSnapshot(query(collection(db, 'categorias'), orderBy('order', 'asc')), (snapshot) => {
      const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      setCategories(fetchedCategories);
      try {
        localStorage.setItem('grao_sabor_cached_categories', JSON.stringify(fetchedCategories));
      } catch (e) {
        // ignore quota
      }
    }, (error) => {
      console.error('Menu: Erro ao carregar categorias:', error);
    });

    const unsubSides = onSnapshot(collection(db, 'acompanhamentos'), (snapshot) => {
      const fetchedSides = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Side));
      setSides(fetchedSides);
    }, (error) => {
      console.error('Menu: Erro ao carregar acompanhamentos:', error);
    });

    const unsubGalleries = onSnapshot(collection(db, 'galerias'), (snapshot) => {
      setGalleries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ImageGallery)));
    }, (error) => {
      console.error('Menu: Erro ao carregar galerias:', error);
    });

    return () => {
      unsubProducts();
      unsubCategories();
      unsubSides();
      unsubGalleries();
    };
  }, []);

  // Check localStorage for saved B2B profile
  useEffect(() => {
    const saved = localStorage.getItem('b2b_profile_save');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.name) setB2bName(parsed.name);
        if (parsed.manager) setB2bResponsibleName(parsed.manager);
        if (parsed.phone) setB2bPhone(parsed.phone);
        if (parsed.address) setB2bAddress(parsed.address);
        setIsReturningB2b(true);
      } catch (e) {}
    }
  }, []);

  const addToCart = (product: Product, customQty: number = 1) => {
    const minQ = product.minQuantity && product.minQuantity > 1 ? product.minQuantity : 1;
    const effectiveQty = Math.max(customQty, minQ);
    if (customQty < minQ) {
      toast.info(settings.language === 'en'
        ? `The minimum order quantity for "${product.title}" is ${minQ} units.`
        : `A quantidade mínima para "${product.title}" é de ${minQ} unidades.`);
    }

    const hasMultipleSizes = !!(product.sizes && product.sizes.length > 1);
    const isCombo = product.isCombo === true || product.itemFormat === 'combo';
    const isCustomCake = !!product.isCustomCake;

    // Se o item tiver apenas 1 valor cadastrado (não tem múltiplos tamanhos, não é combo nem bolo personalizado)
    // adiciona direto na sacola sem abrir modal!
    if (!hasMultipleSizes && !isCombo && !isCustomCake) {
      const defaultSize = (product.sizes && product.sizes.length === 1) ? product.sizes[0] : undefined;
      setCart(prev => {
        const existing = prev.find(item => item.productId === product.id && (!item.selectedSize || item.selectedSize?.id === defaultSize?.id) && !item.mealOptions);
        if (existing) {
          return prev.map(item => item === existing ? { ...item, quantity: item.quantity + effectiveQty } : item);
        }
        return [...prev, { id: Math.random().toString(36).substr(2, 9), productId: product.id, quantity: effectiveQty, selectedSize: defaultSize }];
      });
      return;
    }

    const hasSizesOpt = !!(product.sizes && product.sizes.length > 0);
    const hasExclusionsOpt = !!(product.isMeal && product.ingredients && product.ingredients.split(',').map(i => i.trim()).filter(Boolean).length > 0);
    const hasSidesOpt = !!(product.isMeal && product.allowedSides && product.allowedSides.filter(id => sides.some(s => s.id === id)).length > 0);
    const isCustomCakeOpt = !!product.isCustomCake;
    const isCustomSandwichOpt = !!product.isCustomSandwich;
    
    // If it requires complex customization (exclusions, sides, cake, or sandwich selection)
    const requiresComplexCustomization = hasExclusionsOpt || hasSidesOpt || isCustomCakeOpt || isCustomSandwichOpt;

    // If we have selectedSize from details modal and NO complex customization is needed, add directly!
    if (hasSizesOpt && selectedSize && !requiresComplexCustomization) {
      setCart(prev => {
        const existing = prev.find(item => item.productId === product.id && !item.mealOptions && item.selectedSize?.id === selectedSize.id);
        if (existing) {
          return prev.map(item => item === existing ? { ...item, quantity: item.quantity + effectiveQty } : item);
        }
        return [...prev, { id: Math.random().toString(36).substr(2, 9), productId: product.id, quantity: effectiveQty, selectedSize: selectedSize }];
      });
      return;
    }

    const requiresCustomization = hasSizesOpt || hasExclusionsOpt || hasSidesOpt || isCustomCakeOpt || isCustomSandwichOpt;

    if (requiresCustomization) {
      setSelectedProductForCustom(product);
      setMealSelections({
        removals: [],
        sides: []
      });
      setSideQuantities({});
      
      // Preserve existing selectedSize if valid for this product, otherwise set first option
      if (product.sizes && product.sizes.length > 0) {
        const isAlreadySelectedSizeValid = selectedSize && product.sizes.some(s => s.id === selectedSize.id);
        if (!isAlreadySelectedSizeValid) {
          setSelectedSize(product.sizes[0]);
        }
      } else {
        setSelectedSize(null);
      }
      
      if (product.isCustomCake) {
        setSelectedCakeSize('');
        setSelectedDough('');
        setSelectedFillings([]);
        setSelectedTopping('');
        setSelectedTopper('');
        setSelectedStyleNumber(null);
      }

      if (product.isCustomSandwich) {
        setSelectedSandwichFillings([]);
      }
      setIsCustomModalOpen(true);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id && !item.mealOptions && !item.selectedSize);
      if (existing) {
        return prev.map(item => item === existing ? { ...item, quantity: item.quantity + effectiveQty } : item);
      }
      return [...prev, { id: Math.random().toString(36).substr(2, 9), productId: product.id, quantity: effectiveQty }];
    });
  };

  const incrementSizeQty = (product: Product, size: ProductSize) => {
    const minQ = product.minQuantity && product.minQuantity > 1 ? product.minQuantity : 1;
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id && item.selectedSize?.id === size.id && !item.mealOptions && !item.cakeOptions);
      if (existing) {
        return prev.map(item => item === existing ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: Math.random().toString(36).substr(2, 9), productId: product.id, quantity: minQ, selectedSize: size }];
    });
  };

  const decrementSizeQty = (product: Product, size: ProductSize) => {
    const minQ = product.minQuantity && product.minQuantity > 1 ? product.minQuantity : 1;
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id && item.selectedSize?.id === size.id && !item.mealOptions && !item.cakeOptions);
      if (existing) {
        if (existing.quantity <= minQ) {
          if (minQ > 1) {
            toast.info(settings.language === 'en' 
              ? `Minimum quantity for "${product.title}" is ${minQ}. Item removed from cart.` 
              : `A quantidade mínima para "${product.title}" é de ${minQ} unidades. Item removido.`);
          }
          return prev.filter(item => item !== existing);
        }
        return prev.map(item => item === existing ? { ...item, quantity: item.quantity - 1 } : item);
      }
      return prev;
    });
  };

  const getMaxSandwichFillings = (sizeName: string): number => {
    const match = sizeName.match(/(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return 1;
  };

  const addMealToCart = () => {
    if (!selectedProductForCustom) return;

    if (selectedProductForCustom.isCustomSandwich) {
      const activeFillings = (Object.entries(sandwichFillingQuantities) as [string, number][])
        .filter(([_, qty]) => qty > 0)
        .map(([name, qty]) => ({ name, qty }));

      if (activeFillings.length === 0) {
        toast.error(settings.language === 'en' ? 'Choose at least 1 option!' : 'Escolha pelo menos 1 opção!');
        return;
      }

      setCart(prev => {
        let currentCart = [...prev];

        for (const { name, qty } of activeFillings) {
          const newSandwichOptions = {
            fillings: [name]
          };

          const existing = currentCart.find(item =>
            item.productId === selectedProductForCustom.id &&
            ((!item.selectedSize && !selectedSize) || (item.selectedSize?.id === selectedSize?.id)) &&
            item.sandwichOptions &&
            JSON.stringify(item.sandwichOptions.fillings) === JSON.stringify(newSandwichOptions.fillings)
          );

          if (existing) {
            currentCart = currentCart.map(item =>
              item.id === existing.id ? { ...item, quantity: item.quantity + qty } : item
            );
          } else {
            currentCart.push({
              id: Math.random().toString(36).substr(2, 9),
              productId: selectedProductForCustom.id,
              quantity: qty,
              sandwichOptions: newSandwichOptions,
              selectedSize: selectedSize || undefined
            });
          }
        }

        return currentCart;
      });

      setIsCustomModalOpen(false);
      setSelectedProductForCustom(null);
      setSelectedSize(null);
      return;
    }

    if (selectedProductForCustom.isCustomCake) {
      const maxFillings = settings.cakeFillingsMax || 2;
      if (selectedFillings.length > maxFillings) {
        toast.error(`Choose at most ${maxFillings} fillings!`);
        return;
      }
      
      setCart(prev => {
        const newCakeOptions = {
          size: selectedCakeSize,
          dough: selectedDough,
          fillings: selectedFillings,
          topping: selectedTopping,
          topper: selectedTopper,
          styleNumber: selectedStyleNumber || undefined
        };
        
        const existing = prev.find(item => 
          item.productId === selectedProductForCustom.id && 
          item.cakeOptions &&
          item.cakeOptions.size === newCakeOptions.size &&
          item.cakeOptions.dough === newCakeOptions.dough &&
          item.cakeOptions.topping === newCakeOptions.topping &&
          item.cakeOptions.topper === newCakeOptions.topper &&
          item.cakeOptions.styleNumber === newCakeOptions.styleNumber &&
          JSON.stringify([...(item.cakeOptions.fillings || [])].sort()) === JSON.stringify([...newCakeOptions.fillings].sort())
        );

        if (existing) {
          return prev.map(item => item.id === existing.id ? { ...item, quantity: item.quantity + customItemQuantity } : item);
        }

        return [
          ...prev,
          {
            id: Math.random().toString(36).substr(2, 9),
            productId: selectedProductForCustom.id,
            quantity: customItemQuantity,
            cakeOptions: newCakeOptions
          }
        ];
      });

      setIsCustomModalOpen(false);
      setSelectedProductForCustom(null);
      return;
    }
    
    const selectedSides: Side[] = [];
    Object.entries(sideQuantities).forEach(([id, qty]) => {
      const side = sides.find(s => s.id === id);
      if (side) {
        for (let i = 0; i < (qty as number); i++) {
          selectedSides.push(side);
        }
      }
    });

    const newMealOptions = selectedProductForCustom.isMeal ? {
      removals: mealSelections.removals,
      sides: selectedSides
    } : undefined;

    setCart(prev => {
      const existing = prev.find(item => 
        item.productId === selectedProductForCustom.id && 
        ((!item.selectedSize && !selectedSize) || (item.selectedSize?.id === selectedSize?.id)) &&
        (!newMealOptions || (
          JSON.stringify([...(item.mealOptions?.removals || [])].sort()) === JSON.stringify([...newMealOptions.removals].sort()) &&
          JSON.stringify([...(item.mealOptions?.sides || [])].map(s => s.id).sort()) === JSON.stringify([...newMealOptions.sides].map(s => s.id).sort())
        ))
      );

      if (existing) {
        return prev.map(item => item.id === existing.id ? { ...item, quantity: item.quantity + customItemQuantity } : item);
      }

      return [
        ...prev, 
        { 
          id: Math.random().toString(36).substr(2, 9), 
          productId: selectedProductForCustom.id, 
          quantity: customItemQuantity,
          mealOptions: newMealOptions,
          selectedSize: selectedSize || undefined
        }
      ];
    });

    setIsCustomModalOpen(false);
    setSelectedProductForCustom(null);
    setSelectedSize(null);
  };

  const addDetailedProductToCart = (product: Product) => {
    if (product.isCustomSandwich) {
      const activeFillings = (Object.entries(sandwichFillingQuantities) as [string, number][])
        .filter(([_, qty]) => qty > 0)
        .map(([name, qty]) => ({ name, qty }));

      if (activeFillings.length === 0) {
        toast.error(settings.language === 'en' ? 'Choose at least 1 option!' : 'Escolha pelo menos 1 opção!');
        return;
      }

      setCart(prev => {
        let currentCart = [...prev];

        for (const { name, qty } of activeFillings) {
          const newSandwichOptions = {
            fillings: [name]
          };

          const existing = currentCart.find(item =>
            item.productId === product.id &&
            ((!item.selectedSize && !selectedSize) || (item.selectedSize?.id === selectedSize?.id)) &&
            item.sandwichOptions &&
            JSON.stringify(item.sandwichOptions.fillings) === JSON.stringify(newSandwichOptions.fillings)
          );

          if (existing) {
            currentCart = currentCart.map(item =>
              item.id === existing.id ? { ...item, quantity: item.quantity + qty } : item
            );
          } else {
            currentCart.push({
              id: Math.random().toString(36).substr(2, 9),
              productId: product.id,
              quantity: qty,
              sandwichOptions: newSandwichOptions,
              selectedSize: selectedSize || undefined
            });
          }
        }

        return currentCart;
      });

      setSelectedProductForDetails(null);
      setSelectedSize(null);
      setSelectedSandwichFillings([]);
      toast.success(settings.language === 'en' ? 'Successfully added to request list!' : 'Adicionado com sucesso ao pedido!');
      return;
    }

    if (product.isCustomCake) {
      const maxFillings = settings.cakeFillingsMax || 2;
      if (selectedFillings.length > maxFillings) {
        toast.error(`Choose at most ${maxFillings} fillings!`);
        return;
      }
      
      setCart(prev => {
        const newCakeOptions = {
          size: selectedCakeSize,
          dough: selectedDough,
          fillings: selectedFillings,
          topping: selectedTopping,
          topper: selectedTopper,
          styleNumber: selectedStyleNumber || undefined
        };
        
        const existing = prev.find(item => 
          item.productId === product.id && 
          item.cakeOptions &&
          item.cakeOptions.size === newCakeOptions.size &&
          item.cakeOptions.dough === newCakeOptions.dough &&
          item.cakeOptions.topping === newCakeOptions.topping &&
          item.cakeOptions.topper === newCakeOptions.topper &&
          item.cakeOptions.styleNumber === newCakeOptions.styleNumber &&
          JSON.stringify([...(item.cakeOptions.fillings || [])].sort()) === JSON.stringify([...newCakeOptions.fillings].sort())
        );

        if (existing) {
          return prev.map(item => item.id === existing.id ? { ...item, quantity: item.quantity + customItemQuantity } : item);
        }

        return [
          ...prev,
          {
            id: Math.random().toString(36).substr(2, 9),
            productId: product.id,
            quantity: customItemQuantity,
            cakeOptions: newCakeOptions
          }
        ];
      });

      setSelectedProductForDetails(null);
      toast.success(settings.language === 'en' ? 'Successfully added to request list!' : 'Adicionado com sucesso ao pedido!');
      return;
    }
    
    const selectedSides: Side[] = [];
    Object.entries(sideQuantities).forEach(([id, qty]) => {
      const side = sides.find(s => s.id === id);
      if (side) {
        for (let i = 0; i < (qty as number); i++) {
          selectedSides.push(side);
        }
      }
    });

    const newMealOptions = product.isMeal ? {
      removals: mealSelections.removals,
      sides: selectedSides
    } : undefined;

    setCart(prev => {
      const existing = prev.find(item => 
        item.productId === product.id && 
        ((!item.selectedSize && !selectedSize) || (item.selectedSize?.id === selectedSize?.id)) &&
        (!newMealOptions || (
          JSON.stringify([...(item.mealOptions?.removals || [])].sort()) === JSON.stringify([...newMealOptions.removals].sort()) &&
          JSON.stringify([...(item.mealOptions?.sides || [])].map(s => s.id).sort()) === JSON.stringify([...newMealOptions.sides].map(s => s.id).sort())
        ))
      );

      if (existing) {
        return prev.map(item => item.id === existing.id ? { ...item, quantity: item.quantity + customItemQuantity } : item);
      }

      return [
        ...prev, 
        { 
          id: Math.random().toString(36).substr(2, 9), 
          productId: product.id, 
          quantity: customItemQuantity,
          mealOptions: newMealOptions,
          selectedSize: selectedSize || undefined
        }
      ];
    });

    setSelectedProductForDetails(null);
    setSelectedSize(null);
    toast.success(settings.language === 'en' ? 'Successfully added to request list!' : 'Adicionado com sucesso ao pedido!');
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === cartItemId);
      if (!existing) return prev;
      const product = products.find(p => p.id === existing.productId);
      const minQ = product?.minQuantity && product.minQuantity > 1 ? product.minQuantity : 1;
      if (existing.quantity > minQ) {
        return prev.map(item => item.id === cartItemId ? { ...item, quantity: item.quantity - 1 } : item);
      }
      if (minQ > 1) {
        toast.info(settings.language === 'en' 
          ? `Minimum order quantity for this item is ${minQ}. Item removed from cart.` 
          : `A quantidade mínima para este item é de ${minQ} unidades. Item removido.`);
      }
      return prev.filter(item => item.id !== cartItemId);
    });
  };

  const cartItemsCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce((total, item) => {
    const product = products.find(p => p.id === item.productId);
    const basePrice = item.selectedSize ? item.selectedSize.price : ((product?.price && product.price > 0) ? product.price : (product?.oldPrice || 0));
    let itemPrice = basePrice;
    if (item.mealOptions?.sides) {
      itemPrice += item.mealOptions.sides.reduce((sum, s) => sum + s.price, 0);
    }
    return total + itemPrice * item.quantity;
  }, 0);

  const isFreeDeliveryQualified = useMemo(() => {
    return Boolean(
      settings?.deliveryFreeAbove && 
      settings.deliveryFreeAbove > 0 && 
      cartTotal >= settings.deliveryFreeAbove
    );
  }, [settings?.deliveryFreeAbove, cartTotal]);

  const effectiveDeliveryFee = useMemo(() => {
    if (!settings?.deliveryEnabled || deliveryType !== 'delivery') return 0;
    if (isFreeDeliveryQualified) return 0;
    if (settings?.deliveryCities && settings.deliveryCities.length > 0) {
      if (!selectedDeliveryCityId || selectedDeliveryCityId === 'other') return 0;
      const found = settings.deliveryCities.find(c => c.id === selectedDeliveryCityId);
      return found ? found.price : 0;
    }
    return deliveryCalculation?.fee || 0;
  }, [settings?.deliveryEnabled, deliveryType, isFreeDeliveryQualified, settings?.deliveryCities, selectedDeliveryCityId, deliveryCalculation]);

  const sortedDeliveryCities = useMemo(() => {
    if (!settings?.deliveryCities || settings.deliveryCities.length === 0) return [];
    return [...settings.deliveryCities].sort((a, b) => 
      a.cityName.trim().localeCompare(b.cityName.trim(), 'pt-BR', { sensitivity: 'base' })
    );
  }, [settings?.deliveryCities]);

  const checkMarmitifyLimit = () => {
    return true;
  };

  const validateCartItems = () => {
    // Validação de Valor Mínimo do Pedido (Imagem 4 & 5)
    if (settings.minOrderEnabled && settings.minOrderValue && settings.minOrderValue > 0) {
      if (cartTotal < settings.minOrderValue) {
        const diff = settings.minOrderValue - cartTotal;
        return {
          isValid: false,
          isMinOrder: true,
          message: `Valor mínimo do pedido: ${currencySymbol} ${settings.minOrderValue.toFixed(2).replace('.', ',')}. Faltam ${currencySymbol} ${diff.toFixed(2).replace('.', ',')} para poder finalizar.`
        };
      }
    }

    for (const item of cart) {
      const product = products.find(p => p.id === item.productId);
      if (product && product.minQuantity && product.minQuantity > 1) {
        if (item.quantity < product.minQuantity) {
          return {
            isValid: false,
            message: `O item "${product.title}" exige quantidade mínima de ${product.minQuantity} unidades (atual: ${item.quantity}).`
          };
        }
      }
    }
    return { isValid: true, message: '' };
  };

  const handleFinalizar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (cart.length === 0) {
      toast.error(settings.language === 'en' ? 'Your cart is empty!' : 'Seu carrinho está vazio!');
      return;
    }

    // Validações de campos obrigatórios e formato de e-mail/telefone
    if (!formData.nome.trim()) {
      toast.error('O campo Nome Completo é obrigatório!');
      return;
    }
    if (!formData.telefone.trim()) {
      toast.error('O campo Telefone é obrigatório!');
      return;
    }
    const countryCfg = COUNTRY_OPTIONS[settings.whatsappCountryCode || '+55'] || COUNTRY_OPTIONS['+55'];
    const phoneDigits = formData.telefone.replace(/\D/g, '');
    if (phoneDigits.length < countryCfg.minDigits) {
      toast.error(`Por favor, insira um telefone válido com código de área (${countryCfg.minDigits} dígitos)!`);
      return;
    }
    if (!formData.aniversario.trim()) {
      toast.error('O campo Aniversário é obrigatório!');
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(formData.aniversario.trim())) {
      toast.error('Por favor, insira o aniversário no formato DD/MM!');
      return;
    }
    if (deliveryType === 'delivery' || !settings.deliveryEnabled) {
      if (settings.deliveryEnabled && settings.deliveryCities && settings.deliveryCities.length > 0) {
        if (!selectedDeliveryCityId) {
          toast.error('Por favor, selecione a sua cidade para entrega!');
          return;
        }
      }
      if (!formData.street.trim()) {
        toast.error('O campo Rua/Avenida é obrigatório!');
        return;
      }
      if (!formData.city.trim()) {
        toast.error('O campo Cidade é obrigatório!');
        return;
      }
      if (!formData.state.trim()) {
        toast.error('O campo Estado é obrigatório!');
        return;
      }
    }

    const validation = validateCartItems();
    if (!validation.isValid) {
      toast.error(validation.message);
      return;
    }
    
    if (!checkMarmitifyLimit()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const hasConsultItems = cart.some(item => {
        const p = products.find(prod => prod.id === item.productId);
        return p?.priceType === 'consult' || p?.isCustomCake === true;
      });
      
      const orderItems = cart.map(item => {
        const product = products.find(p => p.id === item.productId)!;
        const basePrice = item.selectedSize ? item.selectedSize.price : ((product.price && product.price > 0) ? product.price : (product.oldPrice || 0));
        let itemPrice = basePrice;
        if (item.mealOptions?.sides) {
          itemPrice += item.mealOptions.sides.reduce((sum, s) => sum + s.price, 0);
        }

        const cleanedMealOptions = item.mealOptions ? {
          removals: item.mealOptions.removals || [],
          sides: (item.mealOptions.sides || []).map(side => ({
            id: side.id,
            name: side.name,
            price: side.price,
            type: side.type || 'side'
          }))
        } : undefined;

        return {
          title: item.selectedSize ? `${product.title} (${item.selectedSize.name})` : product.title,
          quantity: item.quantity,
          price: itemPrice,
          priceType: product.priceType || 'fixed',
          mealOptions: cleanedMealOptions,
          selectedSize: item.selectedSize || undefined,
          cakeOptions: item.cakeOptions || undefined,
          sandwichOptions: item.sandwichOptions || undefined,
          comboSelections: item.comboSelections || undefined
        };
      });

      const deliveryFeeVal = (settings.deliveryEnabled && deliveryType === 'delivery')
        ? effectiveDeliveryFee
        : 0;
      const finalTotalWithDelivery = cartTotal + deliveryFeeVal;

      const fullAddress = deliveryType === 'pickup'
        ? (settings.deliveryOriginAddress ? `Retirada na Loja (${settings.deliveryOriginAddress})` : 'Retirada no Estabelecimento')
        : `${formData.street}, ${formData.number || 'S/N'}${formData.bairro ? ` - Bairro ${formData.bairro}` : ''} - ${formData.city} / ${formData.state}${formData.zipCode ? ` (CEP: ${formData.zipCode})` : ''}`;

      const orderData: Omit<Order, 'id'> = cleanFirestoreObject({
        customerName: formData.nome,
        phone: formData.telefone,
        address: fullAddress,
        street: formData.street || '',
        number: formData.number || '',
        neighborhood: formData.bairro || '',
        zipCode: formData.zipCode || '',
        city: formData.city || '',
        state: formData.state || '',
        deliveryType: settings.deliveryEnabled ? deliveryType : 'pickup',
        deliveryFee: (settings.deliveryEnabled && deliveryType === 'delivery') ? deliveryFeeVal : 0,
        deliveryDistanceKm: (settings.deliveryEnabled && deliveryType === 'delivery') ? (deliveryCalculation?.distanceKm || 0) : 0,
        birthday: formData.aniversario || '',
        observation: formData.observacao || '',
        email: formData.email || '',
        items: orderItems,
        total: finalTotalWithDelivery,
        subtotal: cartTotal,
        taxRate: 0,
        taxAmount: 0,
        createdAt: serverTimestamp(),
        orderLanguage: settings.language || 'pt'
      });

      console.log('Finalizando pedido...', orderData);
      await addDoc(collection(db, 'pedidos'), orderData);

      // Decrementar estoque de produtos e componentes de combos
      cart.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        if (prod && prod.trackStock && typeof prod.stockQuantity === 'number') {
          const newQty = Math.max(0, prod.stockQuantity - item.quantity);
          updateDoc(doc(db, 'produtos', prod.id), { stockQuantity: newQty }).catch(console.error);
        }
        if (item.comboSelections && item.comboSelections.length > 0) {
          item.comboSelections.forEach(sel => {
            const comp = products.find(p => p.id === sel.dishId);
            if (comp && comp.trackStock && typeof comp.stockQuantity === 'number') {
              const countVal = sel.quantity ?? sel.count ?? 1;
              const newQty = Math.max(0, comp.stockQuantity - (countVal * item.quantity));
              updateDoc(doc(db, 'produtos', comp.id), { stockQuantity: newQty }).catch(console.error);
            }
          });
        }
      });
      
      const now = new Date();
      const timeStr = now.toLocaleTimeString(settings.language === 'en' ? 'en-US' : 'pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
      const dateStr = now.toLocaleDateString(settings.language === 'en' ? 'en-US' : 'pt-BR', { timeZone: 'America/Sao_Paulo' });

      let message = `*${t.whatsappOrder} - ${settings.brandName || settings.slug}*\n`;
      message += `*${t.whatsappDate}:* ${dateStr} ${t.whatsappAt} ${timeStr}\n\n`;
      
      message += `*--- ${t.whatsappData} ---*\n`;
      message += `*${t.fullName}:* ${formData.nome}\n`;
      message += `*${t.phone}:* ${formData.telefone}\n`;
      if (formData.email && formData.email.trim()) {
        message += `*${t.email}:* ${formData.email}\n`;
      }
      message += `*${t.birthday}:* ${formData.aniversario}\n`;
      if (settings.deliveryEnabled) {
        message += `*Forma de Recebimento:* ${deliveryType === 'pickup' ? ' Retirada no Estabelecimento' : ' Entrega (Delivery)'}\n`;
      }
      if (deliveryType === 'delivery' || !settings.deliveryEnabled) {
        message += `*${t.street}:* ${formData.street}\n`;
        message += `*${t.number}:* ${formData.number || '-'}\n`;
        if (formData.bairro) message += `*Bairro:* ${formData.bairro}\n`;
        message += `*${t.city}:* ${formData.city}\n`;
        message += `*${t.state}:* ${formData.state}\n`;
        if (formData.zipCode) message += `*CEP:* ${formData.zipCode}\n`;
      } else if (deliveryType === 'pickup' && settings.deliveryOriginAddress) {
        message += `*Local de Retirada:* ${settings.deliveryOriginAddress}\n`;
      }
      if (settings.deliveryEnabled && deliveryType === 'delivery' && deliveryCalculation?.distanceKm) {
        message += `*Distância Estimada:* ${deliveryCalculation.distanceKm} km (via OpenStreetMap/OSRM)\n`;
      }
      message += `*${t.observation}:* ${formData.observacao || '-'}\n\n`;

      message += `*--- ${t.whatsappItems} ---*\n`;
      orderItems.forEach((item, idx) => {
        const originalItem = cart[idx];
        if (item.priceType === 'consult') {
          message += `• ${item.quantity}x ${item.title} - (Value to Consult)\n`;
        } else {
          message += `• ${item.quantity}x ${item.title} - ${currencySymbol}${(item.price * item.quantity).toFixed(2)}\n`;
        }
        if (originalItem && originalItem.comboSelections && originalItem.comboSelections.length > 0) {
          message += `  (Sabores escolhidos no combo):\n`;
          originalItem.comboSelections.forEach(sel => {
            const countVal = sel.quantity ?? sel.count ?? 1;
            message += `    • ${countVal}x ${sel.dishTitle}\n`;
          });
        }
        if (item.mealOptions) {
          if (item.mealOptions.removals.length > 0) {
            message += `  (Excluding: ${item.mealOptions.removals.join(', ')})\n`;
          }
          if (item.mealOptions.sides.length > 0) {
            const normalSidesArr = item.mealOptions.sides.filter(s => s.type !== 'swap');
            const swapSidesArr = item.mealOptions.sides.filter(s => s.type === 'swap');
            
            if (normalSidesArr.length > 0) {
              const grouped = normalSidesArr.reduce((acc: Record<string, number>, s) => { acc[s.name] = (acc[s.name] || 0) + 1; return acc; }, {});
              const str = Object.entries(grouped).map(([name, qty]) => `${name}${Number(qty) > 1 ? ` (${qty}x)` : ''}`).join(', ');
              message += `  (Sides: ${str})\n`;
            }
            if (swapSidesArr.length > 0) {
              const grouped = swapSidesArr.reduce((acc: Record<string, number>, s) => { acc[s.name] = (acc[s.name] || 0) + 1; return acc; }, {});
              const str = Object.entries(grouped).map(([name, qty]) => `${name}${Number(qty) > 1 ? ` (${qty}x)` : ''}`).join(', ');
              message += `  (Swaps: ${str})\n`;
            }
          }
        }
        if (originalItem && originalItem.cakeOptions) {
          const opts = originalItem.cakeOptions;
          if (opts.size) message += `  (Size: ${opts.size})\n`;
          if (opts.dough) message += `  (Dough: ${opts.dough})\n`;
          if (opts.fillings && opts.fillings.length > 0) message += `  (Fillings: ${opts.fillings.join(' + ')})\n`;
          if (opts.topping) message += `  (Topping: ${opts.topping})\n`;
          if (opts.topper) message += `  (Topper: ${opts.topper})\n`;
          if (opts.styleNumber) message += `  (Style Reference: Photo No. ${opts.styleNumber})\n`;
        }
        if (originalItem && originalItem.sandwichOptions) {
          const opts = originalItem.sandwichOptions;
          if (opts.fillings && opts.fillings.length > 0) message += `  (${settings.language === 'en' ? 'State' : 'Estado'}: ${opts.fillings.join(' + ')})\n`;
        }
      });

      if (settings.deliveryEnabled && deliveryType === 'delivery') {
        message += `\n*Subtotal dos Itens:* ${currencySymbol}${cartTotal.toFixed(2)}\n`;
        if (isFreeDeliveryQualified) {
          message += `*Taxa de Entrega:* GRÁTIS (Pedido acima de ${currencySymbol}${settings.deliveryFreeAbove?.toFixed(2)})\n`;
        } else if (settings.deliveryCities && settings.deliveryCities.length > 0) {
          const selectedCity = settings.deliveryCities.find(c => c.id === selectedDeliveryCityId);
          if (selectedDeliveryCityId === 'other') {
            message += `*Taxa de Entrega:* A combinar com o atendente\n`;
          } else {
            message += `*Taxa de Entrega (${selectedCity?.cityName || formData.city}):* ${currencySymbol}${deliveryFeeVal.toFixed(2)}\n`;
          }
        } else {
          message += `*Taxa de Entrega (${deliveryCalculation?.distanceKm ? `${deliveryCalculation.distanceKm} km` : 'Frete'}):* ${deliveryCalculation?.isFree ? 'GRÁTIS' : `${currencySymbol}${deliveryFeeVal.toFixed(2)}`}\n`;
        }
      } else if (settings.deliveryEnabled && deliveryType === 'pickup') {
        message += `\n*Subtotal dos Itens:* ${currencySymbol}${cartTotal.toFixed(2)}\n`;
        message += `*Retirada no Estabelecimento:* GRÁTIS\n`;
      }

      message += `*${t.whatsappTotal}:* ${currencySymbol}${finalTotalWithDelivery.toFixed(2)}\n`;
      
      if (hasConsultItems) {
        message += `\n⚠️ *${t.consultMessage}*\n`;
      }
      
      message += `\n${settings.whatsappClosingMessage || 'Obrigada pelo pedido, aguarde que entraremos em contato para confirmação!'}`;

      const encodedMessage = encodeURIComponent(message);
      const cleanPhone = getCleanWhatsAppPhone(settings.whatsappNumber || '', settings.whatsappCountryCode || '+55');
      
      if (!cleanPhone) {
        toast.error(settings.language === 'en' 
          ? 'Error: Representative contact number is not properly configured in the administration panel.' 
          : 'Erro: Número para contato não configurado corretamente no painel administrativo.'
        );
        return;
      }

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const whatsappUrl = isIOS 
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`
        : `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

      setStandardSuccessUrls({ whatsapp: whatsappUrl });
      setCheckoutStep('channels');
      setHasRedirected(false);
      toast.success(settings.language === 'en' ? 'Order saved! Select your dispatch method below.' : 'Pedido salvo! Selecione a forma de envio abaixo.');
    } catch (error) {
      console.error("Erro ao salvar pedido:", error);
      toast.error(settings.language === 'en' ? 'Error finalizing order. Please try again.' : 'Erro ao finalizar pedido. Por favor, tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteStandardOrder = () => {
    setCart([]);
    setIsModalOpen(false);
    setCheckoutStep('summary');
    setStandardSuccessUrls(null);
    setFormData({ 
      nome: '', 
      telefone: '', 
      endereco: '', 
      street: '',
      number: '',
      bairro: '',
      zipCode: '',
      state: '',
      city: '',
      aniversario: '', 
      observacao: '', 
      email: '' 
    });
    setDeliveryCalculation(null);
  };

  const handleCompleteB2bOrder = () => {
    setCart([]);
    setIsModalOpen(false);
    setCheckoutStep('summary');
    setB2bSuccessUrls(null);
  };

   const handleFinalizarB2b = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (cart.length === 0) {
      toast.error(settings.language === 'en' ? 'Your cart is empty!' : 'Seu carrinho está vazio!');
      return;
    }

    const validation = validateCartItems();
    if (!validation.isValid) {
      toast.error(validation.message);
      return;
    }

    if (!b2bName.trim() || !b2bResponsibleName.trim() || !b2bPhone.trim() || !b2bAddress.trim() || !b2bZipCode.trim() || !b2bCity.trim() || !b2bDate) {
      toast.error('Please fill in all required fields!');
      return;
    }

    const orderItems = cart.map(item => {
      const product = products.find(p => p.id === item.productId)!;
      let titleStr = item.selectedSize ? `${product.title} (${item.selectedSize.name})` : product.title;
      if (item.cakeOptions) {
        const parts = [];
        if (item.cakeOptions.size) parts.push(`Size: ${item.cakeOptions.size}`);
        if (item.cakeOptions.dough) parts.push(`Dough: ${item.cakeOptions.dough}`);
        if (item.cakeOptions.fillings && item.cakeOptions.fillings.length > 0) parts.push(`Fillings: ${item.cakeOptions.fillings.join(' + ')}`);
        if (item.cakeOptions.topping) parts.push(`Topping: ${item.cakeOptions.topping}`);
        if (item.cakeOptions.topper) parts.push(`Topper: ${item.cakeOptions.topper}`);
        if (item.cakeOptions.styleNumber) parts.push(`Estilo nº ${item.cakeOptions.styleNumber}`);
        titleStr += ` [${parts.join(', ')}]`;
      }
      if (item.sandwichOptions) {
        const parts = [];
        if (item.sandwichOptions.fillings && item.sandwichOptions.fillings.length > 0) parts.push(`${settings.language === 'en' ? 'State' : 'Estado'}: ${item.sandwichOptions.fillings.join(' + ')}`);
        titleStr += ` [${parts.join(', ')}]`;
      }
      return {
        title: titleStr,
        quantity: item.quantity,
        price: 0,
        priceType: 'consult'
      };
    });

    const b2bOrderObj = {
      customerName: b2bName,
      phone: b2bPhone,
      address: b2bAddress,
      zipCode: b2bZipCode,
      city: b2bCity,
      pickupDate: b2bDate ? (() => {
        const [year, month, day] = b2bDate.split('-');
        return `${day}/${month}/${year}`;
      })() : '',
      birthday: '',
      observation: b2bObservation,
      email: '',
      items: orderItems,
      total: 0,
      createdAt: serverTimestamp(),
      orderLanguage: 'en',
      isB2B: true,
      isPJ: true,
      b2bManagerName: b2bResponsibleName,
      b2bFrequency: b2bFrequency,
      b2bCompanyName: b2bName,
      b2bAddress: b2bAddress,
      b2bZipCode: b2bZipCode,
      b2bCity: b2bCity
    };

    try {
      console.log('Sending corporate B2B order request...', b2bOrderObj);
      await addDoc(collection(db, 'pedidos'), b2bOrderObj);
      
      // Persist client details in localStorage so it autofills on subsequent visits!
      localStorage.setItem('b2b_profile_save', JSON.stringify({
        name: b2bName,
        manager: b2bResponsibleName,
        phone: b2bPhone,
        address: b2bAddress,
        zipCode: b2bZipCode,
        city: b2bCity
      }));
      setIsReturningB2b(true);

      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
      const dateStr = now.toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo' });

      let message = `*Corporate Order Request - ${settings.brandName || settings.slug}*\n`;
      message += `*Date:* ${dateStr} at ${timeStr}\n\n`;
      message += `*--- COMPANY DETAILS ---*\n`;
      message += `*Company Name:* ${b2bName}\n`;
      message += `*Contact Manager:* ${b2bResponsibleName}\n`;
      message += `*Phone:* ${b2bPhone}\n`;
      message += `*Delivery Address:* ${b2bAddress}\n`;
      message += `*Zip Code:* ${b2bZipCode}\n`;
      message += `*City:* ${b2bCity}\n`;
      message += `*Frequency:* ${b2bFrequency === 'weekly' ? 'Weekly Contract (Recurring)' : 'One-Time Order (Spot)'}\n`;
      message += `*Target Start Date:* ${b2bOrderObj.pickupDate}\n`;
      if (b2bObservation) {
        message += `*Notes:* ${b2bObservation}\n`;
      }
      message += `\n*--- ORDERED ITEMS ---*\n`;
      orderItems.forEach(item => {
        message += `• ${item.quantity}x ${item.title}\n`;
      });
      message += `\n${settings.whatsappClosingMessage || 'Obrigada pelo pedido, aguarde que entraremos em contato para confirmação!'}\n`;
      
      const encodedMessage = encodeURIComponent(message);
      const cleanPhone = getCleanWhatsAppPhone(settings.whatsappNumber || '', settings.whatsappCountryCode || '+55');

      if (!cleanPhone) {
        toast.error('Representative contact number is not fully configured in the Admin panel.');
        return;
      }

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const whatsappUrl = isIOS 
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`
        : `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

      // Save URLs and go to success channels page
      setB2bSuccessUrls({ whatsapp: whatsappUrl });
      setCheckoutStep('b2b_channels');
      setHasRedirected(false);
      toast.success('Corporate order saved! Choose how you would like to submit below.');
    } catch (error) {
      console.error('Error saving B2B corporate order details:', error);
      toast.error('Failed to submit corporate request. Please verify and try again.');
    }
  };

  if (activeScreen === 'intro') {
    return (
      <div className="flex-grow flex flex-col items-center justify-center min-h-screen p-4 select-none">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="glass max-w-sm w-full rounded-3xl p-6 sm:p-8 border border-white/20 shadow-[0_-12px_28px_rgba(0,0,0,0.08),0_18px_36px_rgba(0,0,0,0.12)] flex flex-col items-center text-center space-y-6 sm:space-y-8"
        >
          {/* Logo Frame */}
          <div className="relative mt-2">
            <div 
              className="w-[160px] h-[160px] rounded-full p-1 bg-white shadow-md flex items-center justify-center overflow-hidden border-2"
              style={{ borderColor: settings.primaryColor }}
            >
              <img 
                src={settings.logo} 
                alt="Logo" 
                className="w-full h-full object-cover rounded-full"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          {/* Texts Section */}
          <div className="space-y-3">
            <h1 
              className="text-3xl font-bold italic tracking-tight"
              style={{ fontFamily: "'Libre Baskerville', Baskerville, Georgia, serif", fontWeight: 700, color: settings.primaryColor || '#865d39' }}
            >
              {renderTitle(settings.introTitle || settings.brandName || 'Grão & Sabor')}
            </h1>
            
            <div className="flex items-center justify-center gap-3 py-1">
              <div className="h-[1px] w-12 bg-black/15" />
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: settings.primaryColor }} />
              <div className="h-[1px] w-12 bg-black/15" />
            </div>

            <p 
              className="text-2xl sm:text-3xl font-script font-normal py-0.5"
              style={{ color: settings.textColor || '#522f19' }}
            >
              {settings.introSubtitle || 'Cardápio Especial'}
            </p>
            
            <p 
              className="text-sm font-medium opacity-80 italic max-w-xs mx-auto"
              style={{ color: settings.textColor || '#522f19' }}
            >
              {settings.introDescription || 'Acesse nossos produtos artesanais, novidades e faça seu pedido com praticidade.'}
            </p>
          </div>

          {/* CTA Button */}
          <div className="w-full pt-2 space-y-3">
            <button
              onClick={() => {
                setActiveScreen('selector');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="w-full py-4 px-6 rounded-full font-bold text-sm tracking-widest uppercase shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              style={{ backgroundColor: settings.primaryColor, color: getContrastText(settings.primaryColor) }}
            >
              {settings.introButtonText || 'ACESSAR NOSSO CARDÁPIO'}
            </button>

            <p 
              className="text-[10px] font-mono font-bold tracking-widest opacity-60 uppercase pt-2"
              style={{ color: settings.textColor || '#522f19' }}
            >
              {settings.introBottomText || 'GRÃO & SABOR'}
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (activeScreen === 'selector') {
    const catalogsList = [
      {
        id: 'catalog1' as const,
        title: settings.catalog1Title || 'Cardápio Principal',
        desc: settings.catalog1Desc || 'Nossos produtos e opções exclusivas.',
        image: settings.catalog1Image || settings.logo,
        active: settings.catalog1Active !== false,
      },
      {
        id: 'catalog2' as const,
        title: settings.catalog2Title || 'Doces & Sobremesas',
        desc: settings.catalog2Desc || 'Bolos, tortas e sobremesas deliciosas.',
        image: settings.catalog2Image || 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&auto=format&fit=crop&q=80',
        active: settings.catalog2Active !== false,
      },
      {
        id: 'catalog3' as const,
        title: settings.catalog3Title || 'Cafés & Bebidas',
        desc: settings.catalog3Desc || 'Cafés especiais e sucos naturais.',
        image: settings.catalog3Image || 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop&q=80',
        active: settings.catalog3Active !== false,
      },
      {
        id: 'catalog4' as const,
        title: settings.catalog4Title || 'Lanches & Salgados',
        desc: settings.catalog4Desc || 'Salgados assados e sanduíches.',
        image: settings.catalog4Image || 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&auto=format&fit=crop&q=80',
        active: settings.catalog4Active !== false,
      },
      {
        id: 'catalog5' as const,
        title: settings.catalog5Title || 'Linha Fit & Saudável',
        desc: settings.catalog5Desc || 'Opções nutritivas e sem açúcar.',
        image: settings.catalog5Image || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80',
        active: settings.catalog5Active !== false,
      },
      {
        id: 'catalog6' as const,
        title: settings.catalog6Title || 'Encomendas & Eventos',
        desc: settings.catalog6Desc || 'Combos para festas e eventos.',
        image: settings.catalog6Image || 'https://images.unsplash.com/photo-1555244162-803834f70033?w=600&auto=format&fit=crop&q=80',
        active: settings.catalog6Active !== false,
      },
    ];

    return (
      <div className="flex-grow flex flex-col items-center justify-center min-h-screen p-4 select-none">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          className="w-full max-w-lg flex flex-col items-center space-y-4 sm:space-y-6 py-4 sm:py-8"
        >
          {/* Circular Header Logo (Aumentado em 30% a pedido do usuário) */}
          <div className="relative">
            <div 
              className="w-36 h-36 sm:w-48 sm:h-48 rounded-full p-1.5 flex items-center justify-center overflow-hidden border-2 flex-shrink-0 bg-white shadow-xl"
              style={{ borderColor: settings.primaryColor || '#865d39' }}
            >
              <img 
                src={settings.logo} 
                alt="Logo" 
                className="w-full h-full object-cover rounded-full"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          {/* Title & Subtitle */}
          <div className="text-center space-y-1">
            <h2 
              className="text-3xl sm:text-4xl font-bold italic tracking-tight text-center" 
              style={{ fontFamily: "'Libre Baskerville', Baskerville, Georgia, serif", fontWeight: 700, color: settings.primaryColor || '#865d39' }}
            >
              {settings.selectorTitle || settings.brandName || 'Grão & Sabor'}
            </h2>
            <p 
              className="text-[11px] sm:text-xs font-bold tracking-[0.25em] uppercase opacity-85 text-center" 
              style={{ color: settings.primaryColor || '#865d39' }}
            >
              {settings.selectorSubtitle || 'ESCOLHA SEU CARDÁPIO'}
            </p>
          </div>

          {/* 6 Cards Grid - Box aumentado em 20% somente na vertical conforme Imagem 1 */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3.5 w-full max-w-lg mx-auto mt-3">
            {catalogsList.filter(c => c.active).map(cat => (
              <motion.div
                key={cat.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setSelectedCatalog(cat.id);
                  setActiveScreen('menu');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="flex flex-col items-center justify-start cursor-pointer group select-none rounded-2xl sm:rounded-3xl p-1.5 sm:p-2.5 pt-2 sm:pt-2.5 pb-3.5 sm:pb-4 min-h-[190px] sm:min-h-[225px] transition-all shadow-sm hover:shadow-md border border-[#e8ded2]/90 bg-[#f5eee6]/90 backdrop-blur-xs"
              >
                {/* Container da imagem preenchendo todo o campo sem fundo/borda branca */}
                <div className="w-full aspect-[1/1.2] rounded-xl sm:rounded-2xl overflow-hidden shadow-xs border border-black/5">
                  <img 
                    src={cat.image} 
                    alt={cat.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Título do menu com fonte 20% maior e sempre alinhado ao topo próximo à imagem */}
                <div className="w-full flex flex-col items-center justify-start mt-2 sm:mt-2.5 flex-1">
                  <span 
                    className="text-[13px] sm:text-[14.5px] font-serif font-bold text-center leading-snug line-clamp-2 px-0.5"
                    style={{ fontFamily: "'Libre Baskerville', Baskerville, Georgia, serif", color: settings.primaryColor || '#865d39' }}
                  >
                    {cat.title}
                  </span>

                  {/* Subtítulo / descrição dentro do box */}
                  {cat.desc && (
                    <span className="mt-1 text-[8.5px] sm:text-[9.5px] text-neutral-600/80 text-center leading-tight line-clamp-2 px-0.5 font-sans font-medium">
                      {cat.desc}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  if (loading && activeScreen === 'menu') {
    return (
      <div className="flex-grow flex flex-col items-center justify-center min-h-[50vh] p-4 text-center select-none">
        <div 
          className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" 
          style={{ borderColor: settings.primaryColor }}
        />
        <p className="mt-4 font-sans font-semibold text-sm text-black/60">
          {settings.language === 'en' ? 'Loading catalog...' : 'Carregando catálogo...'}
        </p>
      </div>
    );
  }

  const filteredCategories = categories.filter(category => {
    const cat = category.catalog || 'catalog1';
    
    // If a category belongs specifically to b2b/corporate, hide it from normal catalogs
    if (cat === 'catalog_b2b' || cat === 'b2b') {
      return false;
    }
    
    if (selectedCatalog) {
      if (cat === 'both' || cat === 'all' || cat === selectedCatalog) return true;
      const hasProductInCatalog = products.some(p => 
        p.isActive !== false && 
        !p.hideIndividual && 
        (p.categoryId === category.id || p.secondaryCategoryId === category.id) &&
        (p.catalogs?.includes(selectedCatalog) || p.catalog === selectedCatalog || p.catalog === 'all' || p.catalog === 'both')
      );
      return hasProductInCatalog;
    }
    
    return true;
  });

  const currentCatalogImage = 
    selectedCatalog === 'catalog1' ? (settings.catalog1Image || settings.logo) :
    selectedCatalog === 'catalog2' ? (settings.catalog2Image || 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&auto=format&fit=crop&q=80') :
    selectedCatalog === 'catalog3' ? (settings.catalog3Image || 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop&q=80') :
    selectedCatalog === 'catalog4' ? (settings.catalog4Image || 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&auto=format&fit=crop&q=80') :
    selectedCatalog === 'catalog5' ? (settings.catalog5Image || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80') :
    selectedCatalog === 'catalog6' ? (settings.catalog6Image || 'https://images.unsplash.com/photo-1555244162-803834f70033?w=600&auto=format&fit=crop&q=80') :
    (settings.logo || 'https://raw.githubusercontent.com/easybyzcreator/imagens/fec01da426f25ac9e87c5339fd4d4820c7e334f4/logo%20grao%20e%20sabor.jpg');

  const currentCatalogTitle = 
    selectedCatalog === 'catalog1' ? (settings.catalog1Title || 'Cardápio Principal') :
    selectedCatalog === 'catalog2' ? (settings.catalog2Title || 'Doces & Sobremesas') :
    selectedCatalog === 'catalog3' ? (settings.catalog3Title || 'Cafés & Bebidas') :
    selectedCatalog === 'catalog4' ? (settings.catalog4Title || 'Lanches & Salgados') :
    selectedCatalog === 'catalog5' ? (settings.catalog5Title || 'Linha Fit & Saudável') :
    selectedCatalog === 'catalog6' ? (settings.catalog6Title || 'Encomendas & Eventos') :
    (settings.brandName || 'Grão & Sabor');

  return (
    <div className="flex-grow flex flex-col items-center p-4 pb-32">
      {/* Back button to 6-catalog selector - distância aumentada para o logo conforme Imagem 3 */}
      <div className="w-full max-w-2xl flex items-center justify-start mb-6 sm:mb-8 pt-1">
        <button 
          onClick={() => {
            setActiveScreen('selector');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-neutral-600 hover:text-neutral-900 bg-white/75 hover:bg-white shadow-xs border border-neutral-200/80 transition-all cursor-pointer hover:scale-105 active:scale-95"
        >
          <ArrowLeft size={13} className="opacity-70" /> Voltar aos cardápios
        </button>
      </div>

      {/* Circular Logo do catálogo aumentado em 50% */}
      <div className="mt-4 sm:mt-6 mb-5 relative">
        <div 
          className="w-[210px] h-[210px] sm:w-[240px] sm:h-[240px] rounded-full p-1.5 bg-white shadow-xl flex items-center justify-center overflow-hidden border-2"
          style={{ borderColor: settings.primaryColor || '#865d39' }}
        >
          <img 
            src={currentCatalogImage} 
            alt="Logo do Cardápio" 
            className="w-full h-full object-cover rounded-full"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>

      {/* Título do Cardápio em Baskerville - em negrito (Imagem 1 & 4) */}
      <h1 
        className="text-3xl sm:text-4xl font-bold italic mb-6 text-center tracking-tight" 
        style={{ fontFamily: "'Libre Baskerville', Baskerville, Georgia, serif", fontWeight: 700, color: settings.primaryColor || '#865d39' }}
      >
        {renderTitle(currentCatalogTitle)}
      </h1>

      {(() => {
        const text = selectedCatalog === 'catalog1'
          ? (settings.catalog1Slogan || settings.catalog1Desc || settings.slogan || '')
          : selectedCatalog === 'catalog2'
            ? (settings.catalog2Slogan || settings.catalog2Desc || settings.slogan || '')
            : selectedCatalog === 'catalog3'
              ? (settings.catalog3Slogan || settings.catalog3Desc || settings.slogan || '')
              : selectedCatalog === 'catalog4'
                ? (settings.catalog4Slogan || settings.catalog4Desc || settings.slogan || '')
                : selectedCatalog === 'catalog5'
                  ? (settings.catalog5Slogan || settings.catalog5Desc || settings.slogan || '')
                  : selectedCatalog === 'catalog6'
                    ? (settings.catalog6Slogan || settings.catalog6Desc || settings.slogan || '')
                    : (settings.slogan || 'O sabor que você merece, a um clique de distância.');

        if (text) {
          const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
          if (lines.length > 0) {
            return (
              <div className="flex flex-col items-center mb-10 max-w-sm mx-auto bg-white/70 backdrop-blur-md p-5 rounded-[2rem] border border-white/40 shadow-lg">
                <ul 
                  className="text-left space-y-2.5 text-xs font-sans font-semibold"
                  style={{ color: settings.textColor || 'rgba(0, 0, 0, 0.85)' }}
                >
                  {lines.map((line, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="shrink-0 select-none mt-0.5 text-sm" style={{ color: settings.primaryColor || '#865d39' }}>✦</span>
                      <span>{line.replace(/^[✦•\-*]\s*/, '')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          }
        }

        return null;
      })()}

      <div className="w-full max-w-2xl space-y-12">
        {filteredCategories.length > 0 ? (
          filteredCategories.map((category) => {
            const categoryProducts = products
              .filter(p => {
                if (p.isActive === false || p.hideIndividual) return false;
                const matchesCategory = p.categoryId === category.id || p.secondaryCategoryId === category.id;
                if (!matchesCategory) return false;
                if (selectedCatalog) {
                  if (p.catalogs && p.catalogs.length > 0) {
                    return p.catalogs.includes(selectedCatalog);
                  }
                  if (p.catalog) {
                    return p.catalog === 'all' || p.catalog === 'both' || p.catalog === selectedCatalog;
                  }
                  return category.catalog === 'both' || category.catalog === 'all' || category.catalog === selectedCatalog;
                }
                return true;
              })
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            if (categoryProducts.length === 0) return null;

            return (
              <div key={category.id} className="space-y-4">
                <div className="border-b border-black/10 pb-2">
                  <h2 className="text-xl sm:text-2xl font-serif font-black tracking-tight" style={{ color: settings.categoryTextColor || '#1A202C' }}>
                    {category.title}
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categoryProducts.map((product) => (
                    <AnimatedProductCard
                      key={product.id}
                      product={product}
                      category={category}
                      settings={settings}
                      cart={cart}
                      currencySymbol={currencySymbol}
                      onSelectProduct={(p) => {
                        setSelectedProductForDetails(p);
                        if (p.sizes && p.sizes.length > 0) {
                          setSelectedSize(p.sizes[0]);
                        } else {
                          setSelectedSize(null);
                        }
                      }}
                      onAddToCart={(p, qty) => addToCart(p, qty)}
                      onRemoveFromCart={(itemId) => removeFromCart(itemId)}
                      getContrastText={getContrastText}
                      onOpenNutritional={handleOpenNutritional}
                      onOpenCombo={handleOpenCombo}
                    />
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center p-12 opacity-60 glass rounded-2xl">
            {settings.language === 'en' ? 'No products found.' : 'Nenhum produto encontrado.'}
          </div>
        )}
      </div>

      {/* Botão pequeno e discreto no final de cada menu para voltar aos cardápios */}
      <div className="w-full max-w-2xl flex items-center justify-center pt-8 pb-3">
        <button 
          type="button"
          onClick={() => {
            setActiveScreen('selector');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-neutral-600 hover:text-neutral-900 bg-white/80 hover:bg-white shadow-xs border border-neutral-200/80 transition-all cursor-pointer hover:scale-105 active:scale-95"
        >
          <ArrowLeft size={13} className="opacity-70" /> Voltar aos cardápios
        </button>
      </div>

      <AnimatePresence>
        {cartItemsCount > 0 && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-6 left-4 right-4 max-w-2xl mx-auto z-40 space-y-1.5"
          >
            {settings.minOrderEnabled && settings.minOrderValue && settings.minOrderValue > 0 && cartTotal < settings.minOrderValue && (
              <div className="bg-amber-950/90 text-amber-200 backdrop-blur-md px-4 py-1.5 rounded-xl text-center text-xs font-bold shadow-lg border border-amber-500/40 flex items-center justify-center gap-1.5">
                <span></span>
                <span>Pedido mínimo: {currencySymbol} {settings.minOrderValue.toFixed(2).replace('.', ',')} (Faltam {currencySymbol} {(settings.minOrderValue - cartTotal).toFixed(2).replace('.', ',')})</span>
              </div>
            )}
            <button 
              onClick={() => setIsModalOpen(true)}
              className="w-full h-16 rounded-2xl shadow-2xl flex items-center justify-between px-6 font-bold text-lg transition-transform active:scale-95 cursor-pointer"
              style={{ backgroundColor: settings.primaryColor, color: getContrastText(settings.primaryColor) }}
            >
              <div className="flex items-center gap-3 font-serif">
                <ShoppingBag size={24} />
                <span>{settings.language === 'en' ? 'View Order' : 'Ver Pedido'}</span>
              </div>
              <div className="flex items-center gap-2 font-serif text-sm">
                <span className="bg-white/20 px-2.5 py-1 rounded-full">{cartItemsCount} {cartItemsCount === 1 ? 'item' : 'itens'}</span>
                <span>{currencySymbol}{cartTotal.toFixed(2)}</span>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsModalOpen(false);
                setCheckoutStep('summary');
              }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg bg-[#ece6db] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] force-dark-headings"
            >
              <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setCheckoutStep('summary');
                      const menuEl = document.getElementById('menu-items') || document.querySelector('main');
                      if (menuEl) menuEl.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="p-1.5 sm:p-2 hover:bg-black/5 rounded-full text-black transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer shrink-0"
                    title="Voltar ao Cardápio"
                  >
                    <ArrowLeft size={20} />
                    <span className="hidden sm:inline">Voltar ao Cardápio</span>
                  </button>
                  <h2 className="text-lg sm:text-2xl font-serif font-bold truncate" style={{ color: '#000000' }}>
                    {checkoutStep === 'summary' ? t.cartTitle : t.finish}
                  </h2>
                </div>
                <button 
                  onClick={() => {
                    setIsModalOpen(false);
                    setCheckoutStep('summary');
                  }} 
                  className="p-2 hover:bg-gray-100 rounded-full cursor-pointer shrink-0"
                  style={{ color: '#000000' }}
                  title="Fechar"
                >
                  <X size={22} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                {checkoutStep === 'summary' ? (
                  cart.length === 0 ? (
                    <div className="text-center py-12 space-y-5">
                      <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center mx-auto text-2xl shadow-inner">
                        
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-lg font-serif font-bold text-black">Seu carrinho está vazio</h3>
                        <p className="text-xs text-black/60">Escolha os produtos do cardápio para fazer seu pedido.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsModalOpen(false);
                          const menuEl = document.getElementById('menu-items') || document.querySelector('main');
                          if (menuEl) menuEl.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="px-6 py-3.5 rounded-xl font-bold text-sm text-white shadow-md transition-all inline-flex items-center gap-2 hover:brightness-110 cursor-pointer active:scale-95"
                        style={{ backgroundColor: settings.primaryColor || '#424733', color: getContrastText(settings.primaryColor || '#424733') }}
                      >
                        <ArrowLeft size={18} /> Voltar ao Cardápio
                      </button>
                    </div>
                  ) : (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      {cart.map((item) => {
                        const product = products.find(p => p.id === item.productId);
                        if (!product) return null;
                        return (
                          <div key={item.id} className="bg-white/95 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-black/5 w-full flex flex-col gap-3 shadow-xs">
                            {/* Topo do card: Nome do prato */}
                            <div className="border-b border-black/5 pb-2">
                              <h4 className="font-serif font-bold text-sm sm:text-base text-gray-950 leading-snug break-words">
                                {product.title}
                              </h4>
                            </div>

                            {/* Meio: Imagem + Descrição ampla e opções do item */}
                            <div className="flex items-start gap-3 w-full">
                              <img 
                                src={product.image} 
                                alt={product.title} 
                                className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover shrink-0 bg-white shadow-xs border border-black/5" 
                              />
                              <div className="flex flex-col flex-1 min-w-0 gap-1.5">
                                {item.selectedSize && (
                                  <span className="inline-block bg-[#ffedd5] text-[#7c2d12] text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md leading-none border border-[#fed7aa] w-fit">
                                    {item.selectedSize.name}
                                  </span>
                                )}

                                {product.description && (
                                  <p 
                                    className="text-xs leading-relaxed line-clamp-3"
                                    style={{ color: settings.textColor || 'rgba(55, 65, 81, 0.85)' }}
                                  >
                                    {product.description}
                                  </p>
                                )}

                                {item.comboSelections && item.comboSelections.length > 0 && (
                                  <div className="bg-amber-500/10 p-2 sm:p-2.5 rounded-xl border border-amber-500/20 text-[11px] space-y-1 text-black">
                                    <span className="font-bold text-amber-950 block text-[10.5px] uppercase tracking-wider">
                                      Itens Escolhidos no Combo ({item.comboSelections.reduce((acc, c) => acc + (c.quantity ?? c.count ?? 1), 0)} un):
                                    </span>
                                    {item.comboSelections.map((sel, idx) => (
                                      <div key={idx} className="text-neutral-800 text-[11px] flex items-center justify-between">
                                        <span>• {sel.dishTitle}</span>
                                        <span className="font-bold text-amber-900 ml-1">{(sel.quantity ?? sel.count ?? 1)}x</span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {item.mealOptions && (
                                  <div className="text-[10px] sm:text-[11px] leading-relaxed text-black/70 break-words w-full">
                                    {item.mealOptions.removals.length > 0 && `Exclude: ${item.mealOptions.removals.join(', ')}`}
                                    {item.mealOptions.removals.length > 0 && item.mealOptions.sides.length > 0 && ' • '}
                                    {item.mealOptions.sides.length > 0 && (() => {
                                      const normalSidesArr = item.mealOptions.sides.filter(s => s.type !== 'swap');
                                      const swapSidesArr = item.mealOptions.sides.filter(s => s.type === 'swap');
                                      
                                      const formatter = (arr: any[]) => Object.entries(arr.reduce((acc: Record<string, number>, s) => { 
                                        acc[s.name] = (acc[s.name] || 0) + 1; 
                                        return acc; 
                                      }, {})).map(([name, qty]) => `${name}${Number(qty) > 1 ? ` (${qty}x)` : ''}`).join(', ');

                                      const listParts = [];
                                      if (normalSidesArr.length > 0) {
                                        listParts.push(`Sides: ${formatter(normalSidesArr)}`);
                                      }
                                      if (swapSidesArr.length > 0) {
                                        listParts.push(`Swaps: ${formatter(swapSidesArr)}`);
                                      }
                                      return listParts.join(' • ');
                                    })()}
                                  </div>
                                )}

                                {item.cakeOptions && (
                                  <div className="text-[10px] sm:text-[11px] leading-tight space-y-0.5 text-black/70 break-words w-full">
                                    {item.cakeOptions.size && (
                                      <div>Size: <span className="font-bold text-black">{item.cakeOptions.size}</span></div>
                                    )}
                                    {item.cakeOptions.dough && (
                                      <div>Dough: <span className="font-bold text-black">{item.cakeOptions.dough}</span></div>
                                    )}
                                    {item.cakeOptions.fillings && item.cakeOptions.fillings.length > 0 && (
                                      <div>Filling: <span className="font-bold text-black">{item.cakeOptions.fillings.join(' + ')}</span></div>
                                    )}
                                    {item.cakeOptions.topping && (
                                      <div>Topping: <span className="font-bold text-black">{item.cakeOptions.topping}</span></div>
                                    )}
                                    {item.cakeOptions.topper && (
                                      <div>Topper: <span className="font-bold text-black">{item.cakeOptions.topper}</span></div>
                                    )}
                                    {item.cakeOptions.styleNumber && (
                                      <div>Cake Reference: <span className="font-bold text-black">Photo No. {item.cakeOptions.styleNumber}</span></div>
                                    )}
                                  </div>
                                )}
                                {item.sandwichOptions && (
                                  <div className="text-[10px] sm:text-[11px] leading-tight space-y-0.5 text-black/70 break-words w-full">
                                    {item.sandwichOptions.fillings && item.sandwichOptions.fillings.length > 0 && (
                                      <div>{settings.language === 'en' ? 'State' : 'Estado'}: <span className="font-bold text-black">{item.sandwichOptions.fillings.join(' + ')}</span></div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Rodapé do card: Preço à esquerda e Botões + / - no canto direito inferior */}
                            <div className="flex items-center justify-between pt-2.5 border-t border-black/5 mt-0.5">
                              <div>
                                {(product.isCustomCake || product.priceType === 'consult') ? (
                                  <span className="text-[10px] uppercase font-serif font-black tracking-wider px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-950 border border-amber-500/20">
                                    {settings.language === 'en' ? 'On Request' : 'A Consultar'}
                                  </span>
                                ) : item.selectedSize ? (
                                  <div className="flex items-baseline gap-1.5">
                                    {Boolean(item.selectedSize.oldPrice && item.selectedSize.oldPrice > 0) && (
                                      <span className="text-[10px] line-through opacity-40">
                                        {currencySymbol}{item.selectedSize.oldPrice!.toFixed(2)}
                                      </span>
                                    )}
                                    <span className="text-sm sm:text-base font-serif font-bold text-gray-950">
                                      {currencySymbol}{((item.selectedSize.price + (item.mealOptions?.sides.reduce((sum, s) => sum + s.price, 0) || 0)) * item.quantity).toFixed(2)}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-baseline gap-1.5">
                                    {Boolean(product.price && product.price > 0 && product.oldPrice && product.oldPrice > 0) && (
                                      <span className="text-[10px] line-through opacity-40">
                                        {currencySymbol}{product.oldPrice!.toFixed(2)}
                                      </span>
                                    )}
                                    <span className="text-sm sm:text-base font-serif font-bold text-gray-950">
                                      {currencySymbol}{(((product.price && product.price > 0 ? product.price : (product.oldPrice || 0)) + (item.mealOptions?.sides.reduce((sum, s) => sum + s.price, 0) || 0)) * item.quantity).toFixed(2)}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Teclas de + e - no canto direito inferior do card */}
                              <div className="flex items-center gap-1.5 bg-neutral-100 border border-neutral-200/80 rounded-full p-1 shadow-2xs">
                                <button 
                                  onClick={() => removeFromCart(item.id)}
                                  className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-xs border border-gray-200 active:scale-90 transition-all select-none hover:bg-gray-50 cursor-pointer"
                                  title="Diminuir quantidade"
                                >
                                  <Minus size={13} className="text-gray-900" />
                                </button>
                                <span className="font-bold text-xs sm:text-sm text-gray-950 min-w-[18px] text-center">
                                  {item.quantity}
                                </span>
                                <button 
                                  onClick={() => {
                                    setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
                                  }}
                                  className="w-7 h-7 rounded-full flex items-center justify-center shadow-xs font-bold active:scale-90 transition-all select-none hover:brightness-110 cursor-pointer"
                                  style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}
                                  title="Aumentar quantidade"
                                >
                                  <Plus size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="pt-4 border-t border-gray-200 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold" style={{ color: '#000000' }}>{t.total}</span>
                        <span className="text-2xl font-bold" style={{ color: settings.priceColor || '#000000' }}>
                          {currencySymbol}{cartTotal.toFixed(2)}
                        </span>
                      </div>
                      {cart.some(item => {
                        const p = products.find(prod => prod.id === item.productId);
                        return p?.priceType === 'consult' || p?.isCustomCake === true;
                      }) && (
                        <div className="p-3 rounded-xl bg-yellow-50 border border-yellow-100 text-[10px] text-yellow-800 font-medium">
                          {t.consultMessage}
                        </div>
                      )}
                    </div>

                    {/* Validação de Valor Mínimo e Itens (Identicamente como na Imagem 2) */}
                    {(() => {
                      const isMinOrderActive = settings.minOrderEnabled && !!settings.minOrderValue && settings.minOrderValue > 0;
                      const isBelowMin = isMinOrderActive && cartTotal < (settings.minOrderValue || 0);
                      const minVal = settings.minOrderValue || 0;
                      const diff = isBelowMin ? minVal - cartTotal : 0;
                      const pct = isMinOrderActive && minVal > 0 
                        ? Math.min(100, Math.round((cartTotal / minVal) * 100)) 
                        : 100;

                      if (isBelowMin) {
                        return (
                          <div className="p-4 mb-3 rounded-2xl bg-[#fffef5] border border-amber-300 shadow-xs space-y-2.5 text-left animate-fade-in">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-extrabold text-xs sm:text-sm text-[#4a2e18] tracking-tight uppercase">
                                PEDIDO MÍNIMO: {currencySymbol} {minVal.toFixed(2).replace('.', ',')}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#fef3c7] text-[#92400e] border border-amber-300 shadow-2xs">
                                 Pedido Mínimo
                              </span>
                            </div>
                            <p className="text-xs text-[#78350f] font-medium leading-relaxed">
                              O valor mínimo para realizar o pedido é de {currencySymbol} {minVal.toFixed(2).replace('.', ',')}.
                            </p>
                            {/* Barra de Progresso Laranja */}
                            <div className="w-full bg-amber-100 rounded-full h-2.5 overflow-hidden">
                              <div 
                                className="bg-[#ea580c] h-full rounded-full transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-xs font-bold text-[#4a2e18] pt-0.5">
                              <span>Faltam para o mínimo: {currencySymbol} {diff.toFixed(2).replace('.', ',')}</span>
                              <span className="font-extrabold">{pct}%</span>
                            </div>
                          </div>
                        );
                      }

                      const validation = validateCartItems();
                      if (!validation.isValid && !validation.isMinOrder) {
                        return (
                          <div className="p-3.5 mb-2 rounded-2xl text-xs font-bold flex items-center gap-2.5 leading-relaxed text-left border shadow-sm bg-red-50 border-red-200 text-red-800">
                            <span className="text-base">⚠️</span>
                            <div className="flex-1">
                              <span className="block">{validation.message}</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Botões do Carrinho (Exatamente como Imagem 2) */}
                    <div className="space-y-2.5 pt-1">
                      {settings.minOrderEnabled && !!settings.minOrderValue && cartTotal < settings.minOrderValue ? (
                        /* Botão 1: Bloqueado informando quanto falta (Imagem 2) */
                        <div
                          className="w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-[#e2e6ea] text-slate-600 flex items-center justify-center gap-2 cursor-not-allowed select-none shadow-xs text-center"
                        >
                          <Lock size={16} className="text-amber-700" />
                          <span>Mínimo {currencySymbol} {settings.minOrderValue.toFixed(2).replace('.', ',')} (Faltam {currencySymbol} {(settings.minOrderValue - cartTotal).toFixed(2).replace('.', ',')})</span>
                        </div>
                      ) : (
                        /* Botão 1: Liberado para avançar ao checkout */
                        <button 
                          onClick={() => {
                            const validation = validateCartItems();
                            if (!validation.isValid) {
                              toast.error(validation.message);
                              return;
                            }
                            if (checkMarmitifyLimit()) {
                              setCheckoutStep('form');
                            }
                          }}
                          className="w-full py-3.5 rounded-xl font-bold text-base shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-white"
                          style={{ backgroundColor: settings.primaryColor || '#424733', color: getContrastText(settings.primaryColor || '#424733') }}
                        >
                          {t.next}
                        </button>
                      )}

                      {/* Botão 2: Retornar ao Cardápio (Exatamente como Imagem 2) */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsModalOpen(false);
                          const menuEl = document.getElementById('menu-items') || document.querySelector('main');
                          if (menuEl) {
                            menuEl.scrollIntoView({ behavior: 'smooth' });
                          }
                        }}
                        className="w-full py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 hover:brightness-110"
                        style={{ 
                          backgroundColor: settings.primaryColor || '#424733',
                          color: getContrastText(settings.primaryColor || '#424733')
                        }}
                      >
                        <ArrowLeft size={16} /> Voltar ao Cardápio (Adicionar mais itens)
                      </button>
                    </div>
                  </div>
                ) ) : checkoutStep === 'channels' ? (
                  <div className="space-y-6 text-center py-4 font-sans text-black animate-fade-in">
                    <div className="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-1">
                      <Check size={36} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-serif font-black uppercase tracking-wide text-black">
                        PEDIDO SALVO!
                      </h3>
                      <p className="text-xs font-semibold text-black/60 max-w-sm mx-auto">
                        Os detalhes do seu pedido foram registrados com sucesso.
                      </p>
                    </div>

                    {!hasRedirected ? (
                      <>
                        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-950 font-medium text-xs font-sans text-left leading-relaxed">
                          Para finalizar e enviar seu pedido, selecione o botão de envio por mensagem abaixo para entrar em contato diretamente com o nosso representante:
                        </div>

                        <div className="grid grid-cols-1 gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              const url = standardSuccessUrls?.whatsapp || '#';
                              try {
                                const win = window.open(url, '_blank');
                                if (!win || win.closed || typeof win.closed === 'undefined') {
                                  window.location.href = url;
                                }
                              } catch (e) {
                                window.location.href = url;
                              }
                              setHasRedirected(true);
                            }}
                            className="flex items-center justify-center gap-3 w-full py-4 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold font-sans text-sm shadow-md transition-all active:scale-95 cursor-pointer border-0 text-center"
                          >
                            <MessageCircle size={18} />
                            <span>Enviar Pedido por WhatsApp</span>
                          </button>
                        </div>

                        <button 
                          type="button"
                          onClick={() => {
                            setCheckoutStep('form');
                            setStandardSuccessUrls(null);
                          }}
                          className="text-xs font-bold text-gray-500 hover:text-black hover:underline mt-4 uppercase tracking-wider block mx-auto cursor-pointer"
                        >
                          Voltar para os detalhes
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-950 font-medium text-xs font-sans text-left leading-relaxed space-y-2">
                          <p className="font-bold text-sm text-green-800">Seu pedido foi direcionado ao WhatsApp!</p>
                          <p>Se o chat abriu corretamente e você já enviou a mensagem, você pode concluir e limpar o seu carrinho de compras agora.</p>
                          <p className="text-amber-700">Se por acaso o número do WhatsApp estiver incorreto ou houver algum outro problema, clique em "Voltar e Ajustar" para tentar novamente sem perder os dados!</p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              handleCompleteStandardOrder();
                            }}
                            className="flex items-center justify-center gap-3 w-full py-4 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold font-sans text-sm shadow-md transition-all active:scale-95 cursor-pointer border-0 text-center"
                          >
                            <Check size={18} />
                            <span>Sim, Limpar Carrinho e Concluir</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const url = standardSuccessUrls?.whatsapp || '#';
                              try {
                                const win = window.open(url, '_blank');
                                if (!win || win.closed || typeof win.closed === 'undefined') {
                                  window.location.href = url;
                                }
                              } catch (e) {
                                window.location.href = url;
                              }
                            }}
                            className="flex items-center justify-center gap-3 w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold font-sans text-xs shadow-sm transition-all active:scale-95 cursor-pointer border-0 text-center"
                          >
                            <MessageCircle size={14} />
                            <span>Tentar Enviar Novamente</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setHasRedirected(false);
                            }}
                            className="text-xs font-bold text-gray-500 hover:text-black hover:underline mt-2 uppercase tracking-wider block mx-auto cursor-pointer"
                          >
                            Voltar e Ajustar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : checkoutStep === 'b2b_channels' ? (
                  <div className="space-y-6 text-center py-4 font-sans text-black animate-fade-in">
                    <div className="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-1">
                      <Check size={36} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-serif font-black uppercase tracking-wide text-black">
                        PEDIDO SALVO!
                      </h3>
                      <p className="text-xs font-semibold text-black/60 max-w-sm mx-auto">
                        Os detalhes do seu pedido corporativo foram registrados com sucesso.
                      </p>
                    </div>

                    {!hasRedirected ? (
                      <>
                        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-950 font-medium text-xs font-sans text-left leading-relaxed">
                          Para finalizar e enviar seu pedido, selecione o botão de envio por mensagem abaixo para entrar em contato diretamente com o nosso representante:
                        </div>

                        <div className="grid grid-cols-1 gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              const url = b2bSuccessUrls?.whatsapp || '#';
                              try {
                                const win = window.open(url, '_blank');
                                if (!win || win.closed || typeof win.closed === 'undefined') {
                                  window.location.href = url;
                                }
                              } catch (e) {
                                window.location.href = url;
                              }
                              setHasRedirected(true);
                            }}
                            className="flex items-center justify-center gap-3 w-full py-4 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold font-sans text-sm shadow-md transition-all active:scale-95 cursor-pointer border-0 text-center"
                          >
                            <MessageCircle size={18} />
                            <span>Enviar Pedido por WhatsApp</span>
                          </button>
                        </div>

                        <button 
                          type="button"
                          onClick={() => {
                            setCheckoutStep('form');
                            setB2bSuccessUrls(null);
                          }}
                          className="text-xs font-bold text-gray-500 hover:text-black hover:underline mt-4 uppercase tracking-wider block mx-auto cursor-pointer"
                        >
                          Voltar para os detalhes
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-950 font-medium text-xs font-sans text-left leading-relaxed space-y-2">
                          <p className="font-bold text-sm text-green-800">Seu pedido foi direcionado ao WhatsApp!</p>
                          <p>Se o chat abriu corretamente e você já enviou a mensagem, você pode concluir e limpar o seu carrinho corporativo de compras agora.</p>
                          <p className="text-amber-700">Se por acaso o número do WhatsApp estiver incorreto ou houver algum outro problema, clique em "Voltar e Ajustar" para tentar novamente sem perder os dados!</p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              handleCompleteB2bOrder();
                            }}
                            className="flex items-center justify-center gap-3 w-full py-4 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold font-sans text-sm shadow-md transition-all active:scale-95 cursor-pointer border-0 text-center"
                          >
                            <Check size={18} />
                            <span>Sim, Limpar Carrinho e Concluir</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const url = b2bSuccessUrls?.whatsapp || '#';
                              try {
                                const win = window.open(url, '_blank');
                                if (!win || win.closed || typeof win.closed === 'undefined') {
                                  window.location.href = url;
                                }
                              } catch (e) {
                                window.location.href = url;
                              }
                            }}
                            className="flex items-center justify-center gap-3 w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold font-sans text-xs shadow-sm transition-all active:scale-95 cursor-pointer border-0 text-center"
                          >
                            <MessageCircle size={14} />
                            <span>Tentar Enviar Novamente</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setHasRedirected(false);
                            }}
                            className="text-xs font-bold text-gray-500 hover:text-black hover:underline mt-2 uppercase tracking-wider block mx-auto cursor-pointer"
                          >
                            Voltar e Ajustar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : false ? (
                  <div className="space-y-6">
                    <div className="text-center space-y-1">
                      <h3 className="text-xl font-serif font-black uppercase tracking-wide" style={{ color: settings.primaryColor }}>
                        Corporate Order Details
                      </h3>
                      <p className="text-xs font-semibold text-black/60 font-sans max-w-sm mx-auto">
                        Enter your company details to apply your agreed pricing and send your order.
                      </p>
                    </div>

                    {isReturningB2b && (
                      <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-950 flex flex-col gap-1.5 font-sans">
                        <p className="text-xs font-bold flex items-center gap-1.5 text-teal-800">
                          <span className="flex h-2.5 w-2.5 rounded-full bg-teal-500 animate-pulse" />
                          Corporate Account Saved
                        </p>
                        <p className="text-[10px] opacity-90 leading-tight font-medium">
                          Your details are saved on this device. Review them below or clear to enter new information.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            localStorage.removeItem('b2b_profile_save');
                            setB2bName('');
                            setB2bResponsibleName('');
                            setB2bPhone('');
                            setB2bAddress('');
                            setIsReturningB2b(false);
                            toast.success('Fields cleared successfully!');
                          }}
                          className="self-start text-[9px] uppercase tracking-wider font-extrabold text-red-700 hover:underline mt-1 bg-white border border-red-200 px-2 py-1 rounded-lg border-0 cursor-pointer"
                        >
                          Clear Saved Profile
                        </button>
                      </div>
                    )}

                    <form onSubmit={handleFinalizarB2b} className="space-y-4">
                      {/* Company Name */}
                      <div className="space-y-1 relative">
                        <label className="text-xs font-bold uppercase text-black">Company / Authorized Entity Name *</label>
                        <input 
                          required
                          type="text" 
                          className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black font-sans font-semibold"
                          style={{ '--tw-ring-color': settings.primaryColor } as any}
                          value={b2bName}
                          onChange={e => {
                            const val = e.target.value;
                            setB2bName(val);
                            if (val.trim().length > 1) {
                              const matched = b2bProfiles.filter(p => 
                                p.name.toLowerCase().includes(val.toLowerCase())
                              );
                              setB2bSearchResults(matched);
                              setShowB2bSearchDropdown(matched.length > 0);
                            } else {
                              setShowB2bSearchDropdown(false);
                            }
                          }}
                        />
                        {showB2bSearchDropdown && b2bSearchResults.length > 0 && (
                          <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                            {b2bSearchResults.map((profile, i) => (
                              <button
                                key={i}
                                type="button"
                                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-xs font-semibold text-gray-800 border-b border-gray-50 last:border-b-0 border-0 cursor-pointer"
                                onClick={() => {
                                  setB2bName(profile.name);
                                  setB2bResponsibleName(profile.manager || '');
                                  setB2bPhone(profile.phone || '');
                                  setB2bAddress(profile.address || '');
                                  setShowB2bSearchDropdown(false);
                                }}
                              >
                                {profile.name} (Responsible: {profile.manager})
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Responsible names */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase text-black">Authorized Contact Manager *</label>
                          <input 
                            required
                            type="text" 
                            className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black font-sans font-semibold"
                            style={{ '--tw-ring-color': settings.primaryColor } as any}
                            value={b2bResponsibleName}
                            onChange={e => setB2bResponsibleName(e.target.value)}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase text-black">Corporate/Business Phone *</label>
                          <input 
                            required
                            type="tel" 
                            className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black font-sans font-semibold"
                            style={{ '--tw-ring-color': settings.primaryColor } as any}
                            value={b2bPhone}
                            onChange={e => setB2bPhone(formatPhoneByCountry(e.target.value, settings.whatsappCountryCode || '+55'))}
                            placeholder={COUNTRY_OPTIONS[settings.whatsappCountryCode || '+55']?.placeholder || '(11) 99999-9999'}
                          />
                        </div>
                      </div>

                      {/* Commercial Address */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase text-black">Company Receiving Address *</label>
                        <input 
                          required
                          type="text" 
                          placeholder="Street, Number, Suite, Postal Code..."
                          className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black font-sans font-semibold"
                          style={{ '--tw-ring-color': settings.primaryColor } as any}
                          value={b2bAddress}
                          onChange={e => setB2bAddress(e.target.value)}
                        />
                      </div>

                      {/* Zip Code and City */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase text-black">Zip Code *</label>
                          <input 
                            required
                            type="text" 
                            placeholder="Zip Code"
                            className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black font-sans font-semibold"
                            style={{ '--tw-ring-color': settings.primaryColor } as any}
                            value={b2bZipCode}
                            onChange={e => setB2bZipCode(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase text-black">City *</label>
                          <input 
                            required
                            type="text" 
                            placeholder="City"
                            className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black font-sans font-semibold"
                            style={{ '--tw-ring-color': settings.primaryColor } as any}
                            value={b2bCity}
                            onChange={e => setB2bCity(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Plan and Date */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase text-black block">Preferred Order Interval *</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setB2bFrequency('one-time')}
                              className={cn(
                                "py-2.5 px-3 rounded-xl font-bold font-sans text-xs border text-center transition-all cursor-pointer",
                                b2bFrequency === 'one-time'
                                  ? "bg-black text-white border-black"
                                  : "bg-white text-black border-gray-300 hover:bg-gray-50"
                              )}
                            >
                              One-Time Order (Spot)
                            </button>
                            <button
                              type="button"
                              onClick={() => setB2bFrequency('weekly')}
                              className={cn(
                                "py-2.5 px-3 rounded-xl font-bold font-sans text-xs border text-center transition-all cursor-pointer",
                                b2bFrequency === 'weekly'
                                  ? "bg-black text-white border-black"
                                  : "bg-white text-black border-gray-300 hover:bg-gray-50"
                              )}
                            >
                              Weekly Plan (Recurring)
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase text-black">Target Deliver Date *</label>
                          <input 
                            required
                            type="date" 
                            className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black font-sans font-semibold"
                            style={{ '--tw-ring-color': settings.primaryColor } as any}
                            value={b2bDate}
                            onChange={e => setB2bDate(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Observations */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase text-black">Additional Handling Instructions / Notes</label>
                        <textarea 
                          rows={2}
                          placeholder="EX: Prefer receiving hours, special billing details or building receiving dock specs..."
                          className="w-full p-2.5 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black text-xs font-semibold"
                          style={{ '--tw-ring-color': settings.primaryColor } as any}
                          value={b2bObservation}
                          onChange={e => setB2bObservation(e.target.value)}
                        />
                      </div>

                      <div className="flex gap-3 pt-4">
                        <button 
                          type="button"
                          onClick={() => setCheckoutStep('summary')}
                          className="px-6 py-4 rounded-xl bg-white border border-gray-200 text-black font-bold cursor-pointer font-serif border-0 hover:bg-gray-50 transition-colors"
                        >
                          {t.back}
                        </button>
                        <button 
                          type="submit"
                          className="flex-grow py-4 rounded-xl font-bold text-lg shadow-xl transition-transform active:scale-95 cursor-pointer font-serif border-0"
                          style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}
                        >
                          Submit Corporate Order
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="text-center space-y-1">
                      <h3 className="text-xl font-serif font-bold" style={{ color: '#000000' }}>{t.orderDetails}</h3>
                      {settings.checkoutTitle && (
                        <p className="text-sm font-medium italic leading-relaxed px-4" style={{ color: '#000000' }}>
                          {settings.checkoutTitle}
                        </p>
                      )}
                    </div>

                    {(settings.infoBlock1Title || settings.infoBlock1Text || settings.infoBlock2Title || settings.infoBlock2Text) && (
                      <div className="grid grid-cols-1 gap-3">
                        {settings.infoBlock1Title && (
                          <div className="bg-white/50 p-4 rounded-2xl border border-white/20 shadow-sm">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#000000' }}>{settings.infoBlock1Title}</h4>
                            <p className="text-[10px] leading-relaxed" style={{ color: '#000000' }}>{settings.infoBlock1Text}</p>
                          </div>
                        )}
                        {settings.infoBlock2Title && (
                          <div className="bg-white/50 p-4 rounded-2xl border border-white/20 shadow-sm">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#000000' }}>{settings.infoBlock2Title}</h4>
                            <p className="text-[10px] leading-relaxed" style={{ color: '#000000' }}>{settings.infoBlock2Text}</p>
                          </div>
                        )}
                      </div>
                    )}

                    <form onSubmit={handleFinalizar} className="space-y-4">
                      {Boolean(formData.nome || formData.telefone) && (
                        <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs shadow-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-amber-800 font-bold text-sm">✨</span>
                            <span className="font-medium">
                              Seus dados foram preenchidos automaticamente para sua comodidade!
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({
                                nome: '',
                                telefone: '',
                                endereco: '',
                                street: '',
                                number: '',
                                bairro: '',
                                zipCode: '',
                                city: '',
                                state: '',
                                aniversario: '',
                                observacao: '',
                                email: ''
                              });
                              localStorage.removeItem('grao_sabor_customer_profile');
                              toast.info('Dados limpos para um novo preenchimento.');
                            }}
                            className="text-[11px] font-bold text-amber-900 underline hover:text-black cursor-pointer ml-2 shrink-0"
                            title="Limpar campos para preencher outro nome/endereço"
                          >
                            Limpar
                          </button>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase text-black">{t.fullName}</label>
                        <input 
                          required
                          type="text" 
                          className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black"
                          style={{ '--tw-ring-color': settings.primaryColor } as any}
                          value={formData.nome}
                          onChange={e => setFormData({...formData, nome: e.target.value})}
                        />
                      </div>
                      {/* Telefone - Largura total para visualização completa do número */}
                      <div className="space-y-1">
                        {(() => {
                          const countryCfg = COUNTRY_OPTIONS[settings.whatsappCountryCode || '+55'] || COUNTRY_OPTIONS['+55'];
                          return (
                            <>
                              <label className="text-xs font-bold uppercase text-black flex items-center justify-between">
                                <span>{t.phone}</span>
                                <span className="text-green-700 font-bold text-[11px] bg-green-50 px-2 py-0.5 rounded border border-green-200 flex items-center gap-1">
                                  {countryCfg.flag} {countryCfg.country} ({countryCfg.code})
                                </span>
                              </label>
                              <div className="relative flex items-center">
                                <span className="absolute left-3 text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-lg border border-green-200 pointer-events-none select-none">
                                  {countryCfg.code}
                                </span>
                                <input 
                                  required
                                  type="tel" 
                                  className="w-full p-3 pl-16 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black font-semibold text-base tracking-wide"
                                  style={{ '--tw-ring-color': settings.primaryColor } as any}
                                  value={formData.telefone}
                                  onChange={e => setFormData({...formData, telefone: formatPhoneByCountry(e.target.value, settings.whatsappCountryCode || '+55')})}
                                  placeholder={countryCfg.placeholder}
                                />
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {/* Aniversário */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase text-black">
                          {t.birthday}
                        </label>
                        <input 
                          required
                          type="text" 
                          placeholder={t.birthdayPlaceholder}
                          className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black text-base font-semibold"
                          style={{ '--tw-ring-color': settings.primaryColor } as any}
                          value={formData.aniversario}
                          onChange={e => {
                            let val = e.target.value.replace(/\D/g, '');
                            if (val.length > 4) val = val.slice(0, 4);
                            if (val.length > 2) {
                              val = val.slice(0, 2) + '/' + val.slice(2);
                            }
                            setFormData({...formData, aniversario: val});
                          }}
                        />
                      </div>
                      
                      {/* Seleção do Tipo de Atendimento (Entrega vs Retirada) */}
                      {settings.deliveryEnabled && (
                        <div className="space-y-2 pt-2 border-t border-black/10">
                          <label className="text-xs font-bold uppercase text-black">
                            Forma de Atendimento
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setDeliveryType('delivery');
                                if (!deliveryCalculation && (formData.street || formData.bairro || formData.zipCode)) {
                                  handleCalculateDelivery();
                                }
                              }}
                              className={cn(
                                "py-3 px-4 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer min-h-[52px]",
                                deliveryType === 'delivery'
                                  ? "shadow-md ring-2 ring-amber-900/20"
                                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                              )}
                              style={deliveryType === 'delivery' ? { backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39'), borderColor: settings.primaryColor || '#865d39' } : {}}
                            >
                              <span>Entrega (Delivery)</span>
                            </button>

                            {settings.allowPickup !== false && (
                              <button
                                type="button"
                                onClick={() => setDeliveryType('pickup')}
                                className={cn(
                                  "py-3 px-4 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer min-h-[52px]",
                                  deliveryType === 'pickup'
                                    ? "shadow-md ring-2 ring-amber-900/20"
                                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                                )}
                                style={deliveryType === 'pickup' ? { backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39'), borderColor: settings.primaryColor || '#865d39' } : {}}
                              >
                                <span>Retirada no Local</span>
                                <span className="text-[10px] opacity-80 font-normal">(Frete Grátis)</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Informações de Retirada */}
                      {settings.deliveryEnabled && deliveryType === 'pickup' ? (
                        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2 text-xs text-amber-950">
                          <div className="font-bold text-sm text-amber-900">
                            Retirada no Estabelecimento
                          </div>
                          <p className="leading-relaxed">
                            O seu pedido será preparado com carinho para você retirar diretamente no nosso estabelecimento sem cobrança de taxa de entrega.
                          </p>
                          {settings.deliveryOriginAddress && (
                            <p className="font-semibold text-black bg-white/70 p-2.5 rounded-xl border border-amber-300/40">
                              <strong>Endereço de Retirada:</strong> {settings.deliveryOriginAddress}
                            </p>
                          )}
                        </div>
                      ) : (
                        /* Campos de Endereço de Entrega */
                        <>
                          {/* Módulo de Seleção por Cidade (Imagens 3 e 4) */}
                          {settings.deliveryEnabled && settings.deliveryCities && settings.deliveryCities.length > 0 ? (
                            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-300/80 space-y-3">
                              <div>
                                <label className="text-xs font-black uppercase text-amber-950 flex items-center justify-between">
                                  <span>CIDADE PARA ENTREGA *</span>
                                  <span className="text-[10px] font-normal text-amber-800 lowercase tracking-normal">
                                    (calcula a taxa)
                                  </span>
                                </label>
                                <p className="text-[11px] text-amber-900/80 mt-0.5">
                                  Selecione sua cidade para aplicar a taxa de entrega correspondente.
                                </p>
                              </div>

                              <select
                                value={selectedDeliveryCityId}
                                onChange={e => {
                                  const cityId = e.target.value;
                                  setSelectedDeliveryCityId(cityId);
                                  if (cityId && cityId !== 'other') {
                                    const found = settings.deliveryCities?.find(c => c.id === cityId);
                                    if (found) {
                                      setFormData(prev => ({ ...prev, city: found.cityName }));
                                    }
                                  } else if (cityId === 'other') {
                                    setFormData(prev => ({ ...prev, city: '' }));
                                  }
                                }}
                                className="w-full p-3 rounded-xl border border-amber-300 font-bold text-xs bg-white text-black shadow-xs focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer"
                              >
                                <option value="">Selecione a sua cidade...</option>
                                {sortedDeliveryCities.map(c => (
                                  <option key={c.id} value={c.id}>
                                    {c.cityName} {isFreeDeliveryQualified ? '(Frete Grátis)' : `(+ ${currencySymbol} ${c.price.toFixed(2).replace('.', ',')})`}
                                  </option>
                                ))}
                                <option value="other">Outro (Cidade não listada - taxa a combinar)</option>
                              </select>

                              {selectedDeliveryCityId === 'other' && (
                                <div className="space-y-1 pt-1 animate-in fade-in">
                                  <label className="text-xs font-bold uppercase text-black">Digite sua Cidade *</label>
                                  <input 
                                    type="text" 
                                    required
                                    placeholder="Ex: Nome da sua cidade"
                                    className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black bg-white"
                                    value={formData.city}
                                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                                  />
                                </div>
                              )}

                              {/* Banner Frete Grátis ou Falta Quanto */}
                              {isFreeDeliveryQualified ? (
                                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center gap-2 text-xs text-emerald-950 font-bold">
                                  <div>
                                    <span className="uppercase tracking-wider">Frete Grátis Aplicado</span>
                                    <p className="text-[10px] text-emerald-800 font-normal">
                                      Seu pedido atingiu o valor de {currencySymbol} {settings.deliveryFreeAbove?.toFixed(2).replace('.', ',')} para entrega gratuita.
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                settings.deliveryFreeAbove && settings.deliveryFreeAbove > 0 && (
                                  <div className="p-3 rounded-xl bg-white/95 border border-amber-300 flex flex-col gap-2.5 text-xs text-amber-950 shadow-xs">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-bold">
                                        Frete Grátis acima de {currencySymbol} {settings.deliveryFreeAbove.toFixed(2).replace('.', ',')}
                                      </span>
                                      <span className="text-[11px] text-amber-900 font-extrabold bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300/70">
                                        Faltam {currencySymbol} {(settings.deliveryFreeAbove - cartTotal).toFixed(2).replace('.', ',')}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsModalOpen(false);
                                        setCheckoutStep('summary');
                                        const menuEl = document.getElementById('menu-items') || document.querySelector('main');
                                        if (menuEl) menuEl.scrollIntoView({ behavior: 'smooth' });
                                      }}
                                      className="w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-transform active:scale-95 cursor-pointer"
                                      style={{
                                        backgroundColor: settings.primaryColor || '#865d39',
                                        color: getContrastText(settings.primaryColor || '#865d39')
                                      }}
                                    >
                                      <ArrowLeft size={14} />
                                      <span>Voltar ao Cardápio (Adicionar mais itens)</span>
                                    </button>
                                  </div>
                                )
                              )}
                            </div>
                          ) : null}

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2 space-y-1">
                              <label className="text-xs font-bold uppercase text-black">{t.street}</label>
                              <input 
                                required={deliveryType === 'delivery'}
                                type="text" 
                                className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black"
                                style={{ '--tw-ring-color': settings.primaryColor } as any}
                                value={formData.street}
                                onChange={e => setFormData({...formData, street: e.target.value})}
                                onBlur={() => {
                                  if (settings.deliveryEnabled && (!settings.deliveryCities || settings.deliveryCities.length === 0) && (formData.street || formData.bairro)) {
                                    handleCalculateDelivery();
                                  }
                                }}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold uppercase text-black">{t.number}</label>
                              <input 
                                type="text" 
                                className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black"
                                style={{ '--tw-ring-color': settings.primaryColor } as any}
                                value={formData.number}
                                onChange={e => setFormData({...formData, number: e.target.value})}
                                onBlur={() => {
                                  if (settings.deliveryEnabled && (!settings.deliveryCities || settings.deliveryCities.length === 0) && (formData.street || formData.bairro)) {
                                    handleCalculateDelivery();
                                  }
                                }}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-xs font-bold uppercase text-black">Bairro</label>
                              <input 
                                type="text" 
                                placeholder="Ex: Centro, Barra, Jardins"
                                className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black"
                                style={{ '--tw-ring-color': settings.primaryColor } as any}
                                value={formData.bairro}
                                onChange={e => setFormData({...formData, bairro: e.target.value})}
                                onBlur={() => {
                                  if (settings.deliveryEnabled && (!settings.deliveryCities || settings.deliveryCities.length === 0) && (formData.street || formData.bairro)) {
                                    handleCalculateDelivery();
                                  }
                                }}
                              />
                            </div>

                            {(!settings.deliveryCities || settings.deliveryCities.length === 0) && (
                              <div className="space-y-1">
                                <label className="text-xs font-bold uppercase text-black">{t.city}</label>
                                <input 
                                  required={deliveryType === 'delivery'}
                                  type="text" 
                                  className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black"
                                  style={{ '--tw-ring-color': settings.primaryColor } as any}
                                  value={formData.city}
                                  onChange={e => setFormData({...formData, city: e.target.value})}
                                  onBlur={() => {
                                    if (settings.deliveryEnabled && (formData.street || formData.bairro)) {
                                      handleCalculateDelivery();
                                    }
                                  }}
                                />
                              </div>
                            )}

                            <div className="space-y-1">
                              <label className="text-xs font-bold uppercase text-black">{t.state}</label>
                              <input 
                                required={deliveryType === 'delivery'}
                                type="text" 
                                className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black"
                                style={{ '--tw-ring-color': settings.primaryColor } as any}
                                value={formData.state}
                                onChange={e => setFormData({...formData, state: e.target.value})}
                              />
                            </div>
                          </div>

                          {/* Fallback: Caixa de Cálculo de Frete por KM quando não houver cidades cadastradas */}
                          {settings.deliveryEnabled && (!settings.deliveryCities || settings.deliveryCities.length === 0) && (
                            <div className="p-4 rounded-2xl bg-white/90 border border-black/10 shadow-sm space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-extrabold uppercase text-gray-800 flex items-center gap-1.5">
                                  <Truck size={16} className="text-amber-800" />
                                  Cálculo de Frete por Quilometragem
                                </span>
                                <button
                                  type="button"
                                  disabled={isCalculatingDelivery || (!formData.street && !formData.bairro && !formData.zipCode)}
                                  onClick={() => handleCalculateDelivery()}
                                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 shadow-sm"
                                  style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}
                                >
                                  {isCalculatingDelivery ? (
                                    <>
                                      <Loader2 size={13} className="animate-spin" /> Calculando...
                                    </>
                                  ) : (
                                    <>
                                      <Navigation size={13} /> Calcular Frete
                                    </>
                                  )}
                                </button>
                              </div>

                              {deliveryCalculation ? (
                                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1.5">
                                  <div className="flex items-center justify-between font-bold text-gray-900">
                                    <span className="flex items-center gap-1.5 text-gray-800 font-bold">
                                      <MapPin size={15} className="text-red-600" />
                                      {deliveryCalculation.distanceKm > 0 ? (
                                        <>Distância calculada: <span className="font-extrabold text-black">{deliveryCalculation.distanceKm} km</span></>
                                      ) : (
                                        <>Taxa de Entrega Fixa</>
                                      )}
                                    </span>
                                    <span className={deliveryCalculation.isFree ? "text-green-700 font-black text-sm" : "text-black font-black text-sm"}>
                                      {deliveryCalculation.isFree ? 'FRETE GRÁTIS' : `${currencySymbol} ${deliveryCalculation.fee.toFixed(2)}`}
                                    </span>
                                  </div>
                                  {deliveryCalculation.isBeyondMax && (
                                    <p className="text-[11px] text-amber-900 font-semibold pt-1">
                                      ⚠️ A distância calculada ({deliveryCalculation.distanceKm} km) ultrapassa nosso raio padrão de atendimento ({settings.deliveryMaxKm || 15} km). Confirmaremos o envio pelo WhatsApp.
                                    </p>
                                  )}
                                  {deliveryCalculation.distanceKm > 0 && (
                                    <p className="text-[10px] text-gray-500 font-medium">
                                      * Calculado via rota e mapas OpenStreetMap / OSRM
                                    </p>
                                  )}
                                  {!deliveryCalculation.isFree && settings.deliveryFreeAbove && settings.deliveryFreeAbove > 0 && cartTotal < settings.deliveryFreeAbove && (
                                    <div className="p-2.5 rounded-xl bg-white/95 border border-amber-300 flex flex-col gap-2 text-xs text-amber-950 mt-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-bold">
                                          Frete Grátis acima de {currencySymbol} {settings.deliveryFreeAbove.toFixed(2).replace('.', ',')}
                                        </span>
                                        <span className="text-[11px] text-amber-900 font-extrabold bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300/70">
                                          Faltam {currencySymbol} {(settings.deliveryFreeAbove - cartTotal).toFixed(2).replace('.', ',')}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsModalOpen(false);
                                          setCheckoutStep('summary');
                                          const menuEl = document.getElementById('menu-items') || document.querySelector('main');
                                          if (menuEl) menuEl.scrollIntoView({ behavior: 'smooth' });
                                        }}
                                        className="w-full py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-transform active:scale-95 cursor-pointer"
                                        style={{
                                          backgroundColor: settings.primaryColor || '#865d39',
                                          color: getContrastText(settings.primaryColor || '#865d39')
                                        }}
                                      >
                                        <ArrowLeft size={14} />
                                        <span>Voltar ao Cardápio (Adicionar mais itens)</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-[11px] text-gray-500 leading-tight">
                                  Digite seu endereço ou CEP e clique em <strong>"Calcular Frete"</strong> para calcular a distância e o valor da entrega até o seu local.
                                </p>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase text-black">{t.observation}</label>
                        <textarea 
                          rows={2}
                          className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black"
                          style={{ '--tw-ring-color': settings.primaryColor } as any}
                          value={formData.observacao}
                          onChange={e => setFormData({...formData, observacao: e.target.value})}
                          placeholder="Ponto de referência, instruções de entrega, etc."
                        />
                      </div>

                      {/* Resumo Final de Valores */}
                      <div className="p-4 rounded-2xl bg-white border border-black/10 space-y-2 text-sm shadow-sm">
                        <div className="flex justify-between text-gray-700 text-xs font-medium">
                          <span>Subtotal dos produtos:</span>
                          <span className="font-bold text-black">{currencySymbol}{cartTotal.toFixed(2)}</span>
                        </div>
                        {settings.deliveryEnabled && (
                          <div className="flex justify-between text-gray-700 text-xs font-medium">
                            <span className="flex items-center gap-1">
                              <Truck size={13} />
                              {deliveryType === 'pickup' 
                                ? 'Retirada no Estabelecimento:' 
                                : (settings.deliveryCities && settings.deliveryCities.length > 0)
                                  ? `Taxa de Entrega (${(selectedDeliveryCityId && selectedDeliveryCityId !== 'other' ? settings.deliveryCities.find(c => c.id === selectedDeliveryCityId)?.cityName : formData.city) || 'Cidade'}):`
                                  : `Frete de Entrega ${deliveryCalculation?.distanceKm ? `(${deliveryCalculation.distanceKm} km)` : ''}:`}
                            </span>
                            <span className={((deliveryType === 'delivery' ? effectiveDeliveryFee : 0) === 0) ? "font-bold text-green-700" : "font-bold text-black"}>
                              {deliveryType === 'pickup' 
                                ? 'Grátis' 
                                : isFreeDeliveryQualified
                                  ? 'Grátis'
                                  : (settings.deliveryCities && settings.deliveryCities.length > 0)
                                    ? (selectedDeliveryCityId === 'other' 
                                        ? 'A combinar' 
                                        : (selectedDeliveryCityId 
                                            ? `${currencySymbol} ${effectiveDeliveryFee.toFixed(2)}` 
                                            : 'Selecione a cidade'))
                                    : deliveryCalculation 
                                      ? (deliveryCalculation.isFree ? 'Grátis' : `${currencySymbol}${(deliveryCalculation.fee).toFixed(2)}`)
                                      : 'A calcular'}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-base font-extrabold text-black border-t border-black/10 pt-2">
                          <span>Total do Pedido:</span>
                          <span style={{ color: settings.priceColor || settings.primaryColor || '#865d39' }}>
                            {currencySymbol}{(cartTotal + (settings.deliveryEnabled && deliveryType === 'delivery' ? effectiveDeliveryFee : 0)).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-4">
                        <button 
                          type="button"
                          onClick={() => setCheckoutStep('summary')}
                          className="px-6 py-4 rounded-xl bg-white border border-gray-200 font-bold"
                          style={{ color: '#000000' }}
                        >
                          {t.back}
                        </button>
                        <button 
                          type="submit"
                          disabled={isSubmitting}
                          className={`flex-grow py-4 rounded-xl font-bold text-lg shadow-xl transition-transform active:scale-95 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                          style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}
                        >
                          {isSubmitting 
                            ? (settings.language === 'en' ? 'Processing...' : 'Processando...') 
                            : t.finish}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedProductForDetails && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProductForDetails(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-[#FAF7F2] rounded-t-[32px] sm:rounded-[32px] border border-[#EADBCC]/80 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] font-sans"
              style={{ 
                color: settings.textColor || '#000000',
                '--text-color': settings.textColor || '#000000',
                '--modal-heading-color': settings.textColor || '#000000'
              } as any}
            >
              {/* Header do Modal com Título e Fechar (X) conforme Imagem 2 */}
              <div className="p-5 pb-3.5 flex items-start justify-between border-b border-black/5 bg-[#FAF7F2]/95 backdrop-blur-sm sticky top-0 z-20">
                <div className="pr-4">
                  <h2 
                    className="text-xl sm:text-2xl font-serif font-black tracking-tight leading-snug"
                    style={{ color: settings.textColor || '#1A202C' }}
                  >
                    {selectedProductForDetails.title}
                  </h2>
                  {selectedProductForDetails.categoryTitle && (
                    <span className="inline-block mt-1 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-black/5 text-gray-700 rounded-md">
                      {selectedProductForDetails.categoryTitle}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProductForDetails(null)}
                  className="p-1.5 rounded-full hover:bg-black/5 text-gray-500 hover:text-black transition-colors cursor-pointer flex-shrink-0"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Container de Conteúdo com Scroll */}
              <div className="overflow-y-auto w-full flex-grow p-5 space-y-5">
                {/* Imagem do Produto com formato quadrado (1:1) */}
                <div className="w-full aspect-square max-w-[380px] mx-auto bg-white rounded-2xl overflow-hidden shadow-sm border border-black/5">
                  <img 
                    src={selectedProductForDetails.image} 
                    alt={selectedProductForDetails.title} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Descrição Detalhada */}
                {selectedProductForDetails.description && (
                  <p className="text-xs sm:text-sm text-gray-700 leading-relaxed font-medium">
                    {selectedProductForDetails.description}
                  </p>
                )}

                {/* Alérgicos / Ingredientes */}
                {selectedProductForDetails.ingredients && (
                  <p className="text-[11px] font-bold text-gray-600 bg-amber-50/50 p-3 rounded-xl border border-amber-900/10 leading-relaxed">
                    <span className="uppercase text-amber-950 font-black">ALÉRGICOS / INFORMAÇÕES:</span> {selectedProductForDetails.ingredients}
                  </p>
                )}



                {/* Opções de Tamanho / Quantidade conforme Imagem 3 */}
                {selectedProductForDetails.sizes && selectedProductForDetails.sizes.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2">
                      <Layers size={16} className="text-[#5C3D2E]" />
                      <label className="text-xs font-black uppercase tracking-wider text-gray-800">
                        {settings.language === 'en' ? 'CHOOSE SIZE / QUANTITY *' : 'ESCOLHA O TAMANHO / QUANTIDADE *'}
                      </label>
                    </div>
                    <div className="space-y-2.5">
                      {selectedProductForDetails.sizes.map((s, idx) => {
                        const isSelected = selectedSize?.id === s.id;
                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              setSelectedSize(s);
                              if (selectedProductForDetails.isCustomSandwich) {
                                setSelectedSandwichFillings([]);
                              }
                            }}
                            className={cn(
                              "p-4 rounded-2xl flex justify-between items-center cursor-pointer transition-all",
                              isSelected 
                                ? "border-2 border-[#9C6644] bg-[#FFFBF5] shadow-xs" 
                                : "border border-gray-200/90 bg-white/80 hover:bg-white"
                            )}
                          >
                            <span className="font-bold text-xs sm:text-sm text-gray-900">{s.name}</span>
                            <div className="text-right">
                              {Boolean(s.oldPrice && s.oldPrice > 0) && (
                                <span className="text-[10px] text-gray-400 line-through block leading-none">
                                  De {currencySymbol}{s.oldPrice!.toFixed(2)}
                                </span>
                              )}
                              <span className="font-serif font-black text-sm text-gray-950">
                                {currencySymbol}{s.price.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Preço se não tiver tamanhos múltiplos */}
                {(!selectedProductForDetails.sizes || selectedProductForDetails.sizes.length === 0) && (
                  <div className="p-3.5 rounded-2xl bg-white/60 border border-black/5 flex items-baseline gap-2">
                    {(selectedProductForDetails.isCustomCake || selectedProductForDetails.priceType === 'consult') ? (
                      <span className="text-xl font-bold block font-serif" style={{ color: settings.textColor || '#000000' }}>
                        {settings.language === 'en' ? 'On Request' : 'A Consultar'}
                      </span>
                    ) : (
                      <>
                        <p className="text-2xl font-serif font-black" style={{ color: settings.priceColor || settings.primaryColor || '#865d39' }}>
                          {currencySymbol}{(selectedProductForDetails.price > 0 ? selectedProductForDetails.price : (selectedProductForDetails.oldPrice || 0)).toFixed(2)}
                        </p>
                        {Boolean(selectedProductForDetails.price > 0 && selectedProductForDetails.oldPrice && selectedProductForDetails.oldPrice > 0) && (
                          <span className="text-sm line-through opacity-40" style={{ color: settings.textColor || '#000000' }}>
                            {currencySymbol}{selectedProductForDetails.oldPrice!.toFixed(2)}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                )}



                  {/* Custom Cake Options in Details Modal */}
                  {selectedProductForDetails.isCustomCake && (
                    <div className="border-t border-gray-200/30 pt-6 space-y-6">
                      <h4 className="text-sm font-black uppercase tracking-wider" style={{ color: settings.textColor || '#000000', opacity: 0.7 }}>Personalização do Bolo</h4>
                      
                      {/* Size Selection */}
                      {cakeSizesList.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-xs font-bold" style={{ color: settings.textColor || '#000000', opacity: 0.7 }}>Tamanho / Fatias / Peso</p>
                          <div className="grid grid-cols-1 gap-2">
                            {cakeSizesList.map((sizeOpt, idx) => {
                              const isSelected = selectedCakeSize === sizeOpt;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setSelectedCakeSize(sizeOpt)}
                                  className={cn(
                                    "p-3 rounded-xl border-2 transition-all flex justify-between items-center w-full text-left font-bold text-xs cursor-pointer",
                                    isSelected 
                                      ? "shadow-md scale-[1.01]" 
                                      : "bg-white border-gray-200 hover:border-gray-300"
                                  )}
                                  style={{ 
                                    backgroundColor: isSelected ? (settings.primaryColor || '#865d39') : '#ffffff',
                                    color: isSelected ? getContrastText(settings.primaryColor || '#865d39') : (settings.textColor || '#000000'),
                                    borderColor: settings.primaryColor || '#865d39'
                                  }}
                                >
                                  <span>{sizeOpt}</span>
                                  {isSelected && <Check size={12} />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Dough Selection */}
                      {cakeDoughsList.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-xs font-bold" style={{ color: settings.textColor || '#000000', opacity: 0.7 }}>Seleção de Massa</p>
                          <div className="grid grid-cols-2 gap-2">
                            {cakeDoughsList.map((doughOpt, idx) => {
                              const isSelected = selectedDough === doughOpt;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setSelectedDough(doughOpt)}
                                  className={cn(
                                    "p-2.5 rounded-xl border-2 transition-all text-center text-xs font-bold w-full cursor-pointer",
                                    isSelected 
                                      ? "shadow-md" 
                                      : "bg-white border-gray-200 hover:border-gray-300"
                                  )}
                                  style={{ 
                                    backgroundColor: isSelected ? (settings.primaryColor || '#865d39') : '#ffffff',
                                    color: isSelected ? getContrastText(settings.primaryColor || '#865d39') : (settings.textColor || '#000000'),
                                    borderColor: settings.primaryColor || '#865d39'
                                  }}
                                >
                                  {doughOpt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Fillings Selection */}
                      {cakeFillingsList.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex justify-between items-baseline">
                            <p className="text-xs font-bold" style={{ color: settings.textColor || '#000000', opacity: 0.7 }}>Opções de Recheio</p>
                            <span className="text-[10px] opacity-70 font-bold" style={{ color: settings.textColor || '#000000' }}>Escolha até {settings.cakeFillingsMax || 2}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {cakeFillingsList.map((fillingOpt, idx) => {
                              const isSelected = selectedFillings.includes(fillingOpt);
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedFillings(selectedFillings.filter(f => f !== fillingOpt));
                                    } else {
                                      const maxFillings = settings.cakeFillingsMax || 2;
                                      if (selectedFillings.length >= maxFillings) {
                                        toast.error(`Você pode escolher no máximo ${maxFillings} recheios!`);
                                        return;
                                      }
                                      setSelectedFillings([...selectedFillings, fillingOpt]);
                                    }
                                  }}
                                  className={cn(
                                    "p-2.5 rounded-xl border-2 transition-all flex items-center justify-between font-bold text-xs cursor-pointer",
                                    isSelected 
                                      ? "shadow-md" 
                                      : "bg-white border-gray-200 hover:border-gray-300"
                                  )}
                                  style={{ 
                                    backgroundColor: isSelected ? (settings.primaryColor || '#865d39') : '#ffffff',
                                    color: isSelected ? getContrastText(settings.primaryColor || '#865d39') : (settings.textColor || '#000000'),
                                    borderColor: settings.primaryColor || '#865d39'
                                  }}
                                >
                                  <span>{fillingOpt}</span>
                                  {isSelected && <Check size={12} />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Toppings Selection */}
                      {cakeToppingsList.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-xs font-bold" style={{ color: settings.textColor || '#000000', opacity: 0.7 }}>Seleção de Cobertura</p>
                          <div className="grid grid-cols-2 gap-2">
                            {cakeToppingsList.map((toppingOpt, idx) => {
                              const isSelected = selectedTopping === toppingOpt;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setSelectedTopping(toppingOpt)}
                                  className={cn(
                                    "p-2.5 rounded-xl border-2 transition-all text-center text-xs font-bold w-full cursor-pointer",
                                    isSelected 
                                      ? "shadow-md" 
                                      : "bg-white border-gray-200 hover:border-gray-300"
                                  )}
                                  style={{ 
                                    backgroundColor: isSelected ? (settings.primaryColor || '#865d39') : '#ffffff',
                                    color: isSelected ? getContrastText(settings.primaryColor || '#865d39') : (settings.textColor || '#000000'),
                                    borderColor: settings.primaryColor || '#865d39'
                                  }}
                                >
                                  {toppingOpt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Topper Selection */}
                      {cakeToppersList.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-xs font-bold" style={{ color: settings.textColor || '#000000', opacity: 0.7 }}>Topo de Bolo</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {cakeToppersList.map((topperOpt, idx) => {
                              const isSelected = selectedTopper === topperOpt;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setSelectedTopper(topperOpt)}
                                  className={cn(
                                    "p-2.5 rounded-xl border-2 transition-all text-center text-xs font-bold w-full cursor-pointer",
                                    isSelected 
                                      ? "shadow-md" 
                                      : "bg-white border-gray-200 hover:border-gray-300"
                                  )}
                                  style={{ 
                                    backgroundColor: isSelected ? (settings.primaryColor || '#865d39') : '#ffffff',
                                    color: isSelected ? getContrastText(settings.primaryColor || '#865d39') : (settings.textColor || '#000000'),
                                    borderColor: settings.primaryColor || '#865d39'
                                  }}
                                >
                                  {topperOpt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Style Selection Reference */}
                      {selectedProductForDetails.cakeGalleryId && (
                        (() => {
                          const associatedGallery = galleries.find(g => g.id === selectedProductForDetails.cakeGalleryId);
                          const validImages = associatedGallery?.images?.filter(img => img && img.trim() !== '') || [];
                          if (validImages.length === 0) return null;
                          
                          const noStyleText = selectedStyleNumber === null ? 'Selecionado: Base Tradicional' : 'Selecionar: Base Tradicional';

                          return (
                            <div className="space-y-3 pt-2">
                              <p className="text-xs font-bold" style={{ color: settings.textColor || '#000000', opacity: 0.7 }}>Estilo do Bolo / Referência Visual</p>
                              <div className="w-full mb-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedStyleNumber(null)}
                                  className={cn(
                                    "w-full py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 border-2 cursor-pointer uppercase",
                                    selectedStyleNumber === null
                                      ? "shadow-md text-white border-transparent"
                                      : "bg-white border-gray-200 hover:border-gray-300"
                                  )}
                                  style={{
                                    backgroundColor: selectedStyleNumber === null ? (settings.primaryColor || '#865d39') : '#ffffff',
                                    color: selectedStyleNumber === null ? getContrastText(settings.primaryColor || '#865d39') : (settings.textColor || '#000000'),
                                    borderColor: settings.primaryColor || '#865d39'
                                  }}
                                >
                                  {selectedStyleNumber === null ? <Check size={12} /> : <X size={12} />}
                                  <span>{noStyleText}</span>
                                </button>
                              </div>

                              <div className="grid grid-cols-3 gap-2">
                                {associatedGallery?.images?.map((img, idx) => {
                                  if (!img || img.trim() === '') return null;
                                  const isSelected = selectedStyleNumber === (idx + 1);
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => setSelectedStyleNumber(idx + 1)}
                                      className={cn(
                                        "relative aspect-square rounded-xl overflow-hidden border-2 transition-all bg-white p-0 text-left cursor-pointer",
                                        isSelected ? "scale-[1.01]" : "border-gray-200 hover:border-gray-300"
                                      )}
                                      style={{ borderColor: isSelected ? (settings.primaryColor || '#865d39') : 'transparent' }}
                                    >
                                      <img
                                        src={img}
                                        alt={`Style ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                      <div className="absolute top-1 left-1 bg-black/75 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full z-10">
                                        #{idx + 1}
                                      </div>
                                      {isSelected && (
                                        <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                                          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}>
                                            <Check size={12} />
                                          </div>
                                        </div>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  )}

                  {/* Customizable Meal Options in Details Modal */}
                  {selectedProductForDetails.isMeal && (() => {
                    const hasExclusions = !!(selectedProductForDetails.ingredients && selectedProductForDetails.ingredients.split(',').map(i => i.trim()).filter(Boolean).length > 0);
                    const hasSides = !!(selectedProductForDetails.allowedSides && selectedProductForDetails.allowedSides.filter(id => sides.some(s => s.id === id)).length > 0);
                    if (!hasExclusions && !hasSides) return null;
                    return (
                      <div className="border-t border-gray-200/30 pt-6 space-y-6">
                        <h4 className="text-sm font-black uppercase tracking-wider" style={{ color: settings.textColor || '#000000', opacity: 0.7 }}>Personalizar Refeição</h4>
                        
                        {/* Exclusions */}
                        {selectedProductForDetails.ingredients && (() => {
                          const ingredientsList = selectedProductForDetails.ingredients
                            .split(',')
                            .map(i => i.trim())
                            .filter(Boolean);
                          if (ingredientsList.length === 0) return null;
                          return (
                            <div className="space-y-3">
                              <p className="text-xs font-bold" style={{ color: settings.textColor || '#000000', opacity: 0.7 }}>{t.excludeIngredients}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {ingredientsList.map((ingredient, idx) => {
                                  const isSelected = mealSelections.removals.includes(ingredient);
                                  return (
                                    <button 
                                      key={idx}
                                      type="button"
                                      onClick={() => {
                                        if (isSelected) {
                                          setMealSelections({
                                            ...mealSelections,
                                            removals: mealSelections.removals.filter(r => r !== ingredient)
                                          });
                                        } else {
                                          setMealSelections({
                                            ...mealSelections,
                                            removals: [...mealSelections.removals, ingredient]
                                          });
                                        }
                                      }}
                                      className={cn(
                                        "px-3 py-1.5 rounded-full border-2 font-bold transition-all text-xs cursor-pointer",
                                        isSelected 
                                          ? "bg-red-500 border-red-500 text-white shadow-sm" 
                                          : "bg-white border-gray-200"
                                      )}
                                      style={{ color: isSelected ? '#ffffff' : (settings.textColor || '#000000') }}
                                    >
                                      {ingredient}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Sides and Swaps */}
                        {selectedProductForDetails.allowedSides && selectedProductForDetails.allowedSides.length > 0 && (
                          (() => {
                            const allowedSidesList = (selectedProductForDetails.allowedSides || [])
                              .map(id => sides.find(s => s.id === id))
                              .filter(Boolean) as Side[];
                            
                            const regularSides = allowedSidesList.filter(s => s.type !== 'swap');
                            const swapSides = allowedSidesList.filter(s => s.type === 'swap');

                            if (regularSides.length === 0 && swapSides.length === 0) return null;

                            const renderSideItem = (side: Side) => {
                              const qty = sideQuantities[side.id] || 0;
                              return (
                                <div 
                                  key={side.id}
                                  className={cn(
                                    "p-3 rounded-xl border border-gray-200 font-bold transition-all flex justify-between items-center bg-white text-xs shadow-sm"
                                  )}
                                  style={{ color: settings.textColor || '#000000' }}
                                >
                                  <div className="flex flex-col min-w-0 pr-2">
                                    <span className="font-bold truncate" style={{ color: settings.textColor || '#000000' }}>{side.name}</span>
                                    <span className="text-[10px] opacity-60 font-extrabold mt-0.5" style={{ color: settings.textColor || '#000000' }}>
                                      {side.price > 0 ? `+ ${currencySymbol}${side.price.toFixed(2)}` : 'Grátis'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2.5">
                                    <button 
                                      type="button"
                                      onClick={() => setSideQuantities(prev => ({ ...prev, [side.id]: Math.max(0, (prev[side.id] || 0) - 1) }))}
                                      className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center active:scale-95 transition-transform cursor-pointer border border-gray-200 focus:outline-none"
                                      style={{ color: settings.textColor || '#000000' }}
                                    >
                                      <Minus size={12} />
                                    </button>
                                    <span className="w-4 text-center font-bold" style={{ color: settings.textColor || '#000000' }}>{qty}</span>
                                    <button 
                                      type="button"
                                      onClick={() => setSideQuantities(prev => ({ ...prev, [side.id]: (prev[side.id] || 0) + 1 }))}
                                      className="w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-transform cursor-pointer focus:outline-none"
                                      style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}
                                    >
                                      <Plus size={12} />
                                    </button>
                                  </div>
                                </div>
                              );
                            };

                            return (
                              <div className="space-y-4">
                                {regularSides.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-xs font-bold" style={{ color: settings.textColor || '#000000', opacity: 0.7 }}>{t.chooseSides}</p>
                                    <div className="grid grid-cols-1 gap-1.5">
                                      {regularSides.map(renderSideItem)}
                                    </div>
                                  </div>
                                )}
                                {swapSides.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-xs font-bold text-amber-800">
                                      Opções de Troca
                                    </p>
                                    <div className="grid grid-cols-1 gap-1.5">
                                      {swapSides.map(renderSideItem)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        )}
                      </div>
                    );
                  })()}

                  {/* Customizable Sandwich Options in Details Modal */}
                  {selectedProductForDetails.isCustomSandwich && (
                    <div className="border-t border-gray-200/30 pt-6 space-y-6">
                      <h4 className="text-sm font-black uppercase tracking-wider" style={{ color: settings.textColor || '#000000', opacity: 0.7 }}>
                        {settings.language === 'en' ? 'Marmita State Option (Frozen / Natural / Fresh)' : 'Opção de Estado da Marmita (Congelada / Natural / Fresca)'}
                      </h4>
                      
                      {/* Fillings Selection for Custom Sandwich */}
                      {selectedProductForDetails.customFillings && (() => {
                        const fillingsList = selectedProductForDetails.customFillings
                          .split(',')
                          .map(f => f.trim())
                          .filter(Boolean);
                        if (fillingsList.length === 0) return null;
                        return (
                          <div className="space-y-4">
                            <p className="text-xs font-bold" style={{ color: settings.textColor || '#000000', opacity: 0.7 }}>
                              {settings.language === 'en' ? 'Select Quantities per Option' : 'Selecione as Quantidades por Opção'}
                            </p>
                            <div className="grid grid-cols-1 gap-2.5">
                              {fillingsList.map((fillingOpt, idx) => {
                                const qty = sandwichFillingQuantities[fillingOpt] || 0;
                                return (
                                  <div
                                    key={idx}
                                    className="p-3.5 rounded-2xl border transition-all flex items-center justify-between font-bold text-xs bg-white/70 border-white/25 shadow-sm"
                                  >
                                    <span className="text-sm font-bold" style={{ color: settings.textColor || '#000000' }}>{fillingOpt}</span>
                                    
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        disabled={qty === 0}
                                        onClick={() => {
                                          setSandwichFillingQuantities(prev => ({
                                            ...prev,
                                            [fillingOpt]: Math.max(0, qty - 1)
                                          }));
                                        }}
                                        className={cn(
                                          "w-7 h-7 rounded-full bg-white flex items-center justify-center border border-gray-200 shadow-xs cursor-pointer active:scale-95 transition-all text-xs font-bold",
                                          qty === 0 ? "opacity-30 cursor-not-allowed" : "hover:bg-gray-50"
                                        )}
                                        style={{ color: settings.textColor || '#000000' }}
                                      >
                                        <Minus size={12} />
                                      </button>
                                      <span className="text-xs font-black min-w-[16px] text-center" style={{ color: settings.textColor || '#000000' }}>{qty}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSandwichFillingQuantities(prev => ({
                                            ...prev,
                                            [fillingOpt]: qty + 1
                                          }));
                                        }}
                                        className="w-7 h-7 rounded-full flex items-center justify-center text-white shadow-xs cursor-pointer active:scale-95 transition-all text-xs font-bold"
                                        style={{ backgroundColor: settings.primaryColor || '#865d39' }}
                                      >
                                        <Plus size={12} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

              {/* Bottom Sticky Action Bar conforme Imagem 2 e 3 */}
              <div className="p-4 border-t border-black/5 bg-[#FAF7F2] flex items-center gap-3 mt-auto">
                {(() => {
                  const hasSizesOpt = !!(selectedProductForDetails.sizes && selectedProductForDetails.sizes.length > 0);
                  const hasExclusionsOpt = !!(selectedProductForDetails.isMeal && selectedProductForDetails.ingredients && selectedProductForDetails.ingredients.split(',').map(i => i.trim()).filter(Boolean).length > 0);
                  const hasSidesOpt = !!(selectedProductForDetails.isMeal && selectedProductForDetails.allowedSides && selectedProductForDetails.allowedSides.filter(id => sides.some(s => s.id === id)).length > 0);
                  const isCustomCakeOpt = !!selectedProductForDetails.isCustomCake;
                  const isCustomSandwichOpt = !!selectedProductForDetails.isCustomSandwich;

                  const isCakeIncomplete = selectedProductForDetails.isCustomCake && (
                    (cakeSizesList.length > 0 && !selectedCakeSize) ||
                    (cakeDoughsList.length > 0 && !selectedDough) ||
                    (cakeFillingsList.length > 0 && selectedFillings.length === 0) ||
                    (cakeToppingsList.length > 0 && !selectedTopping) ||
                    (cakeToppersList.length > 0 && !selectedTopper)
                  );

                  const isSandwichIncomplete = selectedProductForDetails.isCustomSandwich && (
                    (Object.values(sandwichFillingQuantities) as number[]).reduce((sum, q) => sum + q, 0) === 0
                  );

                  const basePrice = (hasSizesOpt && selectedSize) 
                    ? selectedSize.price 
                    : (selectedProductForDetails.price > 0 ? selectedProductForDetails.price : (selectedProductForDetails.oldPrice || 0));
                  
                  const sidesPrice = Object.entries(sideQuantities).reduce((sum, [id, qty]) => {
                    const side = sides.find(s => s.id === id);
                    return sum + (side ? side.price * (qty as number) : 0);
                  }, 0);

                  const totalPrice = basePrice + sidesPrice;
                  const isDisabled = !!isCakeIncomplete || !!isSandwichIncomplete;
                  const minQ = selectedProductForDetails?.minQuantity && selectedProductForDetails.minQuantity > 1 ? selectedProductForDetails.minQuantity : 1;

                  const cartItemsForThis = cart.filter(it => it.productId === selectedProductForDetails.id);
                  const totalInCartForThis = cartItemsForThis.reduce((acc, it) => acc + it.quantity, 0);

                  return (
                    <>
                      {/* Botão Excluir Item (se já estiver no carrinho) */}
                      {totalInCartForThis > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            cartItemsForThis.forEach(it => removeFromCart(it.id));
                            toast.info('Item removido do seu pedido.');
                            setSelectedProductForDetails(null);
                          }}
                          className="h-11 px-3.5 rounded-2xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 flex items-center justify-center gap-1.5 transition-all text-xs font-bold cursor-pointer shrink-0"
                          title="Excluir este item do seu pedido"
                        >
                          <Trash2 size={15} />
                          <span className="hidden sm:inline">Excluir</span>
                        </button>
                      )}

                      {/* Stepper [- 1 +] */}
                      <div className="flex items-center gap-2 bg-white border border-gray-200/90 rounded-full px-2 py-1.5 shadow-xs shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (customItemQuantity <= minQ) {
                              if (minQ > 1) {
                                toast.info(settings.language === 'en' 
                                  ? `Minimum quantity is ${minQ}.` 
                                  : `Quantidade mínima é ${minQ}.`);
                              }
                              return;
                            }
                            setCustomItemQuantity(prev => Math.max(minQ, prev - 1));
                          }}
                          className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-800 transition-colors cursor-pointer"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="font-bold text-xs min-w-[18px] text-center text-gray-950">
                          {customItemQuantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCustomItemQuantity(prev => prev + 1)}
                          className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-800 transition-colors cursor-pointer"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      {/* Botão ADICIONAR À SACOLA - 2 linhas para máxima legibilidade sem corte */}
                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          const requiresFullCustomization = hasSizesOpt || hasExclusionsOpt || hasSidesOpt || isCustomCakeOpt || isCustomSandwichOpt;
                          if (requiresFullCustomization) {
                            addDetailedProductToCart(selectedProductForDetails);
                          } else {
                            addToCart(selectedProductForDetails, customItemQuantity);
                            setSelectedProductForDetails(null);
                            toast.success('Adicionado com sucesso ao pedido!');
                          }
                        }}
                        className={cn(
                          "flex-1 min-w-0 py-2.5 sm:py-3 px-3 sm:px-4 rounded-2xl flex flex-col items-center justify-center shadow-lg transition-all cursor-pointer text-white",
                          isDisabled ? "opacity-50 cursor-not-allowed" : "hover:brightness-110 active:scale-[0.99]"
                        )}
                        style={{ backgroundColor: settings.primaryColor || '#5C3D2E' }}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <ShoppingBag size={15} className="shrink-0 text-white/95" />
                          <span className="text-[11px] sm:text-xs uppercase tracking-wide font-bold whitespace-nowrap">
                            {settings.language === 'en' ? 'Adicionar à Sacola' : 'Adicionar à Sacola'}
                          </span>
                        </div>
                        <div className="mt-0.5 leading-none">
                          {totalPrice > 0 ? (
                            <span className="text-[#F3C969] font-serif font-black text-sm sm:text-base whitespace-nowrap">
                              {currencySymbol} {(totalPrice * customItemQuantity).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-xs font-semibold opacity-90 whitespace-nowrap">
                              {settings.language === 'en' ? 'On Request' : 'A Consultar'}
                            </span>
                          )}
                        </div>
                      </button>
                    </>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCustomModalOpen && selectedProductForCustom && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCustomModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-[#ece6db] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] force-dark-headings"
            >
              <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-white/30">
                <h2 className="text-2xl font-serif font-bold text-black" style={{ color: '#000000' }}>
                  {selectedProductForCustom.isCustomSandwich ? selectedProductForCustom.title : t.customCakeTitle}
                </h2>
                <button 
                  onClick={() => setIsCustomModalOpen(false)} 
                  className="p-2 hover:bg-white/50 rounded-full transition-colors"
                  style={{ color: '#000000' }}
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-8 custom-scrollbar">
                {selectedProductForCustom.isCustomSandwich ? (
                  <>
                    {/* Sizes Selection for Custom Sandwich */}
                    {selectedProductForCustom.sizes && selectedProductForCustom.sizes.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-black">
                          {settings.language === 'en' ? 'Select Option' : 'Selecione a Opção de Estado'}
                        </h3>
                        <div className="grid grid-cols-1 gap-2.5">
                          {selectedProductForCustom.sizes.map((s) => {
                            const isSelected = selectedSize?.id === s.id;
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  setSelectedSize(s);
                                  setSelectedSandwichFillings([]);
                                }}
                                className={cn(
                                  "p-4 rounded-2xl border-2 transition-all flex justify-between items-center w-full text-left font-bold",
                                  isSelected 
                                    ? "shadow-md scale-[1.01]" 
                                    : "bg-white border-gray-200/50 hover:border-gray-300 text-black"
                                )}
                                style={{ 
                                  backgroundColor: isSelected ? (settings.primaryColor || '#865d39') : '#ffffff',
                                  color: isSelected ? getContrastText(settings.primaryColor || '#865d39') : '#000000',
                                  borderColor: settings.primaryColor || '#865d39'
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold">{s.name}</span>
                                  {s.price && s.price > 0 && (
                                    <span className="text-xs opacity-80 font-semibold mt-0.5">
                                      {currencySymbol}{s.price.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                                {isSelected && (
                                  <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: getContrastText(settings.primaryColor || '#865d39'), color: settings.primaryColor || '#865d39' }}>
                                    <Check size={12} />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Fillings Selection for Custom Sandwich */}
                    {selectedProductForCustom.customFillings && (() => {
                      const fillingsList = selectedProductForCustom.customFillings
                        .split(',')
                        .map(f => f.trim())
                        .filter(Boolean);
                      if (fillingsList.length === 0) return null;
                      return (
                        <div className="space-y-4 pt-4 border-t border-gray-200/30">
                          <h3 className="text-sm font-bold uppercase tracking-wider text-black">
                            {settings.language === 'en' ? 'Select Quantities per Option' : 'Selecione as Quantidades por Opção'}
                          </h3>
                          <div className="grid grid-cols-1 gap-2.5">
                            {fillingsList.map((fillingOpt, idx) => {
                              const qty = sandwichFillingQuantities[fillingOpt] || 0;
                              return (
                                <div
                                  key={idx}
                                  className="p-3.5 rounded-2xl border transition-all flex items-center justify-between font-bold text-sm bg-white/70 border-white/25 shadow-sm"
                                >
                                  <span className="text-sm font-bold text-black">{fillingOpt}</span>
                                  
                                  <div className="flex items-center gap-3">
                                    <button
                                      type="button"
                                      disabled={qty === 0}
                                      onClick={() => {
                                        setSandwichFillingQuantities(prev => ({
                                          ...prev,
                                          [fillingOpt]: Math.max(0, qty - 1)
                                        }));
                                      }}
                                      className={cn(
                                        "w-8 h-8 rounded-full bg-white flex items-center justify-center text-black border border-gray-200 shadow-sm cursor-pointer active:scale-95 transition-all text-sm font-bold",
                                        qty === 0 ? "opacity-30 cursor-not-allowed" : "hover:bg-gray-50"
                                      )}
                                    >
                                      <Minus size={14} />
                                    </button>
                                    <span className="text-sm font-black min-w-[20px] text-center text-black">{qty}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSandwichFillingQuantities(prev => ({
                                          ...prev,
                                          [fillingOpt]: qty + 1
                                        }));
                                      }}
                                      className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md cursor-pointer active:scale-95 transition-all text-sm font-bold"
                                      style={{ backgroundColor: settings.primaryColor || '#865d39' }}
                                    >
                                      <Plus size={14} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                ) : selectedProductForCustom.isCustomCake ? (
                  <>
                    {/* Size Selection */}
                    {cakeSizesList.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-serif font-black uppercase tracking-widest text-black/80">Size / Slices / Weight</h3>
                        <div className="grid grid-cols-1 gap-2.5">
                          {cakeSizesList.map((sizeOpt, idx) => {
                            const isSelected = selectedCakeSize === sizeOpt;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedCakeSize(sizeOpt)}
                                className={cn(
                                  "p-4 rounded-2xl border-2 transition-all flex justify-between items-center w-full text-left font-bold",
                                  isSelected 
                                    ? "shadow-md scale-[1.01]" 
                                    : "bg-white border-gray-200/50 hover:border-gray-300 text-black"
                                )}
                                style={{ 
                                  backgroundColor: isSelected ? (settings.primaryColor || '#865d39') : '#ffffff',
                                  color: isSelected ? getContrastText(settings.primaryColor || '#865d39') : '#000000',
                                  borderColor: settings.primaryColor || '#865d39'
                                }}
                              >
                                <span className="font-bold text-sm">
                                  {sizeOpt}
                                </span>
                                {isSelected && (
                                  <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: getContrastText(settings.primaryColor || '#865d39'), color: settings.primaryColor || '#865d39' }}>
                                    <Check size={12} />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Dough Selection */}
                    {cakeDoughsList.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-serif font-black uppercase tracking-widest text-black/80">Dough Selection</h3>
                        <div className="grid grid-cols-2 gap-2.5">
                          {cakeDoughsList.map((doughOpt, idx) => {
                            const isSelected = selectedDough === doughOpt;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedDough(doughOpt)}
                                className={cn(
                                  "p-3 rounded-2xl border-2 transition-all text-center text-sm font-bold w-full",
                                  isSelected 
                                    ? "shadow-md" 
                                    : "bg-white border-gray-200/50 hover:border-gray-300 text-black"
                                )}
                                style={{ 
                                  backgroundColor: isSelected ? (settings.primaryColor || '#865d39') : '#ffffff',
                                  color: isSelected ? getContrastText(settings.primaryColor || '#865d39') : '#000000',
                                  borderColor: settings.primaryColor || '#865d39'
                                }}
                              >
                                {doughOpt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Fillings Selection */}
                    {cakeFillingsList.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-baseline">
                          <h3 className="text-sm font-serif font-black uppercase tracking-widest text-black/80">Filling Options</h3>
                          <span className="text-xs text-gray-500 font-bold">Choose up to {settings.cakeFillingsMax || 2}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {cakeFillingsList.map((fillingOpt, idx) => {
                            const isSelected = selectedFillings.includes(fillingOpt);
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedFillings(selectedFillings.filter(f => f !== fillingOpt));
                                  } else {
                                    const maxFillings = settings.cakeFillingsMax || 2;
                                    if (selectedFillings.length >= maxFillings) {
                                      toast.error(`You can choose a maximum of ${maxFillings} fillings!`);
                                      return;
                                    }
                                    setSelectedFillings([...selectedFillings, fillingOpt]);
                                  }
                                }}
                                className={cn(
                                  "p-3 rounded-2xl border-2 transition-all flex items-center justify-between font-bold text-sm",
                                  isSelected 
                                    ? "shadow-md" 
                                    : "bg-white border-gray-200/50 hover:border-gray-300 text-black"
                                )}
                                style={{ 
                                  backgroundColor: isSelected ? (settings.primaryColor || '#865d39') : '#ffffff',
                                  color: isSelected ? getContrastText(settings.primaryColor || '#865d39') : '#000000',
                                  borderColor: settings.primaryColor || '#865d39'
                                }}
                              >
                                <span>{fillingOpt}</span>
                                <div className={cn(
                                  "w-4 h-4 rounded-md border flex items-center justify-center",
                                  isSelected ? "border-transparent" : "border-gray-300 bg-white"
                                )}
                                style={{ 
                                  backgroundColor: isSelected ? getContrastText(settings.primaryColor || '#865d39') : 'transparent',
                                  color: isSelected ? (settings.primaryColor || '#865d39') : 'transparent'
                                }}
                                >
                                  {isSelected && <Check size={10} />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Toppings Selection */}
                    {cakeToppingsList.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-serif font-black uppercase tracking-widest text-black/80">Topping Selection</h3>
                        <div className="grid grid-cols-2 gap-2.5">
                          {cakeToppingsList.map((toppingOpt, idx) => {
                            const isSelected = selectedTopping === toppingOpt;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedTopping(toppingOpt)}
                                className={cn(
                                  "p-3 rounded-2xl border-2 transition-all text-center text-sm font-bold w-full",
                                  isSelected 
                                    ? "shadow-md" 
                                    : "bg-white border-gray-200/50 hover:border-gray-300 text-black"
                                )}
                                style={{ 
                                  backgroundColor: isSelected ? (settings.primaryColor || '#865d39') : '#ffffff',
                                  color: isSelected ? getContrastText(settings.primaryColor || '#865d39') : '#000000',
                                  borderColor: settings.primaryColor || '#865d39'
                                }}
                              >
                                {toppingOpt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Topper Selection */}
                    {cakeToppersList.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-serif font-black uppercase tracking-widest text-black/80">Cake Topper</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {cakeToppersList.map((topperOpt, idx) => {
                            const isSelected = selectedTopper === topperOpt;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedTopper(topperOpt)}
                                className={cn(
                                  "p-3 rounded-2xl border-2 transition-all text-center text-sm font-bold w-full",
                                  isSelected 
                                    ? "shadow-md" 
                                    : "bg-white border-gray-200/50 hover:border-gray-300 text-black"
                                )}
                                style={{ 
                                  backgroundColor: isSelected ? (settings.primaryColor || '#865d39') : '#ffffff',
                                  color: isSelected ? getContrastText(settings.primaryColor || '#865d39') : '#000000',
                                  borderColor: settings.primaryColor || '#865d39'
                                }}
                              >
                                {topperOpt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Gallery Style Selection */}
                    {selectedProductForCustom.cakeGalleryId && (
                      (() => {
                        const associatedGallery = galleries.find(g => g.id === selectedProductForCustom.cakeGalleryId);
                        const validImages = associatedGallery?.images?.filter(img => img && img.trim() !== '') || [];
                        if (validImages.length === 0) return null;
                        
                        const noStyleText = selectedStyleNumber === null ? 'Selecionado: Base Tradicional (Sem Referência)' : 'Selecionar: Base Tradicional (Sem Referência)';

                        return (
                          <div className="space-y-4 pt-2">
                            <h3 className="text-sm font-serif font-black uppercase tracking-widest text-black/80">Estilo do Bolo / Referência Visual</h3>
                            <p className="text-[11px] font-semibold text-gray-500 -mt-1 leading-normal">
                              Selecione uma das fotos abaixo como modelo ou referência visual para o seu bolo personalizado. O número da foto correspondente será incluído no seu pedido!
                            </p>

                            {/* Separate "No Style Reference" Button styled like Add to Cart */}
                            <div className="w-full">
                              <button
                                type="button"
                                onClick={() => setSelectedStyleNumber(null)}
                                className={cn(
                                  "w-full py-3.5 rounded-2xl font-bold text-xs sm:text-sm shadow-sm transition-transform active:scale-[0.99] flex items-center justify-center gap-2 border-2 cursor-pointer uppercase tracking-wider",
                                  selectedStyleNumber === null
                                    ? "shadow-md text-white border-transparent"
                                    : "bg-white border-gray-200/50 hover:border-gray-300 text-black"
                                )}
                                style={{
                                  backgroundColor: selectedStyleNumber === null ? (settings.primaryColor || '#865d39') : '#ffffff',
                                  color: selectedStyleNumber === null ? getContrastText(settings.primaryColor || '#865d39') : '#000000',
                                  borderColor: settings.primaryColor || '#865d39'
                                }}
                              >
                                {selectedStyleNumber === null ? <Check size={16} /> : <X size={15} />}
                                <span>{noStyleText}</span>
                              </button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">

                              {associatedGallery?.images?.map((img, idx) => {
                                if (!img || img.trim() === '') return null;
                                const isSelected = selectedStyleNumber === (idx + 1);
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setSelectedStyleNumber(idx + 1)}
                                    className={cn(
                                      "relative aspect-square rounded-2xl overflow-hidden border-2 transition-all bg-white group p-0 text-left cursor-pointer shadow-sm hover:shadow",
                                      isSelected
                                        ? "scale-[1.01]"
                                        : "border-gray-200/50 hover:border-gray-300"
                                    )}
                                    style={{ borderColor: isSelected ? (settings.primaryColor || '#865d39') : 'transparent' }}
                                  >
                                    <img
                                      src={img}
                                      alt={`Style ${idx + 1}`}
                                      className="w-full h-full object-cover select-none"
                                      referrerPolicy="no-referrer"
                                    />
                                    {/* Number Badge */}
                                    <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-sm text-white text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full z-10">
                                      Photo {idx + 1}
                                    </div>
                                    
                                    {/* Select Highlight Overlay */}
                                    <div className={cn(
                                      "absolute inset-0 transition-opacity flex items-center justify-center p-2 text-center",
                                      isSelected 
                                        ? "bg-black/35 opacity-100" 
                                        : "bg-black/0 opacity-0 group-hover:bg-black/10 group-hover:opacity-100"
                                    )}>
                                      {isSelected ? (
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}>
                                          <Check size={18} />
                                        </div>
                                      ) : (
                                        <span className="text-[9px] font-bold text-white uppercase tracking-widest bg-black/40 px-2 py-1 rounded-full">Select</span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </>
                ) : (
                  <>
                    {/* Size Selection */}
                    {selectedProductForCustom.sizes && selectedProductForCustom.sizes.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-black">
                          {settings.language === 'en' ? 'Select Size / Portion' : 'Selecione o Tamanho / Porção'}
                        </h3>
                        <div className="space-y-2">
                          {selectedProductForCustom.sizes.map((s) => {
                            const cartItem = cart.find(item => item.productId === selectedProductForCustom.id && item.selectedSize?.id === s.id && !item.mealOptions);
                            const qty = cartItem ? cartItem.quantity : 0;
                            return (
                              <div
                                key={s.id}
                                className="flex justify-between items-center p-3.5 bg-white border border-gray-200 rounded-2xl font-bold text-black text-xs shadow-sm"
                              >
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-black">{s.name}</span>
                                  {s.price && s.price > 0 && (
                                    <span className="text-xs text-gray-500 font-extrabold mt-0.5">
                                      {currencySymbol}{s.price.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  {qty > 0 ? (
                                    <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-full border border-gray-200">
                                      <button
                                        type="button"
                                        onClick={() => decrementSizeQty(selectedProductForCustom, s)}
                                        className="w-8 h-8 rounded-full bg-white hover:bg-gray-50 flex items-center justify-center text-black shadow-sm cursor-pointer active:scale-95 transition-all"
                                      >
                                        <Minus size={14} />
                                      </button>
                                      <span className="text-sm font-black min-w-[20px] text-center text-black">{qty}</span>
                                      <button
                                        type="button"
                                        onClick={() => incrementSizeQty(selectedProductForCustom, s)}
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md cursor-pointer active:scale-95 transition-all"
                                        style={{ backgroundColor: settings.primaryColor || '#865d39' }}
                                      >
                                        <Plus size={14} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => incrementSizeQty(selectedProductForCustom, s)}
                                      className="px-4 py-2 rounded-full font-bold text-xs tracking-wider uppercase shadow-md hover:scale-105 active:scale-95 cursor-pointer transition-all flex items-center gap-1"
                                      style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}
                                    >
                                      <Plus size={12} />
                                      <span>{settings.language === 'en' ? 'Add' : 'Adicionar'}</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Ingredient Exclusions */}
                    {selectedProductForCustom.isMeal && selectedProductForCustom.ingredients && (() => {
                      const ingredientsList = selectedProductForCustom.ingredients
                        .split(',')
                        .map(i => i.trim())
                        .filter(Boolean);
                      if (ingredientsList.length === 0) return null;
                      return (
                        <div className="space-y-4">
                          <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#000000' }}>{t.excludeIngredients}</h3>
                          <div className="flex flex-wrap gap-2">
                            {ingredientsList.map((ingredient, idx) => {
                              const isSelected = mealSelections.removals.includes(ingredient);
                              return (
                                <button 
                                  key={idx}
                                  onClick={() => {
                                    if (isSelected) {
                                      setMealSelections({
                                        ...mealSelections,
                                        removals: mealSelections.removals.filter(r => r !== ingredient)
                                      });
                                    } else {
                                      setMealSelections({
                                        ...mealSelections,
                                        removals: [...mealSelections.removals, ingredient]
                                      });
                                    }
                                  }}
                                  className={cn(
                                    "px-4 py-2 rounded-full border-2 font-bold transition-all text-sm",
                                    isSelected 
                                      ? "bg-red-500 border-red-500 text-white shadow-md" 
                                      : "bg-white/50 border-transparent text-black"
                                  )}
                                >
                                  {ingredient}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Sides & Swaps Selection */}
                    {selectedProductForCustom.isMeal && selectedProductForCustom.allowedSides && selectedProductForCustom.allowedSides.length > 0 && (
                      (() => {
                        const allowedSidesList = (selectedProductForCustom.allowedSides || [])
                          .map(id => sides.find(s => s.id === id))
                          .filter(Boolean) as Side[];
                        
                        const regularSides = allowedSidesList.filter(s => s.type !== 'swap');
                        const swapSides = allowedSidesList.filter(s => s.type === 'swap');

                        if (regularSides.length === 0 && swapSides.length === 0) return null;

                        const renderSideItem = (side: Side) => {
                          const qty = sideQuantities[side.id] || 0;
                          return (
                            <div 
                              key={side.id}
                              className={cn(
                                "p-4 rounded-xl border-2 font-bold transition-all flex flex-col gap-3",
                                qty > 0 
                                  ? "bg-white border-blue-500 shadow-md" 
                                  : "bg-white/50 border-transparent text-black"
                              )}
                            >
                              <div className="flex justify-between items-center">
                                <span className={qty > 0 ? "text-blue-600" : "text-black"}>{side.name}</span>
                                <span className="text-xs opacity-60 text-black">
                                  {side.price > 0 ? `+ ${currencySymbol}${(side.price * (qty > 0 ? qty : 1)).toFixed(2)}` : 'Free'}
                                </span>
                              </div>
                              <div className="flex items-center justify-end gap-4">
                                <button 
                                  onClick={() => setSideQuantities(prev => ({ ...prev, [side.id]: Math.max(0, (prev[side.id] || 0) - 1) }))}
                                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-black active:scale-95 transition-transform cursor-pointer"
                                >
                                  <Minus size={16} />
                                </button>
                                <span className="w-4 text-center text-black">{qty}</span>
                                <button 
                                  onClick={() => setSideQuantities(prev => ({ ...prev, [side.id]: (prev[side.id] || 0) + 1 }))}
                                  className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
                                  style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}
                                >
                                  <Plus size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        };

                        return (
                          <div className="space-y-6">
                            {regularSides.length > 0 && (
                              <div className="space-y-4">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-black">{t.chooseSides}</h3>
                                <div className="grid grid-cols-1 gap-2">
                                  {regularSides.map(renderSideItem)}
                                </div>
                              </div>
                            )}
                            {swapSides.length > 0 && (
                              <div className="space-y-4">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-800">
                                  Opções de Troca
                                </h3>
                                <div className="grid grid-cols-1 gap-2">
                                  {swapSides.map(renderSideItem)}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )}
                  </>
                )}
              </div>

              <div className="p-6 pb-8 sm:pb-6 bg-white/30 border-t border-gray-200">
                {selectedProductForCustom && !selectedProductForCustom.isCustomSandwich && (!selectedProductForCustom.sizes || selectedProductForCustom.sizes.length === 0) && (
                  <div id="custom-modal-qty-container" className="flex items-center justify-between mb-4 bg-white/50 p-3.5 rounded-2xl border border-gray-200/50">
                    <span id="custom-modal-qty-label" className="text-sm font-bold text-black uppercase tracking-wider">
                      Quantidade
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        id="custom-modal-qty-dec-btn"
                        type="button"
                        onClick={() => {
                          const minQ = selectedProductForCustom?.minQuantity && selectedProductForCustom.minQuantity > 1 ? selectedProductForCustom.minQuantity : 1;
                          if (customItemQuantity <= minQ) {
                            if (minQ > 1) {
                              toast.info(`A quantidade mínima para este produto é de ${minQ} unidades.`);
                            }
                            return;
                          }
                          setCustomItemQuantity(prev => Math.max(minQ, prev - 1));
                        }}
                        className="w-10 h-10 rounded-full bg-white hover:bg-gray-50 flex items-center justify-center text-black border border-gray-200 shadow-sm cursor-pointer active:scale-95 transition-all text-lg font-bold"
                      >
                        <Minus size={16} />
                      </button>
                      <span id="custom-modal-qty-value" className="text-base font-black min-w-[28px] text-center text-black">{customItemQuantity}</span>
                      <button
                        id="custom-modal-qty-inc-btn"
                        type="button"
                        onClick={() => setCustomItemQuantity(prev => prev + 1)}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md cursor-pointer active:scale-95 transition-all text-lg font-bold"
                        style={{ backgroundColor: settings.primaryColor || '#865d39' }}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                )}

                {(() => {
                  const isCakeIncomplete = selectedProductForCustom?.isCustomCake && (
                    (cakeSizesList.length > 0 && !selectedCakeSize) ||
                    (cakeDoughsList.length > 0 && !selectedDough) ||
                    (cakeFillingsList.length > 0 && selectedFillings.length === 0) ||
                    (cakeToppingsList.length > 0 && !selectedTopping) ||
                    (cakeToppersList.length > 0 && !selectedTopper)
                  );
                  const isSandwichIncomplete = selectedProductForCustom?.isCustomSandwich && (
                    (Object.values(sandwichFillingQuantities) as number[]).reduce((sum, q) => sum + q, 0) === 0
                  );
                  const isIncomplete = !!isCakeIncomplete || !!isSandwichIncomplete;

                  const totalQty = selectedProductForCustom?.isCustomSandwich
                    ? (Object.values(sandwichFillingQuantities) as number[]).reduce((sum, q) => sum + q, 0)
                    : customItemQuantity;

                  return (
                    <button 
                      onClick={addMealToCart}
                      disabled={isIncomplete}
                      className={`w-full py-4 rounded-2xl font-bold text-lg shadow-xl transition-all flex items-center justify-center gap-2 ${isIncomplete ? 'opacity-50 cursor-not-allowed active:scale-100' : 'active:scale-95 cursor-pointer hover:brightness-110'}`}
                      style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}
                    >
                      {isIncomplete ? (
                        <span>{isSandwichIncomplete ? 'Selecione a opção de estado da marmita' : 'Selecione todos os itens primeiro'}</span>
                      ) : (
                        <>
                          <span>{t.addToCart}</span>
                          <span className="text-sm opacity-80 font-normal">
                            ({currencySymbol} {(
                              ((selectedProductForCustom.sizes && selectedProductForCustom.sizes.length > 0 && selectedSize ? selectedSize.price : (selectedProductForCustom.price > 0 ? selectedProductForCustom.price : (selectedProductForCustom.oldPrice || 0))) + 
                              Object.entries(sideQuantities).reduce((sum, [id, qty]) => {
                                const side = sides.find(s => s.id === id);
                                return sum + (side ? side.price * (qty as number) : 0);
                              }, 0)) * totalQty
                            ).toFixed(2)})
                          </span>
                        </>
                      )}
                    </button>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {renderComboModal()}
      {renderNutritionalModal()}
    </div>
  );

  function renderComboModal() {
    if (!comboModalProduct) return null;
    const limit = comboModalProduct.comboLimit || 5;
    const totalSelected = Object.values(comboSelections).reduce((a, b) => a + b, 0);
    const progressPercent = Math.min(100, Math.round((totalSelected / limit) * 100));
    const isComplete = totalSelected === limit;

    const allowedProducts = products
      .filter(p => p.isActive !== false && p.id !== comboModalProduct.id)
      .filter(p => {
        if (!comboModalProduct.allowedComboDishIds || comboModalProduct.allowedComboDishIds.length === 0) {
          return true;
        }
        return comboModalProduct.allowedComboDishIds.includes(p.id);
      })
      .filter(p => {
        if (!comboSearchQuery.trim()) return true;
        const q = comboSearchQuery.toLowerCase();
        return p.title.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q));
      });

    return (
      <AnimatePresence>
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setComboModalProduct(null)}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg bg-[#FAF7F2] rounded-3xl shadow-2xl overflow-y-auto flex flex-col max-h-[92vh] border border-[#EADBCC]"
          >
            {/* Cabeçalho do Modal (Imagem 13) */}
            <div className="p-4 sm:p-5 border-b border-[#EADBCC] bg-white/70 flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-start gap-3.5 min-w-0">
                <img
                  src={comboModalProduct.image}
                  alt={comboModalProduct.title}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover shrink-0 border border-black/10 shadow-sm mt-0.5"
                />
                <div className="min-w-0">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                    COMBO PERSONALIZÁVEL
                  </span>
                  <h3 className="font-serif font-black text-base sm:text-lg text-gray-900 leading-tight mt-0.5">
                    {comboModalProduct.title}
                  </h3>
                  {comboModalProduct.description && (
                    <p className="text-xs text-gray-600 leading-relaxed mt-1 break-words">
                      {comboModalProduct.description}
                    </p>
                  )}
                  <span className="text-xs font-bold text-amber-800 block mt-1">
                    {currencySymbol} {comboModalProduct.price.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setComboModalProduct(null)}
                className="w-9 h-9 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-gray-700 transition-colors cursor-pointer shrink-0 mt-0.5"
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Contador Dinâmico & Barra de Progresso */}
            <div className="p-4 bg-amber-500/10 border-b border-amber-500/20 space-y-2 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-amber-950">
                  {totalSelected} a {limit} selecionadas
                </span>
                <span className={cn(
                  "text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider",
                  isComplete ? "bg-emerald-600 text-white" : "bg-amber-200 text-amber-900"
                )}>
                  {isComplete ? '✓ Quantidade Completa' : `Faltam ${limit - totalSelected}`}
                </span>
              </div>
              <div className="w-full h-2.5 bg-amber-200/60 rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: isComplete ? '#059669' : (settings.primaryColor || '#865d39')
                  }}
                />
              </div>
            </div>

            {/* Campo de Busca de Pratos */}
            <div className="p-3 bg-white border-b border-gray-200/60 shrink-0">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar pratos ou sabores no combo..."
                  value={comboSearchQuery}
                  onChange={e => setComboSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-gray-300 bg-white text-black outline-none focus:border-amber-700 transition-colors"
                />
                {comboSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setComboSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Lista de Pratos Permitidos com Stepper e Botão Ver Mais */}
            <div className="p-4 space-y-2.5 flex-grow">
              {allowedProducts.length === 0 ? (
                <div className="text-center py-10 text-xs text-gray-500 font-medium">
                  Nenhum prato encontrado com o termo pesquisado.
                </div>
              ) : (
                allowedProducts.map((dish) => {
                  const qty = comboSelections[dish.id] || 0;
                  const isDishOutOfStock = dish.trackStock && (dish.stockQuantity ?? 0) <= 0;

                  return (
                    <div
                      key={dish.id}
                      className={cn(
                        "p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 bg-white shadow-2xs",
                        qty > 0 ? "border-amber-700 ring-1 ring-amber-700/20 bg-amber-500/5" : "border-gray-200 hover:border-gray-300",
                        isDishOutOfStock ? "opacity-60 grayscale" : ""
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <img
                          src={dish.image}
                          alt={dish.title}
                          onClick={() => setComboDetailDish(dish)}
                          className="w-[58px] h-[58px] sm:w-[60px] sm:h-[60px] rounded-xl object-cover shrink-0 border border-black/5 cursor-pointer hover:opacity-85 transition-opacity"
                        />
                        <div className="min-w-0 space-y-0.5">
                          <h4 
                            onClick={() => setComboDetailDish(dish)}
                            className="font-serif font-bold text-xs sm:text-sm text-gray-900 leading-tight cursor-pointer hover:text-amber-800 transition-colors"
                          >
                            {dish.title}
                          </h4>
                          {dish.description && (
                            <p className="text-[11px] text-gray-500 line-clamp-1">
                              {dish.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setComboDetailDish(dish)}
                              className="text-[10.5px] font-bold text-amber-900 hover:text-amber-950 underline cursor-pointer"
                            >
                              Ver mais
                            </button>
                            {hasNutritionalData(dish) && (
                              <button
                                type="button"
                                onClick={() => handleOpenNutritional(dish)}
                                className="text-[10px] font-bold text-gray-400 hover:text-gray-600 hover:underline cursor-pointer"
                              >
                                Tabela Nutricional
                              </button>
                            )}
                            {isDishOutOfStock && (
                              <span className="text-[9px] font-black uppercase text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                                ESGOTADO
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Stepper [- 0 +] */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDecrementComboDish(dish.id)}
                          disabled={qty === 0}
                          className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-gray-800 font-black cursor-pointer transition-colors active:scale-95"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-5 text-center font-black text-sm text-gray-900">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleIncrementComboDish(dish.id)}
                          disabled={totalSelected >= limit || isDishOutOfStock}
                          className="w-8 h-8 rounded-full disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white font-black cursor-pointer transition-all active:scale-95 shadow-xs"
                          style={{ backgroundColor: settings.primaryColor || '#865d39' }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Rodapé Fixo com Botão de Confirmação Travado até Quota Exata */}
            <div className="p-4 border-t border-[#EADBCC] bg-white/95 backdrop-blur-md sticky bottom-0 z-20 shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] mt-auto">
              <button
                type="button"
                onClick={handleAddComboToCart}
                disabled={!isComplete}
                className={cn(
                  "w-full py-4 rounded-2xl font-bold text-sm tracking-wide shadow-lg transition-all flex items-center justify-center gap-2 uppercase",
                  isComplete
                    ? "cursor-pointer active:scale-98 hover:brightness-105"
                    : "opacity-40 cursor-not-allowed"
                )}
                style={{
                  backgroundColor: settings.primaryColor || '#865d39',
                  color: getContrastText(settings.primaryColor || '#865d39')
                }}
              >
                {isComplete ? (
                  <>
                    <span>Adicionar Combo à Sacola</span>
                    <span>•</span>
                    <span>{currencySymbol} {comboModalProduct.price.toFixed(2).replace('.', ',')}</span>
                  </>
                ) : (
                  <span>Selecione mais {limit - totalSelected} para completar</span>
                )}
              </button>
            </div>

            {/* Modal de Detalhes "Ver mais" do Prato do Combo */}
            {comboDetailDish && (
              <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                <div className="relative w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-amber-200/80 space-y-3.5 animate-in fade-in zoom-in-95 duration-200">
                  <button
                    type="button"
                    onClick={() => setComboDetailDish(null)}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 cursor-pointer transition-colors z-10"
                    title="Fechar"
                  >
                    <X size={16} />
                  </button>

                  <div className="w-full aspect-square max-w-[340px] mx-auto rounded-2xl overflow-hidden bg-gray-100 border border-black/5 shadow-inner">
                    <img
                      src={comboDetailDish.image}
                      alt={comboDetailDish.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-serif font-black text-lg text-gray-900 leading-tight">
                      {comboDetailDish.title}
                    </h3>
                    {comboDetailDish.description ? (
                      <p className="text-xs text-gray-600 leading-relaxed max-h-40 overflow-y-auto pt-1">
                        {comboDetailDish.description}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Sem descrição adicional.</p>
                    )}
                  </div>

                  {comboDetailDish.ingredients && (
                    <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs space-y-0.5">
                      <span className="font-bold text-amber-950 text-[11px] block">Ingredientes:</span>
                      <p className="text-amber-900 text-[11px]">{comboDetailDish.ingredients}</p>
                    </div>
                  )}

                  {hasNutritionalData(comboDetailDish) && (
                    <button
                      type="button"
                      onClick={() => {
                        const d = comboDetailDish;
                        setComboDetailDish(null);
                        handleOpenNutritional(d);
                      }}
                      className="text-xs font-bold text-amber-800 hover:underline block cursor-pointer"
                    >
                       Ver Tabela Nutricional
                    </button>
                  )}

                  {/* Seletor de Quantidade do Prato no Combo [- 0 +] */}
                  {(() => {
                    const dishQty = comboSelections[comboDetailDish.id] || 0;
                    const isOutOfStock = comboDetailDish.trackStock === true && (comboDetailDish.stockQuantity ?? 0) <= 0;
                    return (
                      <div className="p-3 bg-amber-50/80 border border-amber-200/90 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-amber-950">
                            Adicionar ao Combo
                          </span>
                          <span className="text-[10px] text-amber-900/80 font-medium">
                            {totalSelected} de {limit} selecionadas
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDecrementComboDish(comboDetailDish.id)}
                            disabled={dishQty === 0}
                            className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-gray-800 font-black cursor-pointer transition-colors active:scale-95 shadow-2xs border border-gray-200"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-5 text-center font-black text-sm text-gray-900">
                            {dishQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleIncrementComboDish(comboDetailDish.id)}
                            disabled={totalSelected >= limit || isOutOfStock}
                            className="w-8 h-8 rounded-full disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white font-black cursor-pointer transition-all active:scale-95 shadow-xs"
                            style={{ backgroundColor: settings.primaryColor || '#865d39' }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setComboDetailDish(null)}
                      className="w-full py-2.5 rounded-xl text-white font-bold text-xs transition-colors cursor-pointer"
                      style={{ backgroundColor: settings.primaryColor || '#865d39' }}
                    >
                      Concluir
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </AnimatePresence>
    );
  }

  function renderNutritionalModal() {
    if (!nutritionalModalProduct) return null;
    const info = nutritionalModalProduct.nutritionalInfo || {};

    const tableRows = [
      { label: 'Valor energético (kcal)', qty: info.calories ? `${info.calories} kcal` : '-', vd: info.caloriesVd || '-' },
      { label: 'Carboidratos (g)', qty: info.carbs ? `${info.carbs}g` : '-', vd: info.carbsVd || '-' },
      { label: 'Açúcares totais (g)', qty: info.totalSugars ? `${info.totalSugars}g` : '-', vd: '-' },
      { label: 'Açúcares adicionados (g)', qty: info.addedSugars ? `${info.addedSugars}g` : '-', vd: info.addedSugarsVd || '-' },
      { label: 'Proteínas (g)', qty: info.proteins ? `${info.proteins}g` : '-', vd: info.proteinsVd || '-' },
      { label: 'Gorduras totais (g)', qty: info.totalFat ? `${info.totalFat}g` : '-', vd: info.totalFatVd || '-' },
      { label: 'Gorduras saturadas (g)', qty: info.saturatedFat ? `${info.saturatedFat}g` : '-', vd: info.saturatedFatVd || '-' },
      { label: 'Gorduras trans (g)', qty: info.transFat ? `${info.transFat}g` : '-', vd: info.transFatVd || '-' },
      { label: 'Fibras alimentares (g)', qty: info.fiber ? `${info.fiber}g` : '-', vd: info.fiberVd || '-' },
      { label: 'Sódio (mg)', qty: info.sodium ? `${info.sodium}mg` : '-', vd: info.sodiumVd || '-' },
    ];

    return (
      <AnimatePresence>
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setNutritionalModalProduct(null)}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-gray-300"
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-3 bg-gray-50">
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  PADRÃO ANVISA
                </span>
                <h3 className="font-serif font-black text-base sm:text-lg text-gray-900 truncate">
                  {nutritionalModalProduct.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setNutritionalModalProduct(null)}
                className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-700 transition-colors cursor-pointer shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* Nutrition Box ANVISA (Imagem 15) */}
            <div className="p-5 overflow-y-auto space-y-3 font-sans">
              <div className="border-2 border-black p-3.5 rounded-lg space-y-2 bg-white text-black">
                <h4 className="font-black text-sm uppercase tracking-wider border-b-2 border-black pb-1">
                  INFORMAÇÃO NUTRICIONAL
                </h4>
                <div className="text-xs space-y-0.5 text-gray-800">
                  <p>
                    <strong>Porções por embalagem:</strong> {info.servingsPerPackage || '1 porção'}
                  </p>
                  <p>
                    <strong>Porção:</strong> {info.servingSize || '300g (1 unidade)'}
                  </p>
                </div>
                <div className="border-t-4 border-black pt-1">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-black text-left">
                        <th className="py-1 font-bold">Nutriente</th>
                        <th className="py-1 font-bold text-right">Porção</th>
                        <th className="py-1 font-bold text-right">% VD*</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {tableRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="py-1 text-gray-800">{row.label}</td>
                          <td className="py-1 text-right font-medium text-gray-900">{row.qty}</td>
                          <td className="py-1 text-right font-bold text-gray-900">{row.vd ? `${row.vd}%` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-gray-500 pt-1 border-t border-black italic leading-tight">
                  *Percentual de valores diários fornecidos pela porção.
                </p>
              </div>

              {nutritionalModalProduct.description && (
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-700 space-y-1">
                  <span className="font-bold text-gray-900 block uppercase text-[10px] tracking-wider">
                    Descrição do Prato:
                  </span>
                  <p className="leading-relaxed">{nutritionalModalProduct.description}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={() => setNutritionalModalProduct(null)}
                className="w-full py-3 rounded-xl bg-gray-900 hover:bg-black text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Fechar Informação Nutricional
              </button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    );
  }
  function unused_old_modal() {
    return (
      <AnimatePresence>
        {isDietsModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDietsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-[#ece6db] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] force-dark-headings text-black"
            >
              <div className="p-6 border-b border-gray-200/50 flex items-center justify-between bg-white/40 font-serif">
                <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2" style={{ color: settings.primaryColor || '#000000' }}>
                  <Building2 size={24} />
                  {'CORPORATE & WHOLESALE'}
                </h2>
                <button 
                  onClick={() => setIsDietsModalOpen(false)} 
                  className="p-2 hover:bg-white/50 rounded-full transition-all text-black cursor-pointer"
                >
                  <X size={22} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-6">
                <div className="bg-white/50 p-4 rounded-2xl border border-white/40 space-y-2">
                  <p className="text-[11px] font-semibold leading-relaxed text-black/80">
                     This is our dedicated wholesale scheduling and quote portal. Realize wholesale orders directly without retail premiums! Conditions automatically scale by volume.
                  </p>
                  
                  {isReturningB2b && (
                    <div className="flex items-center justify-between bg-[#865d39]/10 p-2.5 rounded-xl border border-[#865d39]/20 text-xs mt-1.5">
                      <span className="font-bold text-[#865d39]">✓ Returning Partner Profile Active</span>
                      <button 
                        type="button" 
                        onClick={() => {
                          localStorage.removeItem('b2b_profile_save');
                          setB2bName('');
                          setB2bResponsibleName('');
                          setB2bPhone('');
                          setB2bAddress('');
                          setIsReturningB2b(false);
                          toast.info('Profile fields cleared.');
                        }}
                        className="text-[10px] font-extrabold text-red-600 bg-white px-2 py-1 rounded-lg border border-red-200 hover:bg-red-50"
                      >
                        Reset Profile
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Business Name (Nome Fantasia) with autocomplete dropdown */}
                  <div className="space-y-1 relative">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-black flex items-center gap-1.5">
                      <Building2 size={12} /> Nom Fantasie / Business Name *
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. Coffee Central or Starbucks L.A."
                      className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs outline-none text-black font-semibold shadow-sm focus:border-black transition-colors"
                      value={b2bName}
                      onChange={e => {
                        const val = e.target.value;
                        setB2bName(val);
                        if (val.trim().length >= 2) {
                          const matched = b2bProfiles.filter(p => 
                            (p.name || '').toLowerCase().includes(val.toLowerCase()) || 
                            (p.phone || '').toLowerCase().includes(val.toLowerCase())
                          );
                          setB2bSearchResults(matched);
                          setShowB2bSearchDropdown(matched.length > 0);
                        } else {
                          setShowB2bSearchDropdown(false);
                        }
                      }}
                    />
                    
                    {showB2bSearchDropdown && b2bSearchResults.length > 0 && (
                      <div className="absolute top-[100%] left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto divide-y divide-gray-100 p-1">
                        <div className="text-[9px] font-bold text-gray-400 uppercase p-1.5 tracking-wider bg-gray-50/50">
                          Recurrent Profiles Found (Click to autofill):
                        </div>
                        {b2bSearchResults.map((profile, i) => (
                          <button
                            key={i}
                            type="button"
                            className="w-full p-2.5 text-left text-xs text-black hover:bg-gray-100 flex flex-col gap-0.5 rounded-lg active:scale-95 transition-all text-black font-medium"
                            onClick={() => {
                              setB2bName(profile.name || '');
                              setB2bResponsibleName(profile.manager || '');
                              setB2bPhone(profile.phone || '');
                              setB2bAddress(profile.address || '');
                              setIsReturningB2b(true);
                              setShowB2bSearchDropdown(false);
                              toast.success(`Autocompleted profile for ${profile.name}!`);
                            }}
                          >
                            <span className="font-bold text-black">{profile.name}</span>
                            <span className="text-[10px] text-gray-500 font-normal">Contact: {profile.manager} • Phone: {profile.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Responsible Person Manager Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-black flex items-center gap-1.5">
                      <User size={12} /> Responsible Manager / Contact Name *
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. John Smith"
                      className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs outline-none text-black font-semibold shadow-sm focus:border-black transition-colors"
                      value={b2bResponsibleName}
                      onChange={e => setB2bResponsibleName(e.target.value)}
                    />
                  </div>

                  {/* Contact Phone */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-black flex items-center gap-1.5">
                      <Phone size={12} /> Contact Tel / Phone *
                    </label>
                    <input 
                      type="tel" 
                      placeholder="e.g. (310) 555-0199"
                      className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs outline-none text-black font-semibold shadow-sm focus:border-black transition-colors"
                      value={b2bPhone}
                      onChange={e => setB2bPhone(e.target.value)}
                    />
                  </div>

                  {/* Delivery Address */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-black flex items-center gap-1.5">
                      <MapPin size={12} /> Commercial Delivery Address *
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. 520 Broadway, Santa Monica, CA 90401"
                      className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs outline-none text-black font-semibold shadow-sm focus:border-black transition-colors"
                      value={b2bAddress}
                      onChange={e => setB2bAddress(e.target.value)}
                    />
                  </div>

                  {/* Delivery Schedule Frequency */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-black block mb-1">
                       Delivery Plan/Frequency *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        type="button" 
                        onClick={() => setB2bFrequency('one-time')}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1 ${b2bFrequency === 'one-time' ? 'bg-black text-white border-black shadow-md' : 'bg-white border-gray-300 text-black hover:border-black'}`}
                      >
                        <span>Single Delivery</span>
                        <span className="text-[9px] opacity-75 font-normal">One-time Order / Spot</span>
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setB2bFrequency('weekly')}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1 ${b2bFrequency === 'weekly' ? 'bg-black text-white border-black shadow-md' : 'bg-white border-gray-300 text-black hover:border-black'}`}
                      >
                        <span className={b2bFrequency === 'weekly' ? "text-yellow-300" : "text-amber-600"}>★ Weekly Plan</span>
                        <span className="text-[9px] opacity-75 font-normal">Recurring deliveries</span>
                      </button>
                    </div>
                  </div>

                  {/* Delivery Calendar (Data de entrega) */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-black flex items-center gap-1.5">
                      <Calendar size={12} className="text-[#865d39]" /> 
                      Scheduled Delivery Date (Calendar) *
                    </label>
                    <input 
                      type="date" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-xs outline-none text-black font-extrabold text-black active:border-black select-all"
                      style={{ color: '#000000' }}
                      value={b2bDate}
                      onChange={e => setB2bDate(e.target.value)}
                    />
                  </div>

                  {/* Quantity section */}
                  <div className="pt-2">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#865d39] block mb-3 border-b border-[#865d39]/20 pb-1">
                       FROZEN CHEESE BREAD PACKAGES VOLUME (1KG / 2.2LBS PACKAGES)
                    </label>
                    
                    <div className="space-y-3">
                      {/* Item 1 */}
                      <div className="bg-white/70 p-3 rounded-2xl border border-white/30 flex items-center justify-between shadow-sm hover:shadow transition-shadow">
                        <div>
                          <h4 className="font-extrabold text-xs text-black">Cocktail Size Cheese Bread</h4>
                          <p className="text-[10px] text-gray-500 font-semibold">1kg packet • bite-sized, ideal for cafes & catering</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            type="button"
                            onClick={() => setPqCoquetel(prev => Math.max(0, prev - 1))}
                            className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-black active:scale-90 transition-all font-extrabold cursor-pointer"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-6 text-center text-xs font-black text-black">{pqCoquetel}</span>
                          <button 
                            type="button"
                            onClick={() => setPqCoquetel(prev => prev + 1)}
                            className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 hover:opacity-90 transition-all font-extrabold cursor-pointer"
                            style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Item 2 */}
                      <div className="bg-white/70 p-3 rounded-2xl border border-white/30 flex items-center justify-between shadow-sm hover:shadow transition-shadow">
                        <div>
                          <h4 className="font-extrabold text-xs text-black">Medium Size Cheese Bread</h4>
                          <p className="text-[10px] text-gray-500 font-semibold">1kg packet • traditional classic café snack sizing</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            type="button"
                            onClick={() => setPqMedio(prev => Math.max(0, prev - 1))}
                            className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-black active:scale-90 transition-all font-extrabold cursor-pointer"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-6 text-center text-xs font-black text-black">{pqMedio}</span>
                          <button 
                            type="button"
                            onClick={() => setPqMedio(prev => prev + 1)}
                            className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 hover:opacity-90 transition-all font-extrabold cursor-pointer"
                            style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Item 3 */}
                      <div className="bg-white/70 p-3 rounded-2xl border border-white/30 flex items-center justify-between shadow-sm hover:shadow transition-shadow">
                        <div>
                          <h4 className="font-extrabold text-xs text-black">Large Premium Cheese Bread</h4>
                          <p className="text-[10px] text-gray-500 font-semibold">1kg packet • gourmet display-counter large size</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            type="button"
                            onClick={() => setPqPremium(prev => Math.max(0, prev - 1))}
                            className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-black active:scale-90 transition-all font-extrabold cursor-pointer"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-6 text-center text-xs font-black text-black">{pqPremium}</span>
                          <button 
                            type="button"
                            onClick={() => setPqPremium(prev => prev + 1)}
                            className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 hover:opacity-90 transition-all font-extrabold cursor-pointer"
                            style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Observation box */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-black">Custom Notes / Route Details</label>
                    <textarea 
                      placeholder="Enter details on delivery access, loading dock, recurring schedulings or special B2B requests"
                      rows={2.5}
                      className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs outline-none text-black font-semibold resize-none"
                      value={b2bObservation}
                      onChange={e => setB2bObservation(e.target.value)}
                    />
                  </div>
                </div>

                {/* Submission Options (Whats Only) */}
                <div className="pt-4 border-t border-gray-200/50 space-y-3">
                  <div className="text-[10px] font-extrabold text-center text-gray-500 uppercase tracking-widest">
                    Submit Wholesale Quote Request:
                  </div>
                  
                  <div className="w-full">
                    <button
                      type="button"
                      onClick={() => {
                        // Submit via WhatsApp
                        if (!b2bName.trim() || !b2bResponsibleName.trim() || !b2bPhone.trim() || !b2bAddress.trim() || !b2bDate) {
                           toast.error('Please complete all fields with an asterisk (*).');
                           return;
                        }
                        if (pqCoquetel === 0 && pqMedio === 0 && pqPremium === 0) {
                           toast.error('Select at least one package size quantity.');
                           return;
                        }
                        
                        // Construct state map and trigger submitting method
                        const formattedDateForDb = (() => {
                          const [year, month, day] = b2bDate.split('-');
                          return `${day}/${month}/${year}`;
                        })();

                        const orderItems = [];
                        if (pqCoquetel > 0) orderItems.push({ title: 'Cocktail Frozen Cheese Bread (1kg package)', quantity: pqCoquetel, price: 0, priceType: 'consult' as const });
                        if (pqMedio > 0) orderItems.push({ title: 'Medium Frozen Cheese Bread (1kg package)', quantity: pqMedio, price: 0, priceType: 'consult' as const });
                        if (pqPremium > 0) orderItems.push({ title: 'Large Premium Frozen Cheese Bread (1kg package)', quantity: pqPremium, price: 0, priceType: 'consult' as const });

                        const b2bOrderDataObj = {
                          customerName: b2bName,
                          phone: b2bPhone,
                          address: b2bAddress,
                          pickupDate: formattedDateForDb,
                          birthday: '',
                          observation: b2bObservation,
                          email: '',
                          items: orderItems,
                          total: 0,
                          createdAt: serverTimestamp(),
                          orderLanguage: 'en',
                          isB2B: true,
                          isPJ: true,
                          b2bManagerName: b2bResponsibleName,
                          b2bFrequency: b2bFrequency,
                          b2bCompanyName: b2bName,
                          b2bAddress: b2bAddress
                        };

                        try {
                          addDoc(collection(db, 'pedidos'), b2bOrderDataObj);
                          localStorage.setItem('b2b_profile_save', JSON.stringify({
                            name: b2bName,
                            manager: b2bResponsibleName,
                            phone: b2bPhone,
                            address: b2bAddress
                          }));
                          setIsReturningB2b(true);

                          // Build message
                          let msg = `*B2B CORPORATE ORDER & QUOTATION*\n`;
                          msg += `----------------------------------------\n`;
                          msg += `*Company:* ${b2bName}\n`;
                          msg += `*Manager:* ${b2bResponsibleName}\n`;
                          msg += `*Phone:* ${b2bPhone}\n`;
                          msg += `*Address:* ${b2bAddress}\n`;
                          msg += `*Frequency:* ${b2bFrequency === 'weekly' ? 'Weekly Recurring Plan' : 'One-Time Delivery Order'}\n`;
                          msg += `*Delivery Date:* ${formattedDateForDb}\n\n`;
                          msg += `*Wholesale items requested:*\n`;
                          if (pqCoquetel > 0) msg += `- Cocktail Frozen Cheese Bread: ${pqCoquetel} package(s) (1kg / 2.2lbs)\n`;
                          if (pqMedio > 0) msg += `- Medium Frozen Cheese Bread: ${pqMedio} package(s) (1kg / 2.2lbs)\n`;
                          if (pqPremium > 0) msg += `- Large Premium Frozen Cheese Bread: ${pqPremium} package(s) (1kg / 2.2lbs)\n`;
                          if (b2bObservation) msg += `\n*Notes/Specs:* ${b2bObservation}\n`;
                          msg += `----------------------------------------\n`;
                          msg += `Hello! We would like to request B2B wholesale pricing and delivery scheduling. Thank you!`;

                          const cleanPhone = getCleanWhatsAppPhone(settings.whatsappNumber || '', settings.whatsappCountryCode || '+55');
                          const sendUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
                          
                          toast.success('B2B Quote recorded! Redirecting to WhatsApp...');
                          setIsDietsModalOpen(false);

                          try {
                            const win = window.open(sendUrl, '_blank');
                            if (!win || win.closed || typeof win.closed === 'undefined') {
                              window.location.href = sendUrl;
                            }
                          } catch (e) {
                            window.location.href = sendUrl;
                          }
                        } catch (err) {
                          console.error(err);
                          toast.error('Error recording order.');
                        }
                      }}
                      className="w-full py-4 px-4 rounded-xl font-bold text-sm tracking-wider uppercase text-white bg-green-600 hover:bg-green-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md border-0"
                    >
                      <MessageCircle size={18} /> Enviar por WhatsApp
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  }
}
