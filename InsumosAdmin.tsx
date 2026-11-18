import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  Plus, 
  ExternalLink, 
  Trash2, 
  Edit3, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Search, 
  Sparkles, 
  Check, 
  X,
  Upload,
  AlertCircle,
  PackageCheck
} from 'lucide-react';
import { collection, onSnapshot, addDoc, updateDoc, setDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Insumo, Settings } from '../types';

interface InsumosAdminProps {
  settings: Settings;
}

// Initial suggested recommended items if empty
const INITIAL_RECOMMENDED_INSUMOS: Omit<Insumo, 'id'>[] = [
  {
    title: 'Embalagem Kraft Térmica c/ Visor',
    description: 'Excelente para manter o calor dos produtos, apresentação profissional e sustentável para entregas.',
    image: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=500&auto=format&fit=crop&q=60',
    link: 'https://www.google.com/search?q=embalagem+kraft+alimentos',
    category: 'Embalagens'
  },
  {
    title: 'Potes Herméticos e Tampas Livres de BPA',
    description: 'Ideais para molhos, recheios e acompanhamentos garantindo vedação total sem vazamentos.',
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=60',
    link: 'https://www.google.com/search?q=potes+hermeticos+delivery',
    category: 'Embalagens'
  },
  {
    title: 'Chocolate Nobre 70% Cacau & Gotas Forneáveis',
    description: 'Insumo de altíssimo rendimento para doces refinados e sabor marcante premium.',
    image: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=500&auto=format&fit=crop&q=60',
    link: 'https://www.google.com/search?q=chocolate+nobre+confeitaria',
    category: 'Ingredientes'
  }
];

export const InsumosAdmin: React.FC<InsumosAdminProps> = ({ settings }) => {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    image: string;
    link: string;
    category: string;
  }>({
    title: '',
    description: '',
    image: '',
    link: '',
    category: 'Embalagens'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Categories available
  const categoriesList = ['Todos', 'Embalagens', 'Ingredientes', 'Utensílios', 'Equipamentos', 'Outros'];

  // Subscribe to Firestore 'insumos' collection
  useEffect(() => {
    if (!db) {
      // Fallback local storage
      const saved = localStorage.getItem('recommended_insumos');
      if (saved) {
        try {
          setInsumos(JSON.parse(saved));
        } catch {
          setInsumos(INITIAL_RECOMMENDED_INSUMOS.map((item, idx) => ({ id: `default-${idx}`, ...item })));
        }
      } else {
        setInsumos(INITIAL_RECOMMENDED_INSUMOS.map((item, idx) => ({ id: `default-${idx}`, ...item })));
      }
      setLoading(false);
      return;
    }

    try {
      const unsub = onSnapshot(collection(db, 'insumos'), (snapshot) => {
        if (!snapshot.empty) {
          const loaded = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Insumo));
          setInsumos(loaded);
        } else {
          // If empty in DB, show initial defaults
          setInsumos(INITIAL_RECOMMENDED_INSUMOS.map((item, idx) => ({ id: `default-${idx}`, ...item })));
        }
        setLoading(false);
      }, (err) => {
        console.warn('Insumos: Firebase listener error:', err);
        const saved = localStorage.getItem('recommended_insumos');
        if (saved) {
          try {
            setInsumos(JSON.parse(saved));
          } catch {
            setInsumos(INITIAL_RECOMMENDED_INSUMOS.map((item, idx) => ({ id: `default-${idx}`, ...item })));
          }
        } else {
          setInsumos(INITIAL_RECOMMENDED_INSUMOS.map((item, idx) => ({ id: `default-${idx}`, ...item })));
        }
        setLoading(false);
      });

      return () => unsub();
    } catch (e) {
      console.warn('Error connecting to insumos collection:', e);
      setLoading(false);
    }
  }, []);

  // Save/Edit Insumo
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('Por favor, informe o título do produto/insumo.');
      return;
    }
    if (!formData.image.trim()) {
      alert('Por favor, faça o upload da imagem do insumo.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingInsumo) {
        // Update in Firebase
        if (db) {
          await setDoc(doc(db, 'insumos', editingInsumo.id), {
            title: formData.title,
            description: formData.description,
            image: formData.image,
            link: formData.link,
            category: formData.category,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
        setInsumos(prev => prev.map(i => i.id === editingInsumo.id ? { ...i, ...formData } : i));
      } else {
        // Create new
        if (db) {
          const docRef = await addDoc(collection(db, 'insumos'), {
            title: formData.title,
            description: formData.description,
            image: formData.image,
            link: formData.link,
            category: formData.category,
            createdAt: serverTimestamp()
          });
          const newItem: Insumo = {
            id: docRef.id,
            ...formData
          };
          setInsumos(prev => [newItem, ...prev]);
        } else {
          const newItem: Insumo = {
            id: `local-${Date.now()}`,
            ...formData
          };
          setInsumos(prev => [newItem, ...prev]);
        }
      }

      setIsModalOpen(false);
      setEditingInsumo(null);
      setFormData({
        title: '',
        description: '',
        image: '',
        link: '',
        category: 'Embalagens'
      });
    } catch (err) {
      console.error('Error saving insumo:', err);
      // Even if Firestore has an issue, save locally as fallback
      if (editingInsumo) {
        setInsumos(prev => prev.map(i => i.id === editingInsumo.id ? { ...i, ...formData } : i));
      } else {
        const newItem: Insumo = {
          id: `local-${Date.now()}`,
          ...formData
        };
        setInsumos(prev => [newItem, ...prev]);
      }
      setIsModalOpen(false);
      setEditingInsumo(null);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Insumo
  const handleDelete = async (id: string) => {
    try {
      if (db && !id.startsWith('default-') && !id.startsWith('local-')) {
        await deleteDoc(doc(db, 'insumos', id));
      }
      setInsumos(prev => prev.filter(i => i.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Error deleting insumo:', err);
      alert('Erro ao excluir insumo.');
    }
  };

  // Image Upload handler (Convert and compress to light Base64)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.src = reader.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 600;
        const quality = 0.6;
        
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        setFormData(prev => ({ ...prev, image: compressedBase64 }));
      };
    };
    reader.readAsDataURL(file);
  };

  // Filtered insumos
  const filteredInsumos = insumos.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) || 
                          (item.description && item.description.toLowerCase().includes(search.toLowerCase()));
    const matchesCat = selectedCategory === 'Todos' || item.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="max-w-6xl space-y-8 pb-12">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200/50 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-100/80 text-amber-900 shadow-sm border border-amber-200">
              <ShoppingBag size={24} className="text-[#865d39]" />
            </div>
            <h1 className="text-3xl font-serif font-black" style={{ color: settings.primaryColor || '#865d39' }}>
              Insumos Recomendados
            </h1>
          </div>
          <p className="text-sm text-gray-600 font-semibold mt-1 max-w-2xl">
            Catálogo exclusivo de produtos, embalagens e ingredientes indicados para manter o padrão de qualidade e otimizar as compras.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingInsumo(null);
            setFormData({
              title: '',
              description: '',
              image: '',
              link: '',
              category: 'Embalagens'
            });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl font-extrabold text-sm text-white shadow-lg transition-all cursor-pointer active:scale-95"
          style={{ backgroundColor: settings.primaryColor || '#865d39' }}
        >
          <Plus size={18} /> Adicionar Insumo
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-white/60 shadow-sm">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por insumo ou recomendação..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-300/80 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#865d39]/40"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {categoriesList.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#865d39] text-white shadow-md'
                  : 'bg-white/80 text-gray-600 border border-gray-200/80 hover:bg-gray-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Insumos Grid */}
      {loading ? (
        <div className="py-16 text-center text-gray-400 font-medium">Carregando insumos...</div>
      ) : filteredInsumos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredInsumos.map(insumo => (
            <motion.div
              layout
              key={insumo.id}
              className="bg-white/80 backdrop-blur-md rounded-3xl overflow-hidden border border-white/80 shadow-md hover:shadow-xl transition-all flex flex-col group"
            >
              {/* Product Image */}
              <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-gray-100">
                <img
                  src={insumo.image}
                  alt={insumo.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                {insumo.category && (
                  <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-white/90 backdrop-blur-md text-gray-800 shadow-sm border border-white/50">
                    {insumo.category}
                  </span>
                )}

                {/* Edit & Delete Action Floating Buttons */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingInsumo(insumo);
                      setFormData({
                        title: insumo.title,
                        description: insumo.description || '',
                        image: insumo.image,
                        link: insumo.link,
                        category: insumo.category || 'Embalagens'
                      });
                      setIsModalOpen(true);
                    }}
                    className="p-2 rounded-full bg-white/90 backdrop-blur-md hover:bg-white text-gray-700 shadow-md transition-all active:scale-95 cursor-pointer"
                    title="Editar Insumo"
                  >
                    <Edit3 size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(insumo.id)}
                    className="p-2 rounded-full bg-white/90 backdrop-blur-md hover:bg-red-50 text-red-600 shadow-md transition-all active:scale-95 cursor-pointer"
                    title="Excluir Insumo"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Card Details */}
              <div className="p-5 flex flex-col flex-grow justify-between gap-4">
                <div className="space-y-2">
                  <h3 className="font-serif font-bold text-lg text-gray-900 line-clamp-1">
                    {insumo.title}
                  </h3>
                  {insumo.description && (
                    <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed font-medium">
                      {insumo.description}
                    </p>
                  )}
                </div>

                {/* Link Action Button */}
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-3">
                  {insumo.link ? (
                    <a
                      href={insumo.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                    >
                      <ExternalLink size={15} /> Onde Comprar / Acessar
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400 font-medium italic">Link não cadastrado</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-white/60 rounded-3xl p-12 text-center space-y-4 border border-white/60">
          <ShoppingBag size={48} className="mx-auto text-gray-400 opacity-60" />
          <h3 className="text-lg font-bold text-gray-700">Nenhum insumo encontrado</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            {search ? 'Tente buscar com outros termos.' : 'Clique no botão acima para adicionar a primeira recomendação de produto com link e imagem.'}
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] z-10 border border-gray-100"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2.5">
                  <ShoppingBag size={20} className="text-[#865d39]" />
                  <h3 className="font-serif font-bold text-lg text-gray-900">
                    {editingInsumo ? 'Editar Insumo Recomendado' : 'Novo Insumo Recomendado'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-gray-200/60 text-gray-400 hover:text-gray-700 transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-black uppercase text-gray-600 mb-1">
                    Nome / Título do Insumo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Embalagem Kraft Biodegradável 500ml"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="w-full p-3 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-[#865d39]/40 focus:outline-none"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-black uppercase text-gray-600 mb-1">
                    Categoria
                  </label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full p-3 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-[#865d39]/40 focus:outline-none"
                  >
                    {categoriesList.filter(c => c !== 'Todos').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Image Upload Area */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black uppercase text-gray-600">
                      Imagem do Produto *
                    </label>
                    <span className="text-[11px] text-gray-400 font-medium">Aceita PNG, JPG, WebP (máx 3MB)</span>
                  </div>

                  {formData.image ? (
                    <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 p-2 flex flex-col sm:flex-row items-center gap-4">
                      <div className="h-32 w-32 rounded-xl overflow-hidden bg-white border border-gray-200 shadow-sm shrink-0 flex items-center justify-center">
                        <img
                          src={formData.image}
                          alt="Prévia do insumo"
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex flex-col gap-2 w-full pr-2">
                        <span className="text-xs font-bold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 self-start flex items-center gap-1.5">
                          <Check size={13} /> Imagem carregada com sucesso
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold cursor-pointer transition-all border border-gray-300 shadow-sm">
                            <Upload size={14} /> Trocar Imagem
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              className="hidden"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold cursor-pointer transition-all border border-red-200 shadow-sm"
                          >
                            <Trash2 size={14} /> Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 hover:border-[#865d39] rounded-2xl bg-gray-50/70 hover:bg-amber-50/40 cursor-pointer transition-all group">
                      <div className="p-3 rounded-full bg-white shadow-sm border border-gray-200 group-hover:scale-105 transition-transform text-[#865d39] mb-2">
                        <Upload size={22} />
                      </div>
                      <span className="text-xs font-extrabold text-gray-700 group-hover:text-[#865d39] transition-colors">
                        Clique aqui para enviar a foto do produto
                      </span>
                      <span className="text-[11px] text-gray-400 mt-0.5">
                        Arquivos em JPG, PNG ou WebP até 3MB
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Link do Produto */}
                <div>
                  <label className="block text-xs font-black uppercase text-gray-600 mb-1">
                    Link de Compra / Fornecedor *
                  </label>
                  <div className="relative">
                    <LinkIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="url"
                      required
                      placeholder="https://exemplo.com.br/produto..."
                      value={formData.link}
                      onChange={e => setFormData({ ...formData, link: e.target.value })}
                      className="w-full pl-10 pr-4 p-3 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-[#865d39]/40 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Description / Note */}
                <div>
                  <label className="block text-xs font-black uppercase text-gray-600 mb-1">
                    Descrição ou Dica de Uso
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Explique porque você recomenda esse produto para a dona do negócio..."
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full p-3 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-[#865d39]/40 focus:outline-none"
                  />
                </div>

                {/* Submit Actions */}
                <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-gray-600 hover:bg-gray-100 font-bold text-sm transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 rounded-xl font-bold text-sm text-white shadow-md transition-all cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: settings.primaryColor || '#865d39' }}
                  >
                    {isSaving ? 'Salvando...' : 'Salvar Insumo'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Alert Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl z-10 text-center space-y-4"
            >
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>
              <h3 className="font-bold text-lg text-gray-900">Excluir este insumo?</h3>
              <p className="text-xs text-gray-500">
                Esta ação removerá a recomendação do painel de insumos.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(deleteConfirmId)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 shadow-md"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
