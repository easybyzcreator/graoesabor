export interface CountryInfo {
  code: string; // '+55'
  country: string; // 'BR'
  name: string;
  flag: string;
  placeholder: string;
  defaultCurrency: 'BRL';
  minDigits: number;
  maxDigits: number;
}

export const COUNTRY_OPTIONS: Record<string, CountryInfo> = {
  '+55': {
    code: '+55',
    country: 'BR',
    name: 'Brasil',
    flag: '',
    placeholder: '(11) 99999-9999',
    defaultCurrency: 'BRL',
    minDigits: 10,
    maxDigits: 11
  }
};

export const CURRENCY_OPTIONS = [
  { code: 'BRL', symbol: 'R$', name: 'Real Brasileiro (R$)', flag: '', preview: 'R$ 45,00' }
];

export const getCurrencySymbol = (_currency?: string): string => {
  return 'R$';
};

export const formatPhoneByCountry = (value: string, _countryCode: string = '+55'): string => {
  let val = (value || '').replace(/\D/g, '');
  if (!val) return '';

  // Brasil: (99) 99999-9999 / (99) 9999-9999
  if (val.length > 11) val = val.slice(0, 11);
  if (val.length <= 2) return `(${val}`;
  if (val.length <= 6) return `(${val.slice(0, 2)}) ${val.slice(2)}`;
  if (val.length <= 10) return `(${val.slice(0, 2)}) ${val.slice(2, 6)}-${val.slice(6)}`;
  return `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`;
};

export const getCleanWhatsAppPhone = (phone: string, _countryCode: string = '+55'): string => {
  let clean = (phone || '').replace(/\D/g, '');
  if (!clean) return '';

  // Always use 55 (Brasil)
  if (!clean.startsWith('55')) {
    clean = '55' + clean;
  }
  return clean;
};
