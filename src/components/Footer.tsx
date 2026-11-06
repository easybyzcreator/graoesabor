import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings } from '../types';
import { X, Sparkles } from 'lucide-react';

interface FooterProps {
  settings?: Settings;
  onOpenAdmin?: () => void;
  hideActionButtons?: boolean;
  activeCatalog?: string | null;
}

export default function Footer({ settings, hideActionButtons = false, activeCatalog = 'catalog1' }: FooterProps) {
  const primaryColor = settings?.primaryColor || '#865d39';
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Determinar configurações da tag conforme o cardápio ativo
  const catalogKey = activeCatalog || 'catalog1';
  let tagTitle = 'Eventos';
  let tagImage: string | undefined = undefined;
  let tagActive = true;

  if (catalogKey === 'catalog1') {
    tagTitle = settings?.catalog1TagTitle?.trim() || 'Eventos';
    tagImage = settings?.catalog1TagImage;
    tagActive = settings?.catalog1TagActive !== false;
  } else if (catalogKey === 'catalog2') {
    tagTitle = settings?.catalog2TagTitle?.trim() || 'Eventos';
    tagImage = settings?.catalog2TagImage;
    tagActive = settings?.catalog2TagActive !== false;
  } else if (catalogKey === 'catalog3') {
    tagTitle = settings?.catalog3TagTitle?.trim() || 'Eventos';
    tagImage = settings?.catalog3TagImage;
    tagActive = settings?.catalog3TagActive !== false;
  } else if (catalogKey === 'catalog4') {
    tagTitle = settings?.catalog4TagTitle?.trim() || 'Eventos';
    tagImage = settings?.catalog4TagImage;
    tagActive = settings?.catalog4TagActive !== false;
  } else if (catalogKey === 'catalog5') {
    tagTitle = settings?.catalog5TagTitle?.trim() || 'Eventos';
    tagImage = settings?.catalog5TagImage;
    tagActive = settings?.catalog5TagActive !== false;
  } else if (catalogKey === 'catalog6') {
    tagTitle = settings?.catalog6TagTitle?.trim() || 'Eventos';
    tagImage = settings?.catalog6TagImage;
    tagActive = settings?.catalog6TagActive !== false;
  }

  return (
    <footer className="w-full py-8 flex flex-col items-center justify-center gap-4 mt-auto px-4">
      {/* Botão de Destaque Único por Cardápio (Imagem 1) */}
      {!hideActionButtons && tagActive && (
        <div className="flex flex-col items-center justify-center mb-8 w-full max-w-xs animate-in fade-in">
          <div className="relative flex flex-col items-center justify-center w-full max-w-[260px]">
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setIsModalOpen(true)}
              className="w-full py-3.5 px-6 rounded-full font-bold text-xs uppercase tracking-widest text-white shadow-md hover:shadow-lg transition-all text-center cursor-pointer border border-white/20 flex items-center justify-center hover:brightness-110 active:scale-95"
              style={{ backgroundColor: primaryColor }}
            >
              {tagTitle}
            </motion.button>
          </div>
        </div>
      )}

      {/* Modal / Pop-up da Imagem 1080 x 1350 */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            />

            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm sm:max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-white/20 z-10"
            >
              {/* Header do Modal com título e botão fechar */}
              <div className="p-4 sm:p-5 bg-white border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />
                  <h3 className="font-serif font-black text-base sm:text-lg text-gray-900 uppercase tracking-wider">
                    {tagTitle}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center cursor-pointer transition-colors"
                  title="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Conteúdo da Imagem (Proporção 1080 x 1350) */}
              <div className="p-3 sm:p-4 overflow-y-auto flex items-center justify-center bg-gray-50/50">
                {tagImage ? (
                  <div className="w-full relative rounded-2xl overflow-hidden shadow-md aspect-[1080/1350] bg-black/5">
                    <img 
                      src={tagImage} 
                      alt={tagTitle} 
                      className="w-full h-full object-cover select-none"
                    />
                  </div>
                ) : (
                  <div className="py-16 px-6 text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-900 mx-auto flex items-center justify-center">
                      <Sparkles size={24} />
                    </div>
                    <h4 className="font-serif font-bold text-gray-900 text-lg">
                      {tagTitle}
                    </h4>
                    <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                      Em breve novas novidades e informações exclusivas sobre <strong>{tagTitle}</strong>!
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      <a 
        href="https://easybyzcreator.com" 
        target="_blank" 
        rel="noopener noreferrer"
        className="group mt-1 flex flex-col items-center cursor-pointer"
        title="Easy Byz Creator"
      >
        <p 
          className="text-[10px] tracking-[0.2em] font-sans font-bold text-[#482E1D] uppercase group-hover:opacity-80 transition-opacity"
          style={{ color: '#482E1D' }}
        >
          DESENVOLVIDO POR
        </p>
        <motion.img 
          src="https://i.ibb.co/Kj1CTDrD/patitour-2026-04-11-T125246-010.png" 
          alt="EasyByz Logo" 
          className="h-[158px] object-contain"
          initial={{ 
            filter: 'brightness(0) saturate(100%) invert(17%) sepia(17%) saturate(1519%) hue-rotate(341deg) brightness(97%) contrast(91%)',
            scale: 0.95
          }}
          whileHover={{ 
            filter: 'brightness(0) saturate(100%) invert(17%) sepia(17%) saturate(1519%) hue-rotate(341deg) brightness(97%) contrast(91%)',
            scale: 1.05
          }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          referrerPolicy="no-referrer"
        />
      </a>
    </footer>
  );
}
