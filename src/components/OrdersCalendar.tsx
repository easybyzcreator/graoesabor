import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  MapPin, 
  Phone, 
  Mail, 
  Cake, 
  Printer, 
  Search, 
  X, 
  ExternalLink,
  Store,
  Truck,
  CheckCircle2,
  AlertCircle,
  Edit2,
  MessageCircle,
  Save,
  Calendar,
  User,
  Check
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Order, Product, Settings } from '../types';
import { getCleanWhatsAppPhone, getCurrencySymbol } from '../utils/countryUtils';
import { sendOrderToWhatsApp, getContrastText, DEFAULT_QUICK_INSTRUCTIONS, formatInstructionWhatsAppMessage } from '../utils/orderUtils';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface OrdersCalendarProps {
  orders: Order[];
  settings: Settings;
  products?: Product[];
  onSelectOrderInList?: (orderId: string) => void;
  onPrintOrder?: (order: Order) => void;
  onEditOrder?: (order: Order) => void;
}

type CalendarViewMode = 'grid' | 'agenda' | 'month';

// Helper to parse dates from various formats (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, Timestamp)
export function parseOrderDateTime(order: Order): { date: Date | null; timeStr: string; isPickup: boolean } {
  let targetDate: Date | null = null;
  let timeStr = '12:00 PM';
  const isPickup = !order.address || order.address.toLowerCase().includes('retirada') || order.address.toLowerCase().includes('pickup');

  // Try pickupDate first
  if (order.pickupDate && typeof order.pickupDate === 'string' && order.pickupDate.trim()) {
    const raw = order.pickupDate.trim();
    
    // Check if time is in pickupDate
    const timeMatch = raw.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/i);
    if (timeMatch) {
      timeStr = timeMatch[1].toUpperCase();
    }

    // Date extraction
    const dateMatchSlash = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    const dateMatchDash = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);

    if (dateMatchSlash) {
      const part1 = parseInt(dateMatchSlash[1], 10);
      const part2 = parseInt(dateMatchSlash[2], 10);
      const year = parseInt(dateMatchSlash[3], 10);

      // Distinguish MM/DD/YYYY vs DD/MM/YYYY - now default to DD/MM/YYYY as requested
      if (part1 > 12) {
        // DD/MM/YYYY
        targetDate = new Date(year, part2 - 1, part1);
      } else if (part2 > 12) {
        // MM/DD/YYYY
        targetDate = new Date(year, part1 - 1, part2);
      } else {
        // Default to DD/MM/YYYY
        targetDate = new Date(year, part2 - 1, part1);
      }
    } else if (dateMatchDash) {
      const year = parseInt(dateMatchDash[1], 10);
      const month = parseInt(dateMatchDash[2], 10);
      const day = parseInt(dateMatchDash[3], 10);
      targetDate = new Date(year, month - 1, day);
    }
  }

  // Fallback to createdAt
  if (!targetDate) {
    if (order.createdAt?.toDate) {
      targetDate = order.createdAt.toDate();
    } else if (order.createdAt?.seconds) {
      targetDate = new Date(order.createdAt.seconds * 1000);
    } else if (order.createdAt instanceof Date) {
      targetDate = order.createdAt;
    } else if (typeof order.createdAt === 'string') {
      const parsed = new Date(order.createdAt);
      if (!isNaN(parsed.getTime())) {
        targetDate = parsed;
      }
    }
  }

  // If timeStr is still default and targetDate has time
  if (targetDate && timeStr === '12:00 PM') {
    const d = order.createdAt?.toDate 
      ? order.createdAt.toDate() 
      : (order.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000) : targetDate);
    if (d && typeof d.getHours === 'function') {
      let hours = d.getHours();
      const minutes = d.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }
  }

  return { date: targetDate, timeStr, isPickup };
}

// Convert time string "12:00 PM" into hour number (0 to 23)
function getHourFromTimeString(timeStr: string): number {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return 12;
  let hour = parseInt(match[1], 10);
  const ampm = match[3] ? match[3].toUpperCase() : '';
  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return hour;
}

export const OrdersCalendar: React.FC<OrdersCalendarProps> = ({
  orders,
  settings,
  products,
  onSelectOrderInList,
  onPrintOrder,
  onEditOrder
}) => {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('grid');
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Direct date editing state
  const [isEditingPickupDate, setIsEditingPickupDate] = useState(false);
  const [editingPickupDateValue, setEditingPickupDateValue] = useState('');
  const [isSavingPickupDate, setIsSavingPickupDate] = useState(false);
  const datePickerInputRef = useRef<HTMLInputElement>(null);

  // Optimistic order overrides for immediate calendar card update
  const [orderOverrides, setOrderOverrides] = useState<Record<string, Partial<Order>>>({});

  // Helper format currency
  const currencySymbol = getCurrencySymbol(settings?.currency);
  const formatCurrency = (val: number) => {
    if (settings?.currency === 'USD') {
      return `${Number(val || 0).toFixed(2)}`;
    }
    return `${currencySymbol} ${Number(val || 0).toFixed(2).replace('.', ',')}`;
  };

  // Week range calculations (Sunday to Saturday)
  const weekDays = useMemo(() => {
    const curr = new Date(currentDate);
    const dayOfWeek = curr.getDay(); // 0 is Sunday
    const startOfWeek = new Date(curr);
    startOfWeek.setDate(curr.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  // Month range calculations
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startDayOfWeek = firstDayOfMonth.getDay();
    const days: (Date | null)[] = [];

    // Preceding empty/previous month days
    for (let i = 0; i < startDayOfWeek; i++) {
      const prevDate = new Date(year, month, 1 - (startDayOfWeek - i));
      days.push(prevDate);
    }

    // Days in current month
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    // Trailing days to fill 7-col grid (up to 35 or 42)
    while (days.length % 7 !== 0) {
      const nextDay = new Date(year, month + 1, days.length - (startDayOfWeek + lastDayOfMonth.getDate()) + 1);
      days.push(nextDay);
    }

    return days;
  }, [currentDate]);

  // Navigate functions
  const handlePrev = () => {
    const newD = new Date(currentDate);
    if (viewMode === 'month') {
      newD.setMonth(newD.getMonth() - 1);
    } else {
      newD.setDate(newD.getDate() - 7);
    }
    setCurrentDate(newD);
  };

  const handleNext = () => {
    const newD = new Date(currentDate);
    if (viewMode === 'month') {
      newD.setMonth(newD.getMonth() + 1);
    } else {
      newD.setDate(newD.getDate() + 7);
    }
    setCurrentDate(newD);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Map orders with parsed dates (incorporating optimistic overrides)
  const parsedOrders = useMemo(() => {
    return orders.map(order => {
      const mergedOrder = { ...order, ...(orderOverrides[order.id] || {}) };
      const parsed = parseOrderDateTime(mergedOrder);
      return {
        order: mergedOrder,
        ...parsed
      };
    });
  }, [orders, orderOverrides]);

  // Orders filtered by the current period
  const periodOrders = useMemo(() => {
    if (viewMode === 'month') {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      return parsedOrders.filter(p => {
        if (!p.date) return false;
        return p.date.getFullYear() === year && p.date.getMonth() === month;
      });
    } else {
      const start = new Date(weekDays[0]);
      start.setHours(0, 0, 0, 0);
      const end = new Date(weekDays[6]);
      end.setHours(23, 59, 59, 999);

      return parsedOrders.filter(p => {
        if (!p.date) return false;
        return p.date >= start && p.date <= end;
      });
    }
  }, [parsedOrders, viewMode, weekDays, currentDate]);

  // Format header period text (e.g. "Semana de 9 a 15 de Agosto de 2026")
  const periodTitle = useMemo(() => {
    const monthNamesPt = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    if (viewMode === 'month') {
      return `${monthNamesPt[currentDate.getMonth()]} de ${currentDate.getFullYear()}`;
    }
    const start = weekDays[0];
    const end = weekDays[6];
    const startDay = start.getDate();
    const endDay = end.getDate();
    const monthName = monthNamesPt[end.getMonth()];
    const year = end.getFullYear();

    if (start.getMonth() === end.getMonth()) {
      return `Semana de ${startDay} a ${endDay} de ${monthName} de ${year}`;
    } else {
      const startMonthName = monthNamesPt[start.getMonth()];
      return `Semana de ${startDay} de ${startMonthName} a ${endDay} de ${monthName} de ${year}`;
    }
  }, [viewMode, weekDays, currentDate]);

  // Hours for the grid (07:00 AM to 09:00 PM)
  const hoursList = useMemo(() => {
    const hours = [];
    for (let h = 7; h <= 21; h++) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      hours.push({
        hour24: h,
        label: `${displayH.toString().padStart(2, '0')}:00 ${ampm}`
      });
    }
    return hours;
  }, []);

  // Today check helper
  const isToday = (d: Date | null) => {
    if (!d) return false;
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const dayNames = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

  return (
    <div className="w-full space-y-6">
      {/* Calendar Card Container */}
      <div className="w-full bg-white border border-gray-200 rounded-3xl shadow-xl p-4 sm:p-7 space-y-6">
        
        {/* Top Header Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-100/70 text-amber-900 shadow-sm border border-amber-200/50">
                <CalendarIcon size={22} className="text-[#865d39]" />
              </div>
              <h2 className="text-xl sm:text-2xl font-serif font-black tracking-tight text-gray-900">
                Cronograma de Entregas & Retiradas
              </h2>
            </div>
            <p className="text-[11px] font-extrabold tracking-[0.2em] text-gray-500 uppercase ml-1">
              VISUALIZAÇÃO DINÂMICA DOS PEDIDOS AGENDADOS
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* View Mode Switcher */}
            <div className="flex items-center p-1 bg-gray-100/80 rounded-2xl border border-gray-200/80 shadow-inner">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-gray-900 shadow-md font-extrabold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Grade Semanal
              </button>
              <button
                type="button"
                onClick={() => setViewMode('agenda')}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  viewMode === 'agenda'
                    ? 'bg-white text-gray-900 shadow-md font-extrabold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Agenda Semanal
              </button>
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  viewMode === 'month'
                    ? 'bg-white text-gray-900 shadow-md font-extrabold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Mensal
              </button>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center gap-1 bg-white border border-gray-200/80 rounded-2xl p-1 shadow-sm">
              <button
                type="button"
                onClick={handlePrev}
                className="p-1.5 rounded-xl hover:bg-gray-100 active:scale-95 transition-all text-gray-700 cursor-pointer"
                aria-label="Anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={handleToday}
                className="px-3 py-1 rounded-xl text-xs font-black text-gray-800 hover:bg-gray-100 active:scale-95 transition-all cursor-pointer"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="p-1.5 rounded-xl hover:bg-gray-100 active:scale-95 transition-all text-gray-700 cursor-pointer"
                aria-label="Próximo"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Sub-header: Period Title & Order Counter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-gray-200/50">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 font-sans">
            {periodTitle}
          </h3>
          <span className="self-start sm:self-auto px-3.5 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-gray-200/70 text-gray-700 border border-gray-300/60 shadow-sm">
            {periodOrders.length} {periodOrders.length === 1 ? 'PEDIDO NO PERÍODO' : 'PEDIDOS NO PERÍODO'}
          </span>
        </div>

        {/* --- VIEW 1: GRADE SEMANAL (IMAGE 1 STYLE) --- */}
        {viewMode === 'grid' && (
          <div className="border border-gray-200/80 rounded-2xl overflow-hidden bg-white shadow-sm">
            <div className="overflow-x-auto">
              <div className="min-w-[840px] max-h-[580px] overflow-y-auto">
                <table className="w-full table-fixed border-collapse">
                  <thead className="sticky top-0 z-10 bg-gray-50 shadow-xs">
                    <tr className="border-b border-gray-200">
                      <th className="w-[85px] p-3 border-r border-gray-200 text-center font-bold text-xs text-gray-400 bg-gray-50">
                        <div className="flex items-center justify-center">
                          <Clock size={16} />
                        </div>
                      </th>
                      {weekDays.map((d, i) => {
                        const todayActive = isToday(d);
                        const dayFormatted = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
                        return (
                          <th
                            key={i}
                            className={`p-3 border-r border-gray-200 last:border-r-0 text-center font-bold text-xs ${
                              todayActive ? 'bg-amber-100/60 font-black' : 'bg-gray-50 text-gray-700'
                            }`}
                          >
                            <div className="flex flex-col items-center justify-center gap-1">
                              <span className={`text-[11px] font-bold ${todayActive ? 'text-amber-900' : 'text-gray-500'}`}>
                                {dayNames[i]}
                              </span>
                              {todayActive ? (
                                <span 
                                  className="px-2 py-0.5 rounded-md text-white font-black text-xs shadow-sm"
                                  style={{ backgroundColor: settings?.primaryColor || '#865d39' }}
                                >
                                  {dayFormatted}
                                </span>
                              ) : (
                                <span className="text-xs font-bold text-gray-800">
                                  {dayFormatted}
                                </span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {hoursList.map(hObj => (
                      <tr key={hObj.hour24} className="min-h-[58px]">
                        {/* Hour Label */}
                        <td className="w-[85px] p-2 border-r border-gray-200 bg-gray-50/70 text-[11px] font-bold text-gray-500 text-center select-none align-middle">
                          {hObj.label}
                        </td>

                        {/* 7 Days Columns for this hour */}
                        {weekDays.map((d, dayIdx) => {
                          // Find orders that fall on this day & hour
                          const cellOrders = periodOrders.filter(p => {
                            if (!p.date) return false;
                            const matchesDay = (
                              p.date.getDate() === d.getDate() &&
                              p.date.getMonth() === d.getMonth() &&
                              p.date.getFullYear() === d.getFullYear()
                            );
                            if (!matchesDay) return false;
                            const hour = getHourFromTimeString(p.timeStr);
                            return hour === hObj.hour24;
                          });

                          return (
                            <td
                              key={dayIdx}
                              className={`p-1.5 border-r border-gray-200 last:border-r-0 align-top transition-colors ${
                                isToday(d) ? 'bg-amber-50/30' : 'hover:bg-gray-50/60'
                              }`}
                            >
                              <div className="space-y-1.5 min-h-[46px]">
                                {cellOrders.map(({ order, timeStr, isPickup }) => {
                                  const isPaidFull = order.paymentStatus === 'full';
                                  const isPaidHalf = order.paymentStatus === 'half';
                                  const isDelivered = order.deliveryStatus === 'delivered';
                                  // O card todo só fica verde se já tiver sido entregue e pago
                                  const isCardGreen = isDelivered && isPaidFull;

                                  return (
                                    <motion.button
                                      key={order.id}
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={() => setSelectedOrder(order)}
                                      className={`w-full text-left p-2 rounded-xl border shadow-xs transition-all cursor-pointer flex flex-col gap-1 ${
                                        isCardGreen
                                          ? 'bg-emerald-50/95 border-emerald-400 text-emerald-950 hover:bg-emerald-100 ring-1 ring-emerald-200'
                                          : 'bg-amber-50/95 border-amber-300 text-amber-950 hover:bg-amber-100/90 ring-1 ring-amber-200'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <span className={`font-extrabold text-[11px] truncate uppercase ${
                                          isCardGreen ? 'text-emerald-950' : 'text-amber-950'
                                        }`}>
                                          {order.isB2B || order.isPJ ? (order.b2bCompanyName || order.customerName) : order.customerName}
                                        </span>
                                        <span className={`font-black text-[11px] shrink-0 ${
                                          isCardGreen ? 'text-emerald-900' : 'text-amber-900'
                                        }`}>
                                          {formatCurrency(order.total)}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 text-[10px] font-semibold text-gray-600">
                                        <span>{isPickup ? 'Retirada' : 'Entrega'}</span>
                                        {isDelivered && (
                                          <span className="text-emerald-700 font-extrabold text-[10px]" title="Entregue">✓ Entregue</span>
                                        )}
                                        {isPaidFull ? (
                                          <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-600 text-white shadow-2xs leading-none">
                                            ✓ PAGO
                                          </span>
                                        ) : isPaidHalf ? (
                                          <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-white shadow-2xs leading-none">
                                            50%
                                          </span>
                                        ) : (
                                          <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 leading-none">
                                            NÃO PAGO
                                          </span>
                                        )}
                                      </div>
                                    </motion.button>
                                  );
                                })}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW 2: AGENDA SEMANAL (DETAILED LIST PER DAY) --- */}
        {viewMode === 'agenda' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {weekDays.map((d, i) => {
              const dayOrders = periodOrders.filter(p => {
                if (!p.date) return false;
                return (
                  p.date.getDate() === d.getDate() &&
                  p.date.getMonth() === d.getMonth() &&
                  p.date.getFullYear() === d.getFullYear()
                );
              });
              const todayActive = isToday(d);
              const dayFormatted = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;

              return (
                <div
                  key={i}
                  className={`rounded-2xl border p-4 space-y-3 flex flex-col ${
                    todayActive
                      ? 'bg-amber-50/60 border-amber-400 ring-2 ring-amber-200'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black ${todayActive ? 'text-amber-900' : 'text-gray-500'}`}>
                        {dayNames[i]}
                      </span>
                      <span 
                        className={`text-xs font-black ${todayActive ? 'px-2 py-0.5 text-white rounded-md' : 'text-gray-800'}`}
                        style={todayActive ? { backgroundColor: settings?.primaryColor || '#865d39' } : {}}
                      >
                        {dayFormatted}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-gray-400">
                      {dayOrders.length} {dayOrders.length === 1 ? 'pedido' : 'pedidos'}
                    </span>
                  </div>

                  <div className="space-y-2 flex-grow overflow-y-auto max-h-[300px]">
                    {dayOrders.length > 0 ? (
                      dayOrders.map(({ order, timeStr, isPickup }) => {
                        const isPaidFull = order.paymentStatus === 'full';
                        const isPaidHalf = order.paymentStatus === 'half';
                        const isDelivered = order.deliveryStatus === 'delivered';
                        const isCardGreen = isDelivered && isPaidFull;

                        return (
                          <div
                            key={order.id}
                            onClick={() => setSelectedOrder(order)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 shadow-2xs ${
                              isCardGreen
                                ? 'bg-emerald-50/80 border-emerald-300 hover:bg-emerald-100/80'
                                : 'bg-amber-50/80 border-amber-300 hover:bg-amber-100/80'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-xs text-gray-900">
                                {order.customerName}
                              </span>
                              <span className={`font-black text-xs ${
                                isPaidFull ? 'text-emerald-900' : isPaidHalf ? 'text-amber-900' : 'text-gray-900'
                              }`}>
                                {formatCurrency(order.total)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-gray-500 font-medium">
                              <span className="flex items-center gap-1">
                                {isPickup ? <Store size={13} className="text-amber-700" /> : <Truck size={13} className="text-amber-800" />}
                                {isPickup ? 'Retirada' : 'Entrega'} • {timeStr}
                              </span>
                              <div className="flex items-center gap-1">
                                {isPaidFull ? (
                                  <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-emerald-600 text-white">
                                    ✓ Pago
                                  </span>
                                ) : isPaidHalf ? (
                                  <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-amber-500 text-white">
                                     50% Pago
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                                    Não Pago
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-center py-6 text-xs text-gray-400 font-medium italic">
                        Nenhum pedido agendado
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* --- VIEW 3: MENSAL (MONTHLY GRID) --- */}
        {viewMode === 'month' && (
          <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200 text-center font-bold text-xs text-gray-600">
              {dayNames.map((n, idx) => (
                <div key={idx} className="p-3 border-r border-gray-200 last:border-r-0">
                  {n}
                </div>
              ))}
            </div>

            {/* Month Day Cells */}
            <div className="grid grid-cols-7 auto-rows-fr divide-y divide-gray-100">
              {monthDays.map((d, i) => {
                if (!d) return <div key={i} className="min-h-[90px] bg-gray-50/50" />;
                const isCurrMonth = d.getMonth() === currentDate.getMonth();
                const todayActive = isToday(d);
                const dayOrders = periodOrders.filter(p => {
                  if (!p.date) return false;
                  return (
                    p.date.getDate() === d.getDate() &&
                    p.date.getMonth() === d.getMonth() &&
                    p.date.getFullYear() === d.getFullYear()
                  );
                });

                return (
                  <div
                    key={i}
                    className={`min-h-[100px] p-2 border-r border-gray-100 last:border-r-0 flex flex-col gap-1 transition-colors ${
                      !isCurrMonth
                        ? 'bg-gray-50/40 opacity-40'
                        : todayActive
                        ? 'bg-amber-50/40'
                        : 'hover:bg-gray-50/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold ${
                          todayActive
                            ? 'w-6 h-6 rounded-full text-white flex items-center justify-center shadow-sm font-black'
                            : 'text-gray-700'
                        }`}
                        style={todayActive ? { backgroundColor: settings?.primaryColor || '#865d39' } : {}}
                      >
                        {d.getDate()}
                      </span>
                      {dayOrders.length > 0 && (
                        <span className="text-[10px] font-black text-amber-900">
                          {dayOrders.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 overflow-y-auto max-h-[80px]">
                      {dayOrders.map(({ order, timeStr }) => {
                        const isPaidFull = order.paymentStatus === 'full';
                        const isPaidHalf = order.paymentStatus === 'half';
                        const isDelivered = order.deliveryStatus === 'delivered';
                        const isCardGreen = isDelivered && isPaidFull;

                        return (
                          <div
                            key={order.id}
                            onClick={() => setSelectedOrder(order)}
                            className={`px-1.5 py-1 rounded text-[10px] font-bold truncate cursor-pointer transition-all flex items-center justify-between gap-1 border shadow-2xs ${
                              isCardGreen
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-950 hover:bg-emerald-100'
                                : 'bg-amber-50 border-amber-300 text-amber-950 hover:bg-amber-100'
                            }`}
                          >
                            <span className="truncate">{order.customerName}</span>
                            <span className="shrink-0 font-black text-[9px]">
                              {isPaidFull ? '✓' : isPaidHalf ? '50%' : timeStr}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* DETALHES DO AGENDAMENTO MODAL (IMAGE 2 STYLE) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedOrder && (() => {
          const { timeStr, isPickup } = parseOrderDateTime(selectedOrder);
          const cleanPhone = selectedOrder.phone ? getCleanWhatsAppPhone(selectedOrder.phone, settings?.whatsappCountryCode || '+55') : '';
          
          const formatCreationDate = (createdAt: any): string => {
            if (!createdAt) return 'Recentemente';
            let d: Date | null = null;
            if (typeof createdAt?.toDate === 'function') {
              d = createdAt.toDate();
            } else if (createdAt instanceof Date) {
              d = createdAt;
            } else if (typeof createdAt === 'string' || typeof createdAt === 'number') {
              d = new Date(createdAt);
            } else if (createdAt?.seconds) {
              d = new Date(createdAt.seconds * 1000);
            }
            if (!d || isNaN(d.getTime())) return 'Recentemente';
            const pad = (n: number) => n.toString().padStart(2, '0');
            return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
          };

          const getDisplayDate = (order: Order): { text: string; isCreationDate: boolean } => {
            if (order.pickupDate && order.pickupDate.trim()) {
              const raw = order.pickupDate.trim();
              if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(raw)) {
                const parts = raw.split('/');
                return { text: `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`, isCreationDate: false };
              }
              if (/^\d{4}-\d{1,2}-\d{1,2}/.test(raw)) {
                const [y, m, d] = raw.split('-');
                return { text: `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`, isCreationDate: false };
              }
              return { text: raw, isCreationDate: false };
            }

            // Fallback para a data em que o pedido foi recebido (createdAt)
            let d: Date | null = null;
            const createdAt = order.createdAt;
            if (typeof createdAt?.toDate === 'function') {
              d = createdAt.toDate();
            } else if (createdAt instanceof Date) {
              d = createdAt;
            } else if (typeof createdAt === 'string' || typeof createdAt === 'number') {
              d = new Date(createdAt);
            } else if (createdAt?.seconds) {
              d = new Date(createdAt.seconds * 1000);
            }
            if (d && !isNaN(d.getTime())) {
              const pad = (n: number) => n.toString().padStart(2, '0');
              return { text: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, isCreationDate: true };
            }
            return { text: 'Hoje', isCreationDate: true };
          };

          const handleUpdateDeliveryType = async (type: 'delivery' | 'pickup') => {
            if (!selectedOrder?.id) return;
            setOrderOverrides(prev => ({
              ...prev,
              [selectedOrder.id]: { ...(prev[selectedOrder.id] || {}), deliveryType: type }
            }));
            setSelectedOrder(prev => prev ? { ...prev, deliveryType: type } : null);
            try {
              if (db) {
                await updateDoc(doc(db, 'pedidos', selectedOrder.id), {
                  deliveryType: type
                });
              }
              toast.success(`Modalidade alterada para ${type === 'delivery' ? 'Delivery' : 'Retirada'}!`);
            } catch (err) {
              console.error(err);
              toast.error('Erro ao atualizar modalidade de atendimento.');
            }
          };

          const handleUpdateDeliveryStatus = async (status: 'pending' | 'delivered') => {
            if (!selectedOrder?.id) return;
            setOrderOverrides(prev => ({
              ...prev,
              [selectedOrder.id]: { ...(prev[selectedOrder.id] || {}), deliveryStatus: status }
            }));
            setSelectedOrder(prev => prev ? { ...prev, deliveryStatus: status } : null);
            try {
              if (db) {
                await updateDoc(doc(db, 'pedidos', selectedOrder.id), {
                  deliveryStatus: status
                });
              }
              toast.success(status === 'delivered' ? 'Status alterado para Entregue!' : 'Status alterado para A Entregar!');
            } catch (err) {
              console.error(err);
              toast.error('Erro ao atualizar status de entrega.');
            }
          };

          const handleUpdatePaymentStatus = async (status: 'pending' | 'half' | 'full') => {
            if (!selectedOrder?.id) return;
            setOrderOverrides(prev => ({
              ...prev,
              [selectedOrder.id]: { ...(prev[selectedOrder.id] || {}), paymentStatus: status }
            }));
            setSelectedOrder(prev => prev ? { ...prev, paymentStatus: status } : null);
            try {
              if (db) {
                await updateDoc(doc(db, 'pedidos', selectedOrder.id), {
                  paymentStatus: status
                });
              }
              toast.success('Status do pagamento atualizado!');
            } catch (err) {
              console.error(err);
              toast.error('Erro ao atualizar status de pagamento.');
            }
          };

          const handleToggleValidateProduction = async () => {
            if (!selectedOrder?.id) return;
            const newStatus = !selectedOrder.isValidatedForProduction;
            setOrderOverrides(prev => ({
              ...prev,
              [selectedOrder.id]: { ...(prev[selectedOrder.id] || {}), isValidatedForProduction: newStatus }
            }));
            setSelectedOrder(prev => prev ? { ...prev, isValidatedForProduction: newStatus } : null);
            try {
              if (db) {
                await updateDoc(doc(db, 'pedidos', selectedOrder.id), {
                  isValidatedForProduction: newStatus
                });
              }
              toast.success(newStatus ? 'Pedido validado para produção!' : 'Validação de produção removida.');
            } catch (err) {
              console.error(err);
              toast.error('Erro ao atualizar validação.');
            }
          };

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedOrder(null)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />

              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="relative w-full max-w-2xl bg-[#faf8f5] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] z-10 border border-gray-200"
              >
                {/* Header idêntico às Imagens 2 e 3 */}
                <div className="p-5 sm:p-6 pb-4 bg-white border-b border-gray-100 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-amber-100/80 border border-amber-300 flex items-center justify-center text-amber-900 font-bold text-base shrink-0 shadow-2xs">
                      #
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xl sm:text-2xl font-serif font-bold text-gray-900 leading-tight">
                        Detalhes do Pedido
                      </h2>
                      <p className="text-xs text-gray-500 font-sans mt-0.5 truncate">
                        ID: <span className="font-mono text-gray-700">{selectedOrder.id}</span> • Criado em {formatCreationDate(selectedOrder.createdAt)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors cursor-pointer shrink-0"
                    title="Fechar"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Content Body */}
                <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
                  
                  {/* Card do Cliente com Botão Verde de WhatsApp no topo */}
                  <div className="p-4 rounded-2xl bg-white border border-gray-200/80 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <User size={18} className="text-amber-800 shrink-0" />
                        <h3 className="font-serif font-bold text-base sm:text-lg text-gray-950 truncate">
                          {selectedOrder.isB2B || selectedOrder.isPJ
                            ? (selectedOrder.b2bCompanyName || selectedOrder.customerName)
                            : selectedOrder.customerName
                          }
                        </h3>
                      </div>
                      {cleanPhone ? (
                        <a
                          href={`https://wa.me/${cleanPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                          title="Abrir no WhatsApp"
                        >
                          <Phone size={13} />
                          <span>{selectedOrder.phone}</span>
                        </a>
                      ) : selectedOrder.phone ? (
                        <span className="text-xs font-bold text-gray-600">{selectedOrder.phone}</span>
                      ) : null}
                    </div>

                    {selectedOrder.email && (
                      <div className="flex items-center gap-2 text-xs text-gray-600 pt-2 border-t border-gray-100">
                        <Mail size={13} className="text-gray-400 shrink-0" />
                        <span className="truncate">{selectedOrder.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Dois Cards: Data de Entrega/Retirada e Horário & Modalidade */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Card Data de Entrega / Retirada */}
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-gray-200/80 shadow-2xs space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700">
                          <Calendar size={13} />
                          <span>DATA DA ENTREGA / RETIRADA</span>
                        </div>
                        {!isEditingPickupDate && (
                          <button
                            type="button"
                            onClick={() => {
                              const cur = selectedOrder.pickupDate || '';
                              if (cur.includes('/')) {
                                setEditingPickupDateValue(cur);
                              } else if (cur.includes('-')) {
                                const parts = cur.split('-');
                                if (parts.length === 3) {
                                  setEditingPickupDateValue(`${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`);
                                } else {
                                  setEditingPickupDateValue('');
                                }
                              } else {
                                setEditingPickupDateValue(cur);
                              }
                              setIsEditingPickupDate(true);
                            }}
                            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Edit2 size={11} /> Alterar Data
                          </button>
                        )}
                      </div>

                      {isEditingPickupDate ? (
                        <div className="pt-2 mt-1 space-y-2">
                          <label className="text-[10px] font-bold text-gray-600 uppercase block">
                            Escolha a nova data no calendário (DD/MM/AAAA):
                          </label>
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                placeholder="DD/MM/AAAA"
                                maxLength={10}
                                autoFocus
                                className="w-32 px-3 py-1.5 text-xs font-bold rounded-xl border border-amber-300 bg-white text-gray-900 shadow-xs outline-none focus:ring-2 focus:ring-amber-500/20 text-center font-mono"
                                value={editingPickupDateValue}
                                onChange={e => {
                                  let v = e.target.value.replace(/\D/g, '');
                                  if (v.length > 8) v = v.slice(0, 8);
                                  if (v.length > 4) {
                                    v = `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
                                  } else if (v.length > 2) {
                                    v = `${v.slice(0, 2)}/${v.slice(2)}`;
                                  }
                                  setEditingPickupDateValue(v);
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  try {
                                    datePickerInputRef.current?.showPicker?.();
                                  } catch (_) {
                                    datePickerInputRef.current?.focus();
                                  }
                                }}
                                className="p-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 transition-colors cursor-pointer shadow-2xs"
                                title="Abrir Calendário"
                              >
                                <Calendar size={15} />
                              </button>
                              <input
                                ref={datePickerInputRef}
                                type="date"
                                className="sr-only absolute pointer-events-none opacity-0"
                                tabIndex={-1}
                                onChange={e => {
                                  const val = e.target.value;
                                  if (val && val.includes('-')) {
                                    const [y, m, d] = val.split('-');
                                    setEditingPickupDateValue(`${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`);
                                  }
                                }}
                              />
                            </div>
                            <button
                              type="button"
                              disabled={isSavingPickupDate || !editingPickupDateValue}
                              onClick={async () => {
                                if (!selectedOrder?.id) return;
                                const parts = editingPickupDateValue.split('/');
                                if (parts.length !== 3 || parts[0].length !== 2 || parts[1].length !== 2 || parts[2].length !== 4) {
                                  toast.error('Informe a data completa no formato DD/MM/AAAA');
                                  return;
                                }
                                setIsSavingPickupDate(true);
                                try {
                                  if (db) {
                                    await updateDoc(doc(db, 'pedidos', selectedOrder.id), {
                                      pickupDate: editingPickupDateValue
                                    });
                                  }
                                  setOrderOverrides(prev => ({
                                    ...prev,
                                    [selectedOrder.id]: { ...(prev[selectedOrder.id] || {}), pickupDate: editingPickupDateValue }
                                  }));
                                  setSelectedOrder(prev => prev ? { ...prev, pickupDate: editingPickupDateValue } : null);
                                  toast.success(`Data alterada para ${editingPickupDateValue}!`);
                                  setIsEditingPickupDate(false);
                                } catch (err) {
                                  console.error(err);
                                  toast.error('Erro ao atualizar data.');
                                } finally {
                                  setIsSavingPickupDate(false);
                                }
                              }}
                              className="px-3.5 py-1.5 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50"
                            >
                              {isSavingPickupDate ? 'Salvando...' : 'Salvar Data'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsEditingPickupDate(false)}
                              className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (() => {
                        const dateInfo = getDisplayDate(selectedOrder);
                        return (
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="text-base sm:text-lg font-bold text-gray-900 font-serif">
                              {dateInfo.text}
                            </span>
                            {dateInfo.isCreationDate && (
                              <span className="text-[10px] font-bold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200">
                                Recebido em
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Card Modalidade (Delivery vs Retirada - Seleção do Admin) */}
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-gray-200/80 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-purple-800">
                          MODALIDADE
                        </span>
                        <span className="text-[11px] font-semibold text-gray-500">
                          Selecione:
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateDeliveryType('delivery')}
                          className={cn(
                            "py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs active:scale-95",
                            (selectedOrder.deliveryType === 'delivery' || (!selectedOrder.deliveryType && !isPickup))
                              ? "bg-purple-700 text-white border-2 border-purple-800 shadow-xs"
                              : "bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"
                          )}
                        >
                          Delivery
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateDeliveryType('pickup')}
                          className={cn(
                            "py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs active:scale-95",
                            (selectedOrder.deliveryType === 'pickup' || isPickup)
                              ? "bg-amber-800 text-white border-2 border-amber-900 shadow-xs"
                              : "bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"
                          )}
                        >
                          Retirada
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Endereço de Entrega */}
                  {selectedOrder.address && (
                    <div className="p-3.5 rounded-2xl bg-white border border-gray-200/80 shadow-2xs space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-700">
                        <MapPin size={13} />
                        <span>ENDEREÇO DE ENTREGA</span>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-800 font-medium pt-0.5">
                        {selectedOrder.address}
                      </p>
                    </div>
                  )}

                  {/* Observações do Cliente */}
                  {selectedOrder.observation && (
                    <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 shadow-2xs space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-900">
                        <span></span>
                        <span>OBSERVAÇÕES DO CLIENTE</span>
                      </div>
                      <p className="text-xs sm:text-sm text-amber-950 font-medium italic pt-0.5">
                        {selectedOrder.observation}
                      </p>
                    </div>
                  )}

                  {/* Itens Solicitados conforme Imagens 2 e 3 */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-1.5 text-sm sm:text-base font-serif font-bold text-amber-950">
                      <span></span>
                      <span>Itens Solicitados</span>
                    </div>

                    <div className="space-y-3">
                      {selectedOrder.items?.map((item, idx) => (
                        <div key={idx} className="p-3.5 rounded-2xl bg-white border border-gray-200/80 shadow-xs space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-serif font-bold text-sm sm:text-base text-gray-900">
                              {item.quantity}x {item.title}
                            </h4>
                            <span className="font-serif font-bold text-sm sm:text-base text-gray-950 shrink-0">
                              {formatCurrency((item.price || 0) * (item.quantity || 1))}
                            </span>
                          </div>

                          {item.selectedSize && (
                            <span className="inline-block bg-[#ffedd5] text-[#7c2d12] text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md leading-none border border-[#fed7aa] w-fit">
                              {item.selectedSize.name}
                            </span>
                          )}

                          {/* Box com sabores do combo em amarelo idêntico às Imagens 2 e 3 */}
                          {item.comboSelections && item.comboSelections.length > 0 && (
                            <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-300/80 text-xs space-y-1">
                              <span className="font-bold text-amber-950 uppercase tracking-wider text-[10.5px] block">
                                SABORES ESCOLHIDOS NO COMBO:
                              </span>
                              {item.comboSelections.map((sel, sIdx) => (
                                <p key={sIdx} className="text-neutral-800 text-xs">
                                  • {(sel.quantity ?? sel.count ?? 1)}x {sel.dishTitle}
                                </p>
                              ))}
                            </div>
                          )}

                          {item.mealOptions && (
                            <div className="text-xs text-gray-600 space-y-0.5">
                              {item.mealOptions.removals && item.mealOptions.removals.length > 0 && (
                                <p>Exclusões: {item.mealOptions.removals.join(', ')}</p>
                              )}
                              {item.mealOptions.sides && item.mealOptions.sides.length > 0 && (
                                <p>Acompanhamentos: {item.mealOptions.sides.map(s => s.name).join(', ')}</p>
                              )}
                            </div>
                          )}

                          {item.cakeOptions && (
                            <div className="text-xs text-gray-600 space-y-0.5">
                              {item.cakeOptions.size && <p>Tamanho: {item.cakeOptions.size}</p>}
                              {item.cakeOptions.dough && <p>Massa: {item.cakeOptions.dough}</p>}
                              {item.cakeOptions.fillings && item.cakeOptions.fillings.length > 0 && (
                                <p>Recheios: {item.cakeOptions.fillings.join(' + ')}</p>
                              )}
                              {item.cakeOptions.topping && <p>Cobertura: {item.cakeOptions.topping}</p>}
                              {item.cakeOptions.topper && <p>Topper: {item.cakeOptions.topper}</p>}
                            </div>
                          )}

                          {item.sandwichOptions && (
                            <div className="text-xs text-gray-600">
                              Recheios: {item.sandwichOptions.fillings.join(' + ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <span className="font-serif font-bold text-base sm:text-lg text-gray-900">Total do Pedido:</span>
                      <span className="font-serif font-bold text-xl sm:text-2xl text-gray-950">
                        {formatCurrency(selectedOrder.total)}
                      </span>
                    </div>
                  </div>

                  {/* Status de Entrega & Pagamento conforme Imagem 3 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    {/* Status da Entrega */}
                    <div className="p-3.5 rounded-2xl bg-white border border-gray-200/80 shadow-xs space-y-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 block">
                        STATUS DA ENTREGA
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateDeliveryStatus('pending')}
                          className={cn(
                            "py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1",
                            selectedOrder.deliveryStatus !== 'delivered'
                              ? "bg-amber-50 text-amber-900 border-2 border-amber-400 shadow-xs"
                              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                          )}
                        >
                          <span>⏳</span> A Entregar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateDeliveryStatus('delivered')}
                          className={cn(
                            "py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1",
                            selectedOrder.deliveryStatus === 'delivered'
                              ? "bg-emerald-50 text-emerald-900 border-2 border-emerald-500 shadow-xs"
                              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                          )}
                        >
                          <span>✓</span> Entregue
                        </button>
                      </div>
                    </div>

                    {/* Status do Pagamento */}
                    <div className="p-3.5 rounded-2xl bg-white border border-gray-200/80 shadow-xs space-y-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 block">
                        STATUS DO PAGAMENTO
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleUpdatePaymentStatus('pending')}
                          className={cn(
                            "py-2 px-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1",
                            (!selectedOrder.paymentStatus || selectedOrder.paymentStatus === 'pending')
                              ? "bg-red-50 text-red-700 border-2 border-red-400 shadow-xs"
                              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                          )}
                        >
                          <span>❌</span> Não Rec.
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdatePaymentStatus('half')}
                          className={cn(
                            "py-2 px-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1",
                            selectedOrder.paymentStatus === 'half'
                              ? "bg-amber-50 text-amber-800 border-2 border-amber-400 shadow-xs"
                              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                          )}
                        >
                          <span></span> 50%
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdatePaymentStatus('full')}
                          className={cn(
                            "py-2 px-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1",
                            selectedOrder.paymentStatus === 'full'
                              ? "bg-emerald-50 text-emerald-900 border-2 border-emerald-500 shadow-xs"
                              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                          )}
                        >
                          <span>✓</span> Integral
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Seção de Envio de Instruções de Pós-Venda via WhatsApp */}
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <h4 className="text-xs font-bold uppercase tracking-wide text-amber-950">
                        Enviar Mensagem de Pós-Venda (WhatsApp)
                      </h4>
                      <span className="text-[11px] text-amber-800/80">
                        Inicia com "Olá {selectedOrder.customerName || 'Cliente'}! Aqui é da {settings?.brandName || 'Grão & Sabor'}."
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {(settings.quickInstructions && settings.quickInstructions.length > 0 ? settings.quickInstructions : DEFAULT_QUICK_INSTRUCTIONS)
                        .filter(i => i.active !== false)
                        .map(inst => {
                          const fullMsg = formatInstructionWhatsAppMessage(inst.message, selectedOrder, settings);
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

                </div>

                {/* Rodapé com todos os 5 botões em UMA ÚNICA LINHA conforme Imagem 3 */}
                <div className="p-3.5 sm:p-4 bg-gray-50 border-t border-gray-200/80">
                  <div className="flex items-center justify-between gap-1.5 sm:gap-2 overflow-x-auto w-full">
                    <button
                      type="button"
                      onClick={() => {
                        if (onPrintOrder) {
                          onPrintOrder(selectedOrder);
                        } else {
                          window.print();
                        }
                      }}
                      className="px-2.5 sm:px-3.5 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-gray-800 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 whitespace-nowrap shrink-0"
                    >
                      <Printer size={14} /> Imprimir Comanda
                    </button>

                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleToggleValidateProduction}
                        className={cn(
                          "px-2 sm:px-3 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-sm active:scale-95 whitespace-nowrap",
                          selectedOrder.isValidatedForProduction
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-blue-600 hover:bg-blue-700 text-white"
                        )}
                      >
                        {selectedOrder.isValidatedForProduction ? '✓ Validado' : 'Validar Produção'}
                      </button>

                      <button
                        type="button"
                        onClick={() => sendOrderToWhatsApp(selectedOrder, settings)}
                        className="px-2 sm:px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 whitespace-nowrap"
                        title="Reenviar pelo WhatsApp"
                      >
                        <MessageCircle size={14} /> Reenviar
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const ord = selectedOrder;
                          setSelectedOrder(null);
                          if (onEditOrder) {
                            onEditOrder(ord);
                          } else if (onSelectOrderInList) {
                            onSelectOrderInList(ord.id);
                          }
                        }}
                        className="px-2 sm:px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 whitespace-nowrap"
                      >
                        <Edit2 size={14} /> Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedOrder(null)}
                        className="px-2.5 sm:px-3.5 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs transition-all cursor-pointer active:scale-95 whitespace-nowrap"
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                </div>

              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};
