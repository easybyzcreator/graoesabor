import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'motion/react';
import { Product, Category, Settings, CartItem } from '../types';
import { Plus, Minus, ArrowRight } from 'lucide-react';

interface AnimatedProductCardProps {
  product: Product;
  category: Category;
  settings: Settings;
  cart: CartItem[];
  currencySymbol: string;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product, quantity: number) => void;
  onRemoveFromCart: (cartItemId: string) => void;
  getContrastText: (hexColor?: string) => string;
  onOpenNutritional?: (product: Product) => void;
  onOpenCombo?: (product: Product) => void;
}

export const AnimatedProductCard: React.FC<AnimatedProductCardProps> = ({
  product,
  category,
  settings,
  cart,
  currencySymbol,
  onSelectProduct,
  onAddToCart,
  onRemoveFromCart,
  getContrastText,
  onOpenNutritional,
  onOpenCombo,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // Smooth scroll tracking relative to viewport for dynamic emergence
  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ['start end', 'end start'],
  });

  // Responsive spring physics for fluid movement on mobile and desktop
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 240,
    damping: 24,
    mass: 0.4,
  });

  const scrollYOffset = useTransform(smoothProgress, [0.1, 0.45, 0.75, 0.98], [8, -18, -14, 4]);
  const imageScale = useTransform(smoothProgress, [0.1, 0.45, 0.75, 0.98], [0.96, 1.07, 1.05, 0.97]);
  const imageRotate = useTransform(smoothProgress, [0.15, 0.5, 0.85], [-1.4, 0, 1.4]);
  const shadowIntensity = useTransform(
    smoothProgress,
    [0.1, 0.45, 0.75, 0.98],
    [
      '0 4px 10px rgba(0,0,0,0.05)',
      '0 22px 36px -4px rgba(0,0,0,0.22), 0 10px 18px -2px rgba(0,0,0,0.12)',
      '0 18px 28px -4px rgba(0,0,0,0.18), 0 8px 14px -2px rgba(0,0,0,0.10)',
      '0 4px 10px rgba(0,0,0,0.05)',
    ]
  );

  const shadowScale = useTransform(smoothProgress, [0.1, 0.45, 0.75, 0.98], [0.85, 1.18, 1.12, 0.88]);
  const shadowOpacity = useTransform(smoothProgress, [0.1, 0.45, 0.75, 0.98], [0.25, 0.65, 0.55, 0.28]);

  const totalQty = cart
    .filter((item) => item.productId === product.id)
    .reduce((sum, item) => sum + item.quantity, 0);

  const isCombo = product.isCombo === true || product.itemFormat === 'combo';
  const hasMultiplePrices = !!(product.sizes && product.sizes.length > 1);
  const hasSizes = !!(product.sizes && product.sizes.length > 0);
  const isOutOfStock = product.trackStock === true && (product.stockQuantity ?? 0) <= 0;
  const requiresCustomization = isCombo || hasMultiplePrices || !!product.isCustomCake;

  const hasNutritional = !!(
    product.nutritionalInfo &&
    Object.values(product.nutritionalInfo).some(
      (val) => typeof val === 'string' && val.trim().length > 0
    )
  );

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      className="bg-[#FAF7F2]/95 backdrop-blur-md rounded-[28px] p-3.5 sm:p-4 border border-[#EADBCC]/90 shadow-[0_4px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_45px_rgba(0,0,0,0.12)] transition-shadow duration-300 flex flex-col justify-between w-full group relative overflow-visible"
      style={{ perspective: 1200 }}
    >
      {/* Container de Apresentação (Pedestal / Moldura com efeito 3D Pop-Out Expandido) */}
      <div className="relative w-full aspect-[4/3] rounded-[22px] bg-gradient-to-b from-stone-200/40 via-stone-100/60 to-stone-200/30 p-1 mb-3 shadow-[inset_0_2px_6px_rgba(0,0,0,0.04)] ring-1 ring-black/5 flex items-center justify-center">
        {/* Sombra de projeção no pedestal (reage fisicamente à elevação da imagem) */}
        <motion.div
          style={{
            scale: shadowScale,
            opacity: shadowOpacity,
          }}
          className="absolute bottom-1 w-4/5 h-4 bg-black/30 blur-md rounded-full pointer-events-none transition-all duration-300 group-hover:scale-125 group-hover:opacity-75"
        />

        {/* Imagem que Emerge / Flutua com movimento contínuo e interativo */}
        <motion.div
          style={{
            y: scrollYOffset,
            scale: imageScale,
            rotateZ: imageRotate,
            boxShadow: shadowIntensity,
          }}
          whileHover={{
            scale: 1.10,
            y: -22,
            rotateZ: -1,
            transition: { type: 'spring', stiffness: 350, damping: 20 },
          }}
          className="relative w-full h-full rounded-[19px] overflow-hidden z-10 transition-transform duration-300 transform-gpu"
        >
          {/* Camada com micro-flutuação orgânica contínua (efeito vivo de gastronomia) */}
          <motion.div
            animate={{
              y: [0, -4, 0],
            }}
            transition={{
              duration: 3.8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="w-full h-full"
          >
            <img
              src={product.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80'}
              alt={product.title}
              className="w-full h-full object-cover select-none group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          </motion.div>

          {/* Brilho Gourmet / Sheen Reflex ao focar ou passar o mouse */}
          <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-tr from-transparent via-white/30 to-transparent" />

          {/* Borda interna de acabamento fino */}
          <div className="absolute inset-0 pointer-events-none rounded-[19px] ring-1 ring-inset ring-black/10" />
        </motion.div>

        {/* Badge de Pronta Entrega ou Combo - Sem ícone, apenas texto na tag amarela */}
        <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none">
          {isCombo ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-black tracking-wide bg-[#fef3c7] text-[#92400e] border border-amber-300 shadow-sm">
              Combo {product.comboLimit || 5}
            </span>
          ) : product.trackStock ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-[#065f46] text-white shadow-sm border border-emerald-600">
              PRONTA ENTREGA
            </span>
          ) : null}
        </div>
      </div>

      {/* Informações Textuais */}
      <div className="flex flex-col flex-grow px-0.5">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h3
            className="text-base sm:text-lg font-serif font-black leading-snug tracking-tight group-hover:translate-x-0.5 transition-transform"
            style={{ color: settings.textColor || settings.productTitleColor || '#1A202C' }}
          >
            {product.title}
          </h3>

          {/* Badge de Estoque (ex: 25 unidades ou ESGOTADO conforme Imagem 14) */}
          {product.trackStock && (
            isOutOfStock ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700 border border-red-200">
                ESGOTADO
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs">
                {product.stockQuantity} unidades
              </span>
            )
          )}
        </div>

        {product.description && (
          <p
            className="text-xs leading-relaxed line-clamp-2 mb-1.5"
            style={{ color: settings.textColor || settings.productDescColor || 'rgba(55, 65, 81, 0.9)' }}
          >
            {product.description}
          </p>
        )}

        {/* Link Ver Detalhes / Tabela Nutricional (conforme Imagens 12, 13 e 14) */}
        <div className="details-link-area mt-0.5 mb-2">
          {isCombo ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenCombo ? onOpenCombo(product) : onSelectProduct(product);
              }}
              className="text-xs font-bold uppercase tracking-wider underline hover:opacity-80 transition-opacity text-left cursor-pointer"
              style={{ color: settings.detailsColor || settings.priceColor || settings.primaryColor || '#865d39' }}
            >
              MONTAR COMBO ({product.comboLimit || 5})
            </button>
          ) : hasNutritional ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenNutritional ? onOpenNutritional(product) : onSelectProduct(product);
              }}
              className="text-xs font-bold underline hover:opacity-80 transition-opacity text-left cursor-pointer flex items-center gap-1"
              style={{ color: settings.detailsColor || settings.priceColor || settings.primaryColor || '#865d39' }}
            >
              <span>Ver Descrição e Tabela Nutricional</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectProduct(product);
              }}
              className="text-[11px] font-bold uppercase tracking-wider underline hover:opacity-80 transition-opacity text-left cursor-pointer"
              style={{ color: settings.detailsColor || settings.priceColor || settings.primaryColor || '#865d39' }}
            >
              VER DETALHES
            </button>
          )}
        </div>
      </div>

      {/* Rodapé com Preço e Botão de Ação */}
      <div className="pt-3 border-t border-black/5 flex items-center justify-between mt-auto px-0.5">
        <div>
          {hasSizes && product.sizes ? (
            <div>
              <span 
                className="text-[10px] font-semibold uppercase block tracking-wider leading-tight opacity-75"
                style={{ color: settings.textColor || '#6b7280' }}
              >
                A partir de
              </span>
              <p
                className="text-base sm:text-lg font-serif font-black text-gray-950"
                style={{ color: settings.priceColor || settings.primaryColor || '#1A202C' }}
              >
                {currencySymbol}
                {Math.min(...product.sizes.map((s) => s.price)).toFixed(2)}
              </p>
            </div>
          ) : product.isCustomCake || product.priceType === 'consult' ? (
            <span className="text-xs uppercase font-serif font-black tracking-wider px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-950 border border-amber-500/20">
              {settings.language === 'en' ? 'On Request' : 'A Consultar'}
            </span>
          ) : (
            <div>
              {Boolean(product.oldPrice && product.oldPrice > 0) && (
                <span className="text-xs line-through text-gray-400 block leading-none">
                  {currencySymbol}
                  {product.oldPrice!.toFixed(2)}
                </span>
              )}
              <p
                className="text-base sm:text-lg font-serif font-black text-gray-950"
                style={{ color: settings.priceColor || settings.primaryColor || '#1A202C' }}
              >
                {currencySymbol}
                {(product.price && product.price > 0 ? product.price : (product.oldPrice || 0)).toFixed(2)}
              </p>
            </div>
          )}
        </div>

        {/* Área do Botão do Carrinho */}
        <div className="cart-button-area">
          {isOutOfStock ? (
            <div className="px-3.5 py-2 rounded-full text-xs font-bold bg-stone-200 text-stone-500 border border-stone-300 select-none cursor-not-allowed">
              Esgotado
            </div>
          ) : isCombo ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={(e) => {
                e.stopPropagation();
                onOpenCombo ? onOpenCombo(product) : onSelectProduct(product);
              }}
              className="px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md hover:brightness-110 active:scale-95 transition-all text-white cursor-pointer"
              style={{
                backgroundColor: settings.primaryColor || '#5C3D2E',
                color: getContrastText(settings.primaryColor || '#5C3D2E'),
              }}
            >
              <Plus size={14} />
              <span>Montar Combo</span>
            </motion.button>
          ) : !requiresCustomization && totalQty > 0 ? (
            <div 
              className="h-9 px-2 rounded-full text-xs font-bold flex items-center justify-between gap-1 shadow-md transition-all text-white select-none"
              style={{
                backgroundColor: settings.primaryColor || '#5C3D2E',
                color: getContrastText(settings.primaryColor || '#5C3D2E'),
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const item = cart.find((i) => i.productId === product.id);
                  if (item) onRemoveFromCart(item.id);
                }}
                className="w-6 h-6 rounded-full bg-white/25 hover:bg-white/40 flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer"
                aria-label="Diminuir quantidade"
              >
                <Minus size={13} />
              </button>
              <span className="text-xs font-black min-w-[20px] text-center px-1 text-white">
                {totalQty}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToCart(product, 1);
                }}
                className="w-6 h-6 rounded-full bg-white/25 hover:bg-white/40 flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer"
                aria-label="Aumentar quantidade"
              >
                <Plus size={13} />
              </button>
            </div>
          ) : (
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={(e) => {
                e.stopPropagation();
                if (!requiresCustomization) {
                  onAddToCart(product, 1);
                } else {
                  onSelectProduct(product);
                }
              }}
              className="h-9 px-4 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md hover:brightness-110 active:scale-95 transition-all text-white cursor-pointer"
              style={{
                backgroundColor: settings.primaryColor || '#5C3D2E',
                color: getContrastText(settings.primaryColor || '#5C3D2E'),
              }}
            >
              <span>Quero esse</span>
              <Plus size={14} />
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
