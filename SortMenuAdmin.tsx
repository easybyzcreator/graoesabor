import React, { useState, useMemo } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import { Product, Category, Settings } from '../types';
import { 
  ArrowUpDown, Package, Layers, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, 
  ListOrdered, Sparkles, Edit2, CheckCircle2, Loader2, Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { getCurrencySymbol } from '../utils/countryUtils';

interface SortMenuAdminProps {
  categories: Category[];
  products: Product[];
  settings: Settings;
  onGoToProducts: () => void;
  onEditProduct: (product: Product) => void;
}

export const SortMenuAdmin: React.FC<SortMenuAdminProps> = ({
  categories,
  products,
  settings,
  onGoToProducts,
  onEditProduct
}) => {
  const currencySymbol = getCurrencySymbol(settings?.currency || 'BRL');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(() => {
    return categories[0]?.id || '';
  });
  const [isSaving, setIsSaving] = useState(false);

  // Garantir que a categoria selecionada seja válida
  const currentCategory = useMemo(() => {
    return categories.find(c => c.id === selectedCategoryId) || categories[0] || null;
  }, [categories, selectedCategoryId]);

  // Produtos filtrados e ordenados da categoria selecionada
  const categoryProducts = useMemo(() => {
    if (!currentCategory) return [];
    const list = products.filter(p => p.categoryId === currentCategory.id);
    return list.sort((a, b) => {
      const orderA = typeof a.order === 'number' ? a.order : 999;
      const orderB = typeof b.order === 'number' ? b.order : 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.title.localeCompare(b.title);
    });
  }, [products, currentCategory]);

  // Reordenar movendo item para cima ou para baixo
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categoryProducts.length) return;

    const currentItem = categoryProducts[index];
    const targetItem = categoryProducts[targetIndex];

    try {
      setIsSaving(true);
      // Atribuir ordens sequenciais explícitas a todos os itens da categoria para estabilidade
      const updatedList = [...categoryProducts];
      updatedList[index] = targetItem;
      updatedList[targetIndex] = currentItem;

      const batch = writeBatch(db);
      updatedList.forEach((item, idx) => {
        const ref = doc(db, 'produtos', item.id);
        batch.update(ref, { order: idx + 1 });
      });

      await batch.commit();
      toast.success('Ordem atualizada!');
    } catch (err) {
      console.error('Erro ao reordenar:', err);
      toast.error('Erro ao salvar nova ordem.');
    } finally {
      setIsSaving(false);
    }
  };

  // Mover direto para o topo
  const handleMoveToTop = async (index: number) => {
    if (index === 0) return;
    try {
      setIsSaving(true);
      const itemToMove = categoryProducts[index];
      const otherItems = categoryProducts.filter((_, idx) => idx !== index);
      const updatedList = [itemToMove, ...otherItems];

      const batch = writeBatch(db);
      updatedList.forEach((item, idx) => {
        const ref = doc(db, 'produtos', item.id);
        batch.update(ref, { order: idx + 1 });
      });

      await batch.commit();
      toast.success(`"${itemToMove.title}" movido para o topo!`);
    } catch (err) {
      console.error('Erro ao mover para o topo:', err);
      toast.error('Erro ao salvar ordem.');
    } finally {
      setIsSaving(false);
    }
  };

  // Mover direto para o final
  const handleMoveToBottom = async (index: number) => {
    if (index === categoryProducts.length - 1) return;
    try {
      setIsSaving(true);
      const itemToMove = categoryProducts[index];
      const otherItems = categoryProducts.filter((_, idx) => idx !== index);
      const updatedList = [...otherItems, itemToMove];

      const batch = writeBatch(db);
      updatedList.forEach((item, idx) => {
        const ref = doc(db, 'produtos', item.id);
        batch.update(ref, { order: idx + 1 });
      });

      await batch.commit();
      toast.success(`"${itemToMove.title}" movido para o final!`);
    } catch (err) {
      console.error('Erro ao mover para o final:', err);
      toast.error('Erro ao salvar ordem.');
    } finally {
      setIsSaving(false);
    }
  };

  // Numerar sequencialmente (1, 2, 3...)
  const handleRenumberSequential = async () => {
    if (categoryProducts.length === 0) return;
    try {
      setIsSaving(true);
      const batch = writeBatch(db);
      categoryProducts.forEach((item, idx) => {
        const ref = doc(db, 'produtos', item.id);
        batch.update(ref, { order: idx + 1 });
      });
      await batch.commit();
      toast.success(`Numeração sequencial (1 a ${categoryProducts.length}) salva com sucesso!`);
    } catch (err) {
      console.error('Erro ao renumerar:', err);
      toast.error('Erro ao renumerar itens.');
    } finally {
      setIsSaving(false);
    }
  };

  // Ordenar alfabeticamente A-Z
  const handleSortAlphabetical = async () => {
    if (categoryProducts.length === 0) return;
    try {
      setIsSaving(true);
      const sorted = [...categoryProducts].sort((a, b) => a.title.localeCompare(b.title));
      const batch = writeBatch(db);
      sorted.forEach((item, idx) => {
        const ref = doc(db, 'produtos', item.id);
        batch.update(ref, { order: idx + 1 });
      });
      await batch.commit();
      toast.success('Produtos ordenados de A a Z com sucesso!');
    } catch (err) {
      console.error('Erro ao ordenar A-Z:', err);
      toast.error('Erro ao ordenar produtos.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      {/* 1. Header Card (exatamente como Imagem 2) */}
      <div className="bg-white/95 backdrop-blur-md p-6 sm:p-7 rounded-3xl shadow-sm border border-black/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-800 shrink-0 shadow-inner">
            <ArrowUpDown size={28} />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900 leading-tight">
              Ordenar Cardápio
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              Defina a sequência exata em que os pratos e combos aparecerão para os clientes no cardápio.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onGoToProducts}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <Package size={18} />
          <span>Ir para Cadastro de Pratos</span>
        </button>
      </div>

      {/* 2. Escolha da Categoria (Pills com contador de itens) */}
      <div className="bg-white/95 backdrop-blur-md p-6 rounded-3xl shadow-sm border border-black/10 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-600">
            <Layers size={16} />
            <span>1. Escolha a Categoria para Reordenar</span>
          </div>
          <span className="text-xs font-semibold text-gray-500">
            {categories.length} categoria(s) cadastradas
          </span>
        </div>

        {categories.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            Nenhuma categoria cadastrada ainda. Crie categorias na aba "Categorias" para começar.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2.5 pt-1">
            {categories.map((cat) => {
              const count = products.filter(p => p.categoryId === cat.id).length;
              const isSelected = (currentCategory?.id === cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-sm border",
                    isSelected 
                      ? "shadow-md scale-[1.02]" 
                      : "bg-white hover:bg-gray-50 text-gray-700 border-gray-200"
                  )}
                  style={isSelected ? { 
                    backgroundColor: settings?.primaryColor || '#36402c', 
                    color: '#ffffff',
                    borderColor: settings?.primaryColor || '#36402c' 
                  } : {}}
                >
                  <span>{cat.title}</span>
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-extrabold",
                    isSelected ? "bg-white/25 text-white" : "bg-gray-100 text-gray-600"
                  )}>
                    {count} {count === 1 ? 'item' : 'itens'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Painel de Controle e Lista da Categoria Selecionada */}
      {currentCategory && (
        <div className="space-y-4">
          {/* Barra de Ações Rápidas da Categoria */}
          <div className="bg-white/95 backdrop-blur-md p-5 rounded-3xl shadow-sm border border-black/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center font-serif font-black text-lg text-gray-800 shadow-inner">
                {currentCategory.title.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-serif font-bold text-gray-900">
                    {currentCategory.title}
                  </h3>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                    {categoryProducts.length} pratos ativos
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Use as setas para alterar a posição ou reordenar instantaneamente.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
              <button
                type="button"
                disabled={isSaving || categoryProducts.length <= 1}
                onClick={handleRenumberSequential}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-40"
              >
                <ListOrdered size={16} />
                <span>Numerar Sequencial</span>
              </button>

              <button
                type="button"
                disabled={isSaving || categoryProducts.length <= 1}
                onClick={handleSortAlphabetical}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-40"
              >
                <Sparkles size={16} />
                <span>Ordem A-Z</span>
              </button>
            </div>
          </div>

          {/* Lista Reordenável de Pratos */}
          {categoryProducts.length === 0 ? (
            <div className="bg-white/95 backdrop-blur-md p-12 rounded-3xl text-center text-gray-500 border border-black/10 shadow-sm space-y-3">
              <Package size={36} className="mx-auto text-gray-300" />
              <p className="text-sm font-semibold">Nenhum produto cadastrado nesta categoria.</p>
              <button
                type="button"
                onClick={onGoToProducts}
                className="px-4 py-2 bg-gray-800 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-gray-900 transition-all cursor-pointer"
              >
                + Cadastrar Produto nesta Categoria
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {categoryProducts.map((product, index) => {
                const isFirst = index === 0;
                const isLast = index === categoryProducts.length - 1;

                return (
                  <motion.div
                    key={product.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="bg-white/95 backdrop-blur-md p-4 sm:p-5 rounded-3xl shadow-sm border border-black/10 flex items-center justify-between gap-3 sm:gap-4 hover:shadow-md transition-all group"
                  >
                    {/* Controles de Posição: Setas e Badge de Número */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          disabled={isFirst || isSaving}
                          onClick={() => handleMove(index, 'up')}
                          className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-gray-200 disabled:opacity-20 flex items-center justify-center text-gray-700 transition-all cursor-pointer border border-gray-200"
                          title="Mover para cima"
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          disabled={isLast || isSaving}
                          onClick={() => handleMove(index, 'down')}
                          className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-gray-200 disabled:opacity-20 flex items-center justify-center text-gray-700 transition-all cursor-pointer border border-gray-200"
                          title="Mover para baixo"
                        >
                          <ArrowDown size={16} />
                        </button>
                      </div>

                      {/* Badge do Número */}
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center font-bold text-xs sm:text-sm text-gray-800 shadow-inner">
                        #{index + 1}
                      </div>
                    </div>

                    {/* Imagem do Produto */}
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0 shadow-sm flex items-center justify-center">
                      {product.image ? (
                        <img 
                          src={product.image} 
                          alt={product.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <ImageIcon size={22} className="text-gray-300" />
                      )}
                    </div>

                    {/* Informações do Produto */}
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm sm:text-base text-gray-900 truncate">
                          {product.title}
                        </h4>
                      </div>
                      {product.description && (
                        <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                          {product.description}
                        </p>
                      )}
                      <p className="text-xs sm:text-sm font-extrabold text-black mt-1" style={{ color: settings?.primaryColor || '#865d39' }}>
                        {currencySymbol} {((product.price || product.oldPrice || 0)).toFixed(2)}
                      </p>
                    </div>

                    {/* Ações Rápidas: Topo, Fim e Editar */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={isFirst || isSaving}
                        onClick={() => handleMoveToTop(index)}
                        className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all cursor-pointer disabled:opacity-20 hidden sm:flex"
                        title="Mover direto para o topo"
                      >
                        <ChevronsUp size={18} />
                      </button>
                      <button
                        type="button"
                        disabled={isLast || isSaving}
                        onClick={() => handleMoveToBottom(index)}
                        className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all cursor-pointer disabled:opacity-20 hidden sm:flex"
                        title="Mover direto para o final"
                      >
                        <ChevronsDown size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditProduct(product)}
                        className="p-2.5 text-amber-900 hover:bg-amber-50 bg-white border border-amber-200/80 rounded-2xl shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
                        title="Editar produto"
                      >
                        <Edit2 size={16} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
