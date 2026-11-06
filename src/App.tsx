import React, { useState, useEffect, Component, ErrorInfo, ReactNode, lazy, Suspense } from 'react';
import Menu from './components/Menu';
import Footer from './components/Footer';

const Admin = lazy(() => import('./components/Admin'));
import { db } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Settings } from './types';
import { Toaster } from 'sonner';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#ece6db] text-gray-900">
          <div className="bg-white/95 backdrop-blur-md p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-4 border border-black/10">
            <h2 className="text-2xl font-serif font-bold text-red-600">Ops! Ocorreu um erro</h2>
            <p className="text-sm text-gray-600">
              {this.state.error?.message || 'Houve uma falha ao carregar esta tela no seu dispositivo.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              className="w-full py-3 px-6 bg-[#865d39] text-white font-bold rounded-xl shadow-md hover:opacity-90 transition-all cursor-pointer"
            >
              Voltar ao Início
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeScreen, setActiveScreen] = useState<'intro' | 'selector' | 'menu'>('intro');
  const [activeCatalog, setActiveCatalog] = useState<string | null>('catalog1');
  const [settings, setSettings] = useState<Settings>({
    logo: 'https://raw.githubusercontent.com/easybyzcreator/imagens/fec01da426f25ac9e87c5339fd4d4820c7e334f4/logo%20grao%20e%20sabor.jpg',
    primaryColor: '#865d39',
    whatsappNumber: '',
    whatsappCountryCode: '+55',
    slug: 'grao-e-sabor',
    brandName: 'Grão & Sabor',
    slogan: 'Cardápio exclusivo e produtos especiais.',
    whatsappClosingMessage: 'Obrigada pelo interesse em nossos produtos, aguarde que entraremos em contato para confirmação!',
    backgroundImage: 'https://i.ibb.co/X0vYy7L/cakes.png',
    glassColor: 'rgba(250, 247, 242, 0.92)',
    textColor: '#000000',
    language: 'pt',
    currency: 'BRL',
    introEnabled: true,
    introTitle: 'Grão & Sabor',
    introSubtitle: 'Cardápio Especial',
    introDescription: 'Acesse nossos produtos artesanais, novidades e faça seu pedido com praticidade.',
    introButtonText: 'ACESSAR NOSSO CARDÁPIO',
    introBottomText: 'Grão & Sabor',
    selectorEnabled: true,
    selectorTitle: 'Grão & Sabor',
    selectorSubtitle: 'Escolha seu cardápio',
    catalog1Title: 'Cardápio Principal',
    catalog1Image: 'https://raw.githubusercontent.com/easybyzcreator/imagens/fec01da426f25ac9e87c5339fd4d4820c7e334f4/logo%20grao%20e%20sabor.jpg',
    catalog1Desc: 'Nossos produtos e opções exclusivas.',
    catalog1Slogan: 'Qualidade e sabor incomparáveis\nComida caseira com tempero de verdade\nFaça seu pedido com praticidade',
    catalog1Active: true,
    catalog2Title: 'Doces & Sobremesas',
    catalog2Image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&auto=format&fit=crop&q=80',
    catalog2Desc: 'Bolos, tortas e sobremesas deliciosas.',
    catalog2Slogan: 'Ingredientes selecionados\nDoces artesanais frescos todos os dias',
    catalog2Active: true,
    catalog3Title: 'Cafés & Bebidas',
    catalog3Image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop&q=80',
    catalog3Desc: 'Cafés especiais, sucos naturais e bebidas refrescantes.',
    catalog3Slogan: 'Grãos nobres moídos na hora\nSucos naturais da fruta sem conservantes',
    catalog3Active: true,
    catalog4Title: 'Lanches & Salgados',
    catalog4Image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&auto=format&fit=crop&q=80',
    catalog4Desc: 'Salgados assados, empadas e sanduíches artesanais.',
    catalog4Slogan: 'Massas artesanais crocantes\nRecheios fartos e tempero especial',
    catalog4Active: true,
    catalog5Title: 'Linha Fit & Saudável',
    catalog5Image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80',
    catalog5Desc: 'Pratos leves, low carb e opções funcionais.',
    catalog5Slogan: '100% saudável e equilibrado\nMais foco na sua saúde e energia',
    catalog5Active: true,
    catalog6Title: 'Encomendas & Eventos',
    catalog6Image: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=600&auto=format&fit=crop&q=80',
    catalog6Desc: 'Kits especiais para confraternizações, festas e reuniões.',
    catalog6Slogan: 'Kits corporativos e festas\nConsulte prazos e encomendas especiais',
    catalog6Active: true
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check URL for admin path
    const checkAdmin = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const search = window.location.search;
      if (
        path === '/admin' || 
        path.endsWith('/admin') || 
        hash === '#/admin' || 
        hash === '#admin' || 
        hash.includes('admin') ||
        search.includes('admin=true')
      ) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    };

    checkAdmin();
    window.addEventListener('popstate', checkAdmin);
    window.addEventListener('hashchange', checkAdmin);

    // Load settings for global styles
    const unsub = onSnapshot(doc(db, 'configuracoes', 'geral'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Settings;
        // Set default country code if missing
        if (!data.whatsappCountryCode) {
          data.whatsappCountryCode = '+55';
        }
        data.currency = 'BRL';
        if (data.selectorEnabled === undefined) {
          data.selectorEnabled = true;
        }
        setSettings(prev => ({ ...prev, ...data, currency: 'BRL', selectorEnabled: data.selectorEnabled !== false }));
        setLoading(false);

        // Update Page Title
        if (data.brandName) {
          document.title = data.brandName;
        }

        // Update Theme Color
        const themeColorMeta = document.getElementById('theme-color');
        if (themeColorMeta) {
          themeColorMeta.setAttribute('content', data.primaryColor || '#865d39');
        }

        // Set Glass Color CSS Variable
        const glassColor = data.glassColor || 'rgba(250, 247, 242, 0.92)';
        const finalGlassColor = (glassColor.startsWith('#') && glassColor.length === 7) 
          ? `${glassColor}E6` 
          : glassColor;
        document.documentElement.style.setProperty('--glass-color', finalGlassColor);

        // Set Text Color CSS Variable
        if (data.textColor) {
          document.documentElement.style.setProperty('--text-color', data.textColor);
        }
      } else {
        setLoading(false);
      }
    }, (error) => {
      console.error('App: Erro ao carregar configurações:', error);
      setLoading(false);
    });

    const unsubTags = onSnapshot(doc(db, 'configuracoes', 'catalogTags'), (tagSnap) => {
      if (tagSnap.exists()) {
        const tagData = tagSnap.data();
        setSettings(prev => ({ ...prev, ...tagData }));
      }
    });

    return () => {
      window.removeEventListener('popstate', checkAdmin);
      window.removeEventListener('hashchange', checkAdmin);
      unsub();
      unsubTags();
    };
  }, []);

  // Sync theme variables whenever settings change
  useEffect(() => {
    if (settings) {
      if (settings.brandName) {
        document.title = settings.brandName;
      }
      const glassColor = settings.glassColor || 'rgba(250, 247, 242, 0.92)';
      const finalGlassColor = (glassColor.startsWith('#') && glassColor.length === 7) 
        ? `${glassColor}E6` 
        : glassColor;
      document.documentElement.style.setProperty('--glass-color', finalGlassColor);

      if (settings.textColor) {
        document.documentElement.style.setProperty('--text-color', settings.textColor);
      }
      if (settings.primaryColor) {
        document.documentElement.style.setProperty('--primary-color', settings.primaryColor);
        const themeColorMeta = document.getElementById('theme-color');
        if (themeColorMeta) {
          themeColorMeta.setAttribute('content', settings.primaryColor);
        }
      }
      if (settings.priceColor) {
        document.documentElement.style.setProperty('--price-color', settings.priceColor);
      }
    }
  }, [settings?.brandName, settings?.glassColor, settings?.textColor, settings?.primaryColor, settings?.priceColor]);

  const glassColor = settings?.glassColor || 'rgba(250, 248, 245, 0.82)';
  const finalGlassColor = (glassColor.startsWith('#') && glassColor.length === 7) 
    ? `${glassColor}d9` 
    : (glassColor === 'rgba(255, 255, 255, 0.4)' || !settings?.glassColor)
      ? 'rgba(250, 248, 245, 0.82)'
      : glassColor;

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#ece6db]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#865d39] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#865d39] font-medium animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="relative min-h-screen w-full overflow-x-hidden">
        <Toaster position="top-center" richColors />
        {/* Background Image */}
        <div 
          className="fixed inset-0 z-[-2] bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url("${settings?.backgroundImage || 'https://i.ibb.co/X0vYy7L/cakes.png'}")` }}
        />
        
        {/* Glass Overlay */}
        <div 
          className="fixed inset-0 z-[-1] pointer-events-none transition-colors duration-500" 
          style={{ 
            backgroundColor: finalGlassColor,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)'
          }}
        />

        {/* Content */}
        <div className="relative z-0 flex flex-col min-h-screen">
          {isAdmin ? (
            <Suspense fallback={
              <div className="min-h-screen w-full flex items-center justify-center bg-[#ece6db]">
                <div className="w-10 h-10 border-4 border-[#865d39] border-t-transparent rounded-full animate-spin" />
              </div>
            }>
              <Admin settings={settings} setSettings={setSettings} setIsAdmin={setIsAdmin} />
            </Suspense>
          ) : (
            <>
              <Menu 
                settings={{ ...settings, language: settings.language || 'pt', currency: settings.currency || 'BRL' }} 
                onScreenChange={setActiveScreen}
                onCatalogChange={setActiveCatalog}
              />
              <Footer 
                settings={settings} 
                hideActionButtons={activeScreen !== 'menu'}
                activeCatalog={activeCatalog}
              />
            </>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
