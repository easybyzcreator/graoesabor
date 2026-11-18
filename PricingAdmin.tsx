import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calculator, 
  TrendingUp, 
  Percent, 
  DollarSign, 
  Clock, 
  Plus, 
  Trash2, 
  Save, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Package, 
  ArrowRight, 
  Layers, 
  HelpCircle,
  FolderOpen,
  RotateCcw
} from 'lucide-react';
import { Product, Settings } from '../types';
import { getCurrencySymbol } from '../utils/countryUtils';
import { getContrastText } from '../utils/orderUtils';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

export interface IngredientCost {
  id: string;
  name: string;
  packageQuantity: number;
  packageUnit: 'g' | 'kg' | 'ml' | 'L' | 'un';
  packagePrice: number;
  recipeQuantity: number;
  recipeUnit: 'g' | 'kg' | 'ml' | 'L' | 'un';
}

export interface FichaTecnica {
  id?: string;
  title: string;
  productId?: string;
  yieldUnits: number;
  yieldUnitName: string;
  ingredients: IngredientCost[];
  prepTimeMinutes: number;
  hourlyRate: number;
  fixedCostPercent: number; // e.g. 15%
  cardFeePercent: number; // e.g. 3.5%
  targetProfitPercent: number; // e.g. 50%
  totalProductionCost: number;
  unitCost: number;
  suggestedSalePrice: number;
  actualPrice?: number;
  netProfitUnit: number;
  updatedAt?: any;
}

interface PricingAdminProps {
  settings: Settings;
  products?: Product[];
}

export const PricingAdmin: React.FC<PricingAdminProps> = ({ settings, products = [] }) => {
  const currencySymbol = getCurrencySymbol(settings?.currency || 'BRL');
  const [activeTab, setActiveTab] = useState<'calculator' | 'saved'>('calculator');
  const [savedFichas, setSavedFichas] = useState<FichaTecnica[]>([]);
  const [isLoadingFichas, setIsLoadingFichas] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [yieldUnits, setYieldUnits] = useState<number>(1);
  const [yieldUnitName, setYieldUnitName] = useState<string>('unidade');

  // Ingredients list
  const [ingredients, setIngredients] = useState<IngredientCost[]>([
    {
      id: 'ing-1',
      name: 'Farinha de Trigo Especial',
      packageQuantity: 1000,
      packageUnit: 'g',
      packagePrice: 6.50,
      recipeQuantity: 300,
      recipeUnit: 'g'
    },
    {
      id: 'ing-2',
      name: 'Leite Condensado',
      packageQuantity: 395,
      packageUnit: 'g',
      packagePrice: 7.90,
      recipeQuantity: 395,
      recipeUnit: 'g'
    },
    {
      id: 'ing-3',
      name: 'Embalagem Especial / Caixa',
      packageQuantity: 1,
      packageUnit: 'un',
      packagePrice: 4.50,
      recipeQuantity: 1,
      recipeUnit: 'un'
    }
  ]);

  // Operational & Labor
  const [prepTimeMinutes, setPrepTimeMinutes] = useState<number>(60);
  const [hourlyRate, setHourlyRate] = useState<number>(25.00);
  const [fixedCostPercent, setFixedCostPercent] = useState<number>(15); // 15% para gás, luz, água

  // Commercial & Profit Margin
  const [cardFeePercent, setCardFeePercent] = useState<number>(3.5);
  const [targetProfitPercent, setTargetProfitPercent] = useState<number>(60);

  // Load saved fichas from Firestore
  useEffect(() => {
    if (!db) {
      setIsLoadingFichas(false);
      return;
    }
    const unsub = onSnapshot(collection(db, 'fichas_tecnicas'), (snapshot) => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as FichaTecnica));
      setSavedFichas(list);
      setIsLoadingFichas(false);
    }, (err) => {
      console.warn('Erro ao carregar fichas tecnicas:', err);
      setIsLoadingFichas(false);
    });

    return () => unsub();
  }, []);

  // When a product from menu is selected, pre-fill title and check price
  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  useEffect(() => {
    if (selectedProduct) {
      setTitle(selectedProduct.title);
    }
  }, [selectedProduct]);

  // Ingredient cost computation helper
  const computeItemCost = (item: IngredientCost): number => {
    if (!item.packageQuantity || item.packageQuantity <= 0 || !item.packagePrice) return 0;
    
    // Normalize units
    let pkgQty = item.packageQuantity;
    let recQty = item.recipeQuantity;

    // g to kg or vice versa
    if (item.packageUnit === 'kg' && item.recipeUnit === 'g') {
      pkgQty *= 1000;
    } else if (item.packageUnit === 'g' && item.recipeUnit === 'kg') {
      recQty *= 1000;
    }

    // ml to L or vice versa
    if (item.packageUnit === 'L' && item.recipeUnit === 'ml') {
      pkgQty *= 1000;
    } else if (item.packageUnit === 'ml' && item.recipeUnit === 'L') {
      recQty *= 1000;
    }

    const unitPrice = item.packagePrice / pkgQty;
    return unitPrice * recQty;
  };

  // Calculations
  const calculations = useMemo(() => {
    // 1. Insumos Total (CMV)
    const rawIngredientsTotal = ingredients.reduce((acc, it) => acc + computeItemCost(it), 0);

    // 2. Mão de Obra
    const laborCost = (prepTimeMinutes / 60) * hourlyRate;

    // 3. Custos Fixos (Gás, energia, etc.)
    const fixedCosts = rawIngredientsTotal * (fixedCostPercent / 100);

    // 4. Custo Total de Produção
    const totalProductionCost = rawIngredientsTotal + laborCost + fixedCosts;

    // 5. Custo por Unidade
    const safeYield = Math.max(1, yieldUnits || 1);
    const unitCost = totalProductionCost / safeYield;

    // 6. Preço Sugerido com Margem e Taxa de Cartão
    // Fórmula: Preço = (Custo Unitário * (1 + Margem%)) / (1 - TaxaCartão%)
    const marginMultiplier = 1 + (targetProfitPercent / 100);
    const feeDenominator = Math.max(0.01, 1 - (cardFeePercent / 100));
    const suggestedSalePrice = (unitCost * marginMultiplier) / feeDenominator;

    // 7. Lucro Líquido por Unidade
    const feesPaid = suggestedSalePrice * (cardFeePercent / 100);
    const netProfitUnit = suggestedSalePrice - unitCost - feesPaid;
    const realProfitPercent = unitCost > 0 ? (netProfitUnit / unitCost) * 100 : targetProfitPercent;

    // 8. Ponto de Equilíbrio (preço mínimo para não perder dinheiro)
    const breakEvenPrice = unitCost / feeDenominator;

    return {
      rawIngredientsTotal,
      laborCost,
      fixedCosts,
      totalProductionCost,
      unitCost,
      suggestedSalePrice,
      netProfitUnit,
      realProfitPercent,
      breakEvenPrice
    };
  }, [ingredients, prepTimeMinutes, hourlyRate, fixedCostPercent, cardFeePercent, targetProfitPercent, yieldUnits]);

  // Add new ingredient row
  const handleAddIngredient = () => {
    setIngredients(prev => [
      ...prev,
      {
        id: `ing-${Date.now()}`,
        name: '',
        packageQuantity: 1000,
        packageUnit: 'g',
        packagePrice: 0,
        recipeQuantity: 100,
        recipeUnit: 'g'
      }
    ]);
  };

  // Remove ingredient row
  const handleRemoveIngredient = (id: string) => {
    setIngredients(prev => prev.filter(it => it.id !== id));
  };

  // Update ingredient field
  const handleUpdateIngredient = (id: string, field: keyof IngredientCost, value: any) => {
    setIngredients(prev => prev.map(it => {
      if (it.id === id) {
        return { ...it, [field]: value };
      }
      return it;
    }));
  };

  // Save Ficha Técnica to Firestore
  const handleSaveFicha = async () => {
    if (!title.trim()) {
      toast.error('Informe um nome para a receita ou selecione um produto.');
      return;
    }
    setIsSaving(true);
    try {
      const fichaData: Omit<FichaTecnica, 'id'> = {
        title: title.trim(),
        productId: selectedProductId || undefined,
        yieldUnits: Math.max(1, yieldUnits || 1),
        yieldUnitName: yieldUnitName || 'unidade',
        ingredients,
        prepTimeMinutes,
        hourlyRate,
        fixedCostPercent,
        cardFeePercent,
        targetProfitPercent,
        totalProductionCost: calculations.totalProductionCost,
        unitCost: calculations.unitCost,
        suggestedSalePrice: calculations.suggestedSalePrice,
        actualPrice: selectedProduct ? (selectedProduct.price || selectedProduct.oldPrice || 0) : undefined,
        netProfitUnit: calculations.netProfitUnit,
        updatedAt: serverTimestamp()
      };

      if (db) {
        await addDoc(collection(db, 'fichas_tecnicas'), fichaData);
      }
      toast.success('Ficha Técnica de Precificação salva com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar ficha:', err);
      toast.error('Erro ao salvar ficha técnica.');
    } finally {
      setIsSaving(false);
    }
  };

  // Apply suggested price directly to Product in Firestore
  const handleApplyPriceToProduct = async () => {
    if (!selectedProduct?.id) {
      toast.error('Selecione um produto do cardápio para atualizar o preço.');
      return;
    }
    const roundedPrice = Math.round(calculations.suggestedSalePrice * 100) / 100;
    try {
      if (db) {
        await updateDoc(doc(db, 'produtos', selectedProduct.id), {
          price: roundedPrice
        });
      }
      toast.success(`Preço de "${selectedProduct.title}" atualizado para ${currencySymbol} ${roundedPrice.toFixed(2).replace('.', ',')} no cardápio!`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar preço do produto.');
    }
  };

  // Load a saved ficha into the calculator
  const handleLoadFicha = (f: FichaTecnica) => {
    setTitle(f.title || '');
    setSelectedProductId(f.productId || '');
    setYieldUnits(f.yieldUnits || 1);
    setYieldUnitName(f.yieldUnitName || 'unidade');
    setIngredients(f.ingredients || []);
    setPrepTimeMinutes(f.prepTimeMinutes || 60);
    setHourlyRate(f.hourlyRate || 25);
    setFixedCostPercent(f.fixedCostPercent || 15);
    setCardFeePercent(f.cardFeePercent || 3.5);
    setTargetProfitPercent(f.targetProfitPercent || 50);
    setActiveTab('calculator');
    toast.info(`Ficha "${f.title}" carregada na calculadora!`);
  };

  // Delete saved ficha
  const handleDeleteFicha = async (id: string) => {
    try {
      if (db && id) {
        await deleteDoc(doc(db, 'fichas_tecnicas', id));
      }
      toast.success('Ficha técnica excluída.');
    } catch (err) {
      toast.error('Erro ao excluir ficha.');
    }
  };

  return (
    <div className="max-w-6xl space-y-8 pb-16">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-md p-6 sm:p-7 rounded-3xl shadow-sm border border-black/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-800 shrink-0 shadow-inner">
            <Calculator size={28} />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900 leading-tight">
              Precificação Estratégica & Ficha Técnica
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              Mapeie custos de ingredientes, mão de obra e calcule o preço de venda exato com margem real de lucro.
            </p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-2xl self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('calculator')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
              activeTab === 'calculator' 
                ? "bg-white text-gray-900 shadow-sm" 
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            Calculadora Ativa
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('saved')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
              activeTab === 'saved' 
                ? "bg-white text-gray-900 shadow-sm" 
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            <FolderOpen size={14} /> Fichas Salvas ({savedFichas.length})
          </button>
        </div>
      </div>

      {activeTab === 'calculator' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Data inputs & Ingredients table (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 1. Seleção e Dados Básicos */}
            <div className="bg-white/95 backdrop-blur-md p-6 rounded-3xl shadow-sm border border-black/10 space-y-4">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-700 border-b border-gray-100 pb-3">
                <Package size={16} className="text-amber-700" />
                <span>1. Identificação do Produto / Receita</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-600">Vincular a Produto do Cardápio</label>
                  <select
                    value={selectedProductId}
                    onChange={e => setSelectedProductId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900"
                  >
                    <option value="">-- Criar receita avulsa --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.title} (Preço Atual: {currencySymbol} {((p.price || p.oldPrice || 0)).toFixed(2).replace('.', ',')})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-600">Nome da Receita / Produto *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Bolo Vulcão de Ninho com Nutella"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-600">Rendimento da Receita</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={yieldUnits}
                      onChange={e => setYieldUnits(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-24 p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-center text-gray-900"
                    />
                    <input
                      type="text"
                      placeholder="unidade, fatias, kg, potes"
                      value={yieldUnitName}
                      onChange={e => setYieldUnitName(e.target.value)}
                      className="flex-grow p-2.5 rounded-xl border border-gray-300 bg-white text-xs text-gray-900"
                    />
                  </div>
                </div>

                {selectedProduct && (
                  <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200/70 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-black uppercase text-amber-800 block">Preço Atual no Cardápio</span>
                      <strong className="text-base text-gray-900 font-extrabold">
                        {currencySymbol} {((selectedProduct.price || selectedProduct.oldPrice || 0)).toFixed(2).replace('.', ',')}
                      </strong>
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyPriceToProduct}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[11px] font-bold transition-all shadow-xs cursor-pointer"
                    >
                      Aplicar Sugerido
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Tabela de Insumos & Ingredientes */}
            <div className="bg-white/95 backdrop-blur-md p-6 rounded-3xl shadow-sm border border-black/10 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-700">
                  <Layers size={16} style={{ color: settings?.primaryColor || '#865d39' }} />
                  <span>2. Insumos & Ingredientes Utilizados</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddIngredient}
                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <Plus size={14} /> Adicionar Insumo
                </button>
              </div>

              {ingredients.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-xs">
                  Nenhum ingrediente adicionado. Clique no botão acima para inserir os itens da receita.
                </div>
              ) : (
                <div className="space-y-3">
                  {ingredients.map((item, idx) => {
                    const itemCost = computeItemCost(item);
                    return (
                      <div key={item.id} className="p-3.5 bg-gray-50/90 rounded-2xl border border-gray-200/80 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            placeholder="Nome do ingrediente (ex: Leite Moça, Morango, Caixa)"
                            value={item.name}
                            onChange={e => handleUpdateIngredient(item.id, 'name', e.target.value)}
                            className="flex-grow p-2 text-xs font-bold rounded-xl border border-gray-300 bg-white text-gray-900"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveIngredient(item.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                            title="Remover"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          {/* Qtd Compra */}
                          <div className="space-y-0.5">
                            <span className="text-[9px] font-bold text-gray-500 uppercase">Qtd Embalagem</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="any"
                                min="0.01"
                                value={item.packageQuantity}
                                onChange={e => handleUpdateIngredient(item.id, 'packageQuantity', parseFloat(e.target.value) || 0)}
                                className="w-full p-1.5 rounded-lg border border-gray-300 bg-white text-xs font-semibold"
                              />
                              <select
                                value={item.packageUnit}
                                onChange={e => handleUpdateIngredient(item.id, 'packageUnit', e.target.value)}
                                className="p-1.5 rounded-lg border border-gray-300 bg-white text-[11px] font-bold"
                              >
                                <option value="g">g</option>
                                <option value="kg">kg</option>
                                <option value="ml">ml</option>
                                <option value="L">L</option>
                                <option value="un">un</option>
                              </select>
                            </div>
                          </div>

                          {/* Preço Compra */}
                          <div className="space-y-0.5">
                            <span className="text-[9px] font-bold text-gray-500 uppercase">Preço Pago ({currencySymbol})</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.packagePrice}
                              onChange={e => handleUpdateIngredient(item.id, 'packagePrice', parseFloat(e.target.value) || 0)}
                              className="w-full p-1.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-900"
                            />
                          </div>

                          {/* Qtd Usada */}
                          <div className="space-y-0.5">
                            <span className="text-[9px] font-bold text-gray-500 uppercase">Gasto na Receita</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="any"
                                min="0.01"
                                value={item.recipeQuantity}
                                onChange={e => handleUpdateIngredient(item.id, 'recipeQuantity', parseFloat(e.target.value) || 0)}
                                className="w-full p-1.5 rounded-lg border border-gray-300 bg-white text-xs font-semibold"
                              />
                              <select
                                value={item.recipeUnit}
                                onChange={e => handleUpdateIngredient(item.id, 'recipeUnit', e.target.value)}
                                className="p-1.5 rounded-lg border border-gray-300 bg-white text-[11px] font-bold"
                              >
                                <option value="g">g</option>
                                <option value="kg">kg</option>
                                <option value="ml">ml</option>
                                <option value="L">L</option>
                                <option value="un">un</option>
                              </select>
                            </div>
                          </div>

                          {/* Custo Calculado */}
                          <div className="space-y-0.5 bg-amber-50/80 p-1.5 rounded-xl border border-amber-200/80 flex flex-col justify-center text-right">
                            <span className="text-[9px] font-black uppercase text-amber-900">Custo Parcial</span>
                            <strong className="text-xs text-[#5c3a21] font-extrabold">
                              {currencySymbol} {itemCost.toFixed(2).replace('.', ',')}
                            </strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-xs font-bold text-gray-600 uppercase">Subtotal Insumos (CMV):</span>
                    <strong className="text-sm font-black text-gray-900">
                      {currencySymbol} {calculations.rawIngredientsTotal.toFixed(2).replace('.', ',')}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Mão de Obra e Custos Operacionais */}
            <div className="bg-white/95 backdrop-blur-md p-6 rounded-3xl shadow-sm border border-black/10 space-y-4">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-700 border-b border-gray-100 pb-3">
                <Clock size={16} className="text-amber-700" />
                <span>3. Mão de Obra & Custos Operacionais</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-600">Tempo de Preparo (minutos)</label>
                  <input
                    type="number"
                    min="1"
                    value={prepTimeMinutes}
                    onChange={e => setPrepTimeMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900"
                  />
                  <span className="text-[9px] text-gray-500 font-medium">Ex: 60 min = 1 hora</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-600">Valor da sua Hora ({currencySymbol})</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={hourlyRate}
                    onChange={e => setHourlyRate(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900"
                  />
                  <span className="text-[9px] text-gray-500 font-medium">Custo MO: {currencySymbol} {calculations.laborCost.toFixed(2).replace('.', ',')}</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-600">Custos Fixos / Indiretos (%)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={fixedCostPercent}
                    onChange={e => setFixedCostPercent(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900"
                  />
                  <span className="text-[9px] text-gray-500 font-medium">Gás, luz, água: {currencySymbol} {calculations.fixedCosts.toFixed(2).replace('.', ',')}</span>
                </div>
              </div>
            </div>

            {/* 4. Taxas e Margem Desejada */}
            <div className="bg-white/95 backdrop-blur-md p-6 rounded-3xl shadow-sm border border-black/10 space-y-4">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-700 border-b border-gray-100 pb-3">
                <Percent size={16} className="text-amber-700" />
                <span>4. Margem de Lucro & Taxas de Pagamento</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-600">Margem de Lucro Desejada (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="5"
                      min="0"
                      value={targetProfitPercent}
                      onChange={e => setTargetProfitPercent(parseFloat(e.target.value) || 0)}
                      className="w-full p-2.5 pr-8 rounded-xl border border-amber-300 bg-white text-xs font-bold text-amber-950"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-xs text-amber-800">%</span>
                  </div>
                  <span className="text-[9px] text-gray-500 font-medium">Lucro livre sobre os custos</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-600">Taxa de Cartão / Gateway (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={cardFeePercent}
                      onChange={e => setCardFeePercent(parseFloat(e.target.value) || 0)}
                      className="w-full p-2.5 pr-8 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-xs text-gray-500">%</span>
                  </div>
                  <span className="text-[9px] text-gray-500 font-medium">Padrão maquininhas / PIX (3% a 5%)</span>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Real-Time Results & Action Card (5 cols sticky) */}
          <div className="lg:col-span-5 space-y-6 sticky top-6">
            
            {/* Main Result Card (Design Claro, Elegante e com Alto Contraste) */}
            <div className="bg-white/95 backdrop-blur-md text-gray-900 p-6 sm:p-7 rounded-3xl shadow-lg border border-amber-300/70 space-y-6 ring-1 ring-amber-200/50">
              
              <div className="border-b border-gray-100 pb-4 space-y-1.5">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  <Sparkles size={12} className="text-amber-800" />
                  Diagnóstico Financeiro em Tempo Real
                </span>
                <h3 className="text-2xl font-serif font-black text-gray-950 pt-1">
                  {title || 'Nova Receita'}
                </h3>
                <p className="text-xs text-gray-600 font-medium">
                  Rendimento: <strong className="text-gray-950 font-bold">{yieldUnits} {yieldUnitName}(s)</strong>
                </p>
              </div>

              {/* Preço de Venda Sugerido - Destaque Principal em Caixa Clara e Nítida */}
              <div className="bg-gradient-to-br from-amber-50 via-amber-100/40 to-orange-50/60 p-5 rounded-2xl border-2 border-amber-400 shadow-xs space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-950 block">
                  Preço de Venda Sugerido (por {yieldUnitName}):
                </span>
                <div className="text-3xl sm:text-4xl font-black text-amber-950 tracking-tight font-serif">
                  {currencySymbol} {calculations.suggestedSalePrice.toFixed(2).replace('.', ',')}
                </div>
                <span className="text-xs text-amber-900/80 font-semibold block leading-tight">
                  Cobre todos os insumos, mão de obra, custos fixos e taxas com sua margem calculada.
                </span>
              </div>

              {/* Detalhamento de Custos com Alto Contraste */}
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 text-gray-700">
                  <span className="font-semibold">Custo Total da Receita:</span>
                  <span className="font-extrabold text-sm text-gray-900 font-mono">
                    {currencySymbol} {calculations.totalProductionCost.toFixed(2).replace('.', ',')}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 text-gray-700">
                  <span className="font-semibold">Custo de Produção por {yieldUnitName}:</span>
                  <span className="font-extrabold text-sm text-gray-900 font-mono">
                    {currencySymbol} {calculations.unitCost.toFixed(2).replace('.', ',')}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl bg-amber-50/90 border border-amber-200/90 text-amber-950">
                  <span className="font-bold text-xs">Lucro Líquido Real por {yieldUnitName}:</span>
                  <span className="font-black text-sm">
                    +{currencySymbol} {calculations.netProfitUnit.toFixed(2).replace('.', ',')} ({calculations.realProfitPercent.toFixed(1)}%)
                  </span>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 text-gray-700">
                  <span className="font-semibold">Ponto de Equilíbrio (Preço Mínimo):</span>
                  <span className="font-bold text-sm text-gray-900 font-mono">
                    {currencySymbol} {calculations.breakEvenPrice.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>

              {/* Comparativo se for produto existente */}
              {selectedProduct && (() => {
                const currentPrice = selectedProduct.price || selectedProduct.oldPrice || 0;
                const diff = currentPrice - calculations.suggestedSalePrice;
                const isUnderpriced = diff < -0.5;

                return (
                  <div className={cn(
                    "p-4 rounded-2xl border text-xs space-y-1.5",
                    isUnderpriced 
                      ? "bg-red-50 border-red-200 text-red-900" 
                      : "bg-amber-50 border-amber-300 text-amber-950"
                  )}>
                    <div className="flex items-center gap-2 font-black text-xs">
                      {isUnderpriced ? <AlertTriangle size={17} className="text-red-600 shrink-0" /> : <CheckCircle2 size={17} className="text-amber-700 shrink-0" />}
                      <span>
                        {isUnderpriced ? 'Atenção: Preço Atual Abaixo do Sugerido!' : 'Excelente: Preço no Cardápio Altamente Lucrativo!'}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed font-medium">
                      {isUnderpriced 
                        ? `Você está cobrando ${currencySymbol} ${currentPrice.toFixed(2).replace('.', ',')}, que está ${currencySymbol} ${Math.abs(diff).toFixed(2).replace('.', ',')} abaixo do valor ideal com sua margem desejada.` 
                        : `Você cobra ${currencySymbol} ${currentPrice.toFixed(2).replace('.', ',')}, garantindo retorno financeiro saudável.`
                      }
                    </p>
                  </div>
                );
              })()}

              {/* Actions */}
              <div className="space-y-3 pt-2">
                {selectedProduct && (
                  <button
                    type="button"
                    onClick={handleApplyPriceToProduct}
                    className="w-full py-3.5 px-4 text-white rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2 hover:brightness-110"
                    style={{ 
                      backgroundColor: settings?.primaryColor || '#865d39',
                      color: getContrastText(settings?.primaryColor || '#865d39')
                    }}
                  >
                    <ArrowRight size={16} /> Atualizar Preço no Cardápio
                  </button>
                )}

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveFicha}
                  className="w-full py-3.5 px-4 bg-[#4a2e18] hover:bg-[#3b2413] disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Save size={16} /> {isSaving ? 'Salvando...' : 'Salvar Ficha Técnica'}
                </button>
              </div>

            </div>

          </div>

        </div>
      ) : (
        /* Saved Fichas List */
        <div className="bg-white/95 backdrop-blur-md p-6 sm:p-8 rounded-3xl shadow-sm border border-black/10 space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-xl font-serif font-bold text-gray-900">
                Fichas Técnicas Cadastradas
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Consulte ou recarregue qualquer ficha técnica para recalcular os preços.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('calculator')}
              className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Plus size={14} /> Nova Precificação
            </button>
          </div>

          {savedFichas.length === 0 ? (
            <div className="p-12 text-center text-gray-500 space-y-3">
              <FolderOpen size={40} className="mx-auto text-gray-300" />
              <p className="text-sm font-semibold">Nenhuma ficha técnica salva ainda.</p>
              <p className="text-xs text-gray-400">
                Calcule os custos na aba "Calculadora Ativa" e clique em "Salvar Ficha Técnica".
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedFichas.map(f => (
                <div key={f.id} className="p-5 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-3 flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-gray-500">
                        {f.yieldUnits} {f.yieldUnitName || 'un'}
                      </span>
                      <button
                        type="button"
                        onClick={() => f.id && handleDeleteFicha(f.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                        title="Excluir ficha"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <h4 className="font-bold text-base text-gray-900 line-clamp-1">{f.title}</h4>
                    <p className="text-xs text-gray-500">
                      {f.ingredients?.length || 0} ingredientes mapeados
                    </p>
                  </div>

                  <div className="space-y-1 pt-2 border-t border-gray-200 text-xs">
                    <div className="flex justify-between text-gray-600">
                      <span>Custo Unitário:</span>
                      <span className="font-bold text-gray-900">
                        {currencySymbol} {(f.unitCost || 0).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold" style={{ color: settings?.primaryColor || '#865d39' }}>
                      <span>Preço Sugerido:</span>
                      <span>
                        {currencySymbol} {(f.suggestedSalePrice || 0).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleLoadFicha(f)}
                    className="w-full py-2 bg-white hover:bg-gray-100 border border-gray-300 text-gray-800 text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw size={13} /> Carregar na Calculadora
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
