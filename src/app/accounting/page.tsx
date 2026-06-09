"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { 
  Calculator, ShoppingCart, Users, Zap, TrendingUp, 
  DollarSign, ChevronLeft, PieChart, ArrowRight, 
  AlertTriangle, CheckCircle2, Save, Loader2, Calendar,
  Receipt, Wallet, SmartphoneNfc, RefreshCw, Package
} from "lucide-react";

type TimeRange = "today" | "yesterday" | "7days" | "this_month" | "this_year" | "custom";

export default function AccountingPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSavePopup, setShowSavePopup] = useState(false);

  // 🌟 State ระบบเวลา
  const [timeRange, setTimeRange] = useState<TimeRange>("today");
  // เปลี่ยนเป็นเลือกวันเดียว
  const [customDate, setCustomDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // 🌟 State ข้อมูลจริงจาก Database
  const [actualSales, setActualSales] = useState<number>(0);
  const [orderCount, setOrderCount] = useState<number>(0);
  const [cashTotal, setCashTotal] = useState<number>(0);
  const [transferTotal, setTransferTotal] = useState<number>(0);
  
  // 🌟 State เก็บมูลค่าของที่ซิงค์มา (Stock & Payroll)
  const [stockValue, setStockValue] = useState<number>(0);
  const [payrollValue, setPayrollValue] = useState<number>(0);

  // 🌟 State สำหรับเครื่องจำลอง (Simulator)
  const [simulatedSales, setSimulatedSales] = useState<number>(100000);
  const [percents, setPercents] = useState({
    cogs: 40,
    payroll: 35,
    misc: 5,
    profit: 20
  });

  // 1. ดึงข้อมูลเปอร์เซ็นต์ที่เคยบันทึกไว้
  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await supabase
        .from("store_settings")
        .select("accounting_percents")
        .eq("id", 1)
        .single();
      
      if (data?.accounting_percents) {
        setPercents(data.accounting_percents);
      }
    };
    loadSettings();
  }, []);

  // 2. ดึงข้อมูลออเดอร์, คลังสินค้า และ ค่าแรงพนักงาน
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      const now = new Date();
      let startDate = new Date(0);
      let endDate = new Date(8640000000000000);

      // ดึงเวลาเริ่มวันจากร้าน (ถ้ามี) หรือใช้ 07:00 เป็นค่าตั้งต้น
      const bizHour = 7; 
      const currentBizDate = new Date(now);
      if (now.getHours() < bizHour) currentBizDate.setDate(currentBizDate.getDate() - 1);
      
      const y = currentBizDate.getFullYear();
      const m = currentBizDate.getMonth();
      const d = currentBizDate.getDate();

      if (timeRange === "today") {
        startDate = new Date(y, m, d, bizHour, 0, 0, 0);
        endDate = new Date(y, m, d + 1, bizHour, 0, 0, 0);
      } else if (timeRange === "yesterday") {
        startDate = new Date(y, m, d - 1, bizHour, 0, 0, 0);
        endDate = new Date(y, m, d, bizHour, 0, 0, 0);
      } else if (timeRange === "7days") {
        startDate = new Date(y, m, d - 7, bizHour, 0, 0, 0);
        endDate = new Date(y, m, d + 1, bizHour, 0, 0, 0); // ถึงปัจจุบัน
      } else if (timeRange === "this_month") {
        startDate = new Date(y, m, 1, bizHour, 0, 0, 0);
        endDate = new Date(y, m + 1, 1, bizHour, 0, 0, 0);
      } else if (timeRange === "this_year") {
        startDate = new Date(y, 0, 1, bizHour, 0, 0, 0);
        endDate = new Date(y + 1, 0, 1, bizHour, 0, 0, 0);
      } else if (timeRange === "custom") {
        if (customDate) { 
          // 🌟 ถ้าเลือกวันเดียว ให้คำนวณตัดรอบกะของวันนั้น (เช่น 07:00 ของวันที่เลือก ถึง 07:00 วันถัดไป)
          const [year, month, day] = customDate.split('-').map(Number);
          startDate = new Date(year, month - 1, day, bizHour, 0, 0, 0);
          endDate = new Date(year, month - 1, day + 1, bizHour, 0, 0, 0);
        }
      }

      // ดึงออเดอร์ (ยอดขาย)
      const { data: orders } = await supabase
        .from("orders")
        .select("total_price, payment_method, status")
        .in("status", ["รับงาน", "ส่งแล้ว/เสร็จ"])
        .or("is_deleted.is.null,is_deleted.eq.false")
        .gte("created_at", startDate.toISOString())
        .lt("created_at", endDate.toISOString());

      // ดึงสต๊อก (ต้นทุนซื้อของ)
      const { data: items } = await supabase.from("stock_items").select("id, price_per_unit");
      const { data: balances } = await supabase.from("stock_balances").select("item_id, quantity");

      // ดึงค่าแรง (Payroll)
      const { data: attendances } = await supabase
        .from("rider_attendance")
        .select("total_pay")
        .gte("check_in", startDate.toISOString())
        .lt("check_in", endDate.toISOString());

      if (isMounted) {
        if (orders) {
          let total = 0;
          let cash = 0;
          let transfer = 0;
          
          orders.forEach(o => {
            total += o.total_price || 0;
            if (o.payment_method === "เงินสด" || !o.payment_method) cash += o.total_price || 0;
            else transfer += o.total_price || 0;
          });

          setActualSales(total);
          setOrderCount(orders.length);
          setCashTotal(cash);
          setTransferTotal(transfer);
          
          if (total > 0) setSimulatedSales(total);
        }

        if (items && balances) {
          let totalVal = 0;
          items.forEach(item => {
            const itemBalances = balances.filter(b => b.item_id === item.id);
            const qty = itemBalances.reduce((sum, b) => sum + (b.quantity || 0), 0);
            totalVal += qty * (item.price_per_unit || 0);
          });
          setStockValue(totalVal);
        }

        if (attendances) {
          const totalPayroll = attendances.reduce((sum, record) => sum + (record.total_pay || 0), 0);
          setPayrollValue(totalPayroll);
        }
        
        setIsLoading(false);
      }
    };

    loadData();

    return () => { isMounted = false; };
  }, [timeRange, customDate]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    const { error } = await supabase
      .from("store_settings")
      .update({ accounting_percents: percents })
      .eq("id", 1);
    
    setIsSaving(false);
    if (!error) {
      setShowSavePopup(true);
      setTimeout(() => setShowSavePopup(false), 2500);
    } else {
      alert("เกิดข้อผิดพลาดในการบันทึก");
    }
  };

  const handleAmountChange = (key: keyof typeof percents, val: string) => {
    if (simulatedSales <= 0) return;
    if (val === "") {
      setPercents(prev => ({ ...prev, [key]: 0 }));
      return;
    }
    const newPercent = (Number(val) / simulatedSales) * 100;
    setPercents(prev => ({ ...prev, [key]: newPercent }));
  };

  const handlePercentChange = (key: keyof typeof percents, val: string) => {
    if (val === "") {
      setPercents(prev => ({ ...prev, [key]: 0 }));
      return;
    }
    setPercents(prev => ({ ...prev, [key]: Number(val) }));
  };

  const allocations = useMemo(() => {
    return {
      cogs: { 
        id: "cogs" as const, 
        label: "ยอดซื้อของ (วัตถุดิบ)", 
        percent: percents.cogs, 
        amount: (simulatedSales * percents.cogs) / 100, 
        color: "bg-rose-500", light: "bg-rose-50", text: "text-rose-600", icon: ShoppingCart 
      },
      payroll: { 
        id: "payroll" as const, 
        label: "ค่าแรงพนักงาน", 
        percent: percents.payroll, 
        amount: (simulatedSales * percents.payroll) / 100, 
        color: "bg-blue-500", light: "bg-blue-50", text: "text-blue-600", icon: Users 
      },
      misc: { 
        id: "misc" as const, 
        label: "จิปาถะ (น้ำ,ไฟ,เช่า)", 
        percent: percents.misc, 
        amount: (simulatedSales * percents.misc) / 100, 
        color: "bg-amber-500", light: "bg-amber-50", text: "text-amber-600", icon: Zap 
      },
      profit: { 
        id: "profit" as const, 
        label: "กำไรสุทธิ", 
        percent: percents.profit, 
        amount: (simulatedSales * percents.profit) / 100, 
        color: "bg-emerald-500", light: "bg-emerald-50", text: "text-emerald-600", icon: TrendingUp 
      },
    };
  }, [simulatedSales, percents]);

  const totalPercent = useMemo(() => {
    return parseFloat((percents.cogs + percents.payroll + percents.misc + percents.profit).toFixed(2));
  }, [percents]);

  const avgOrderValue = orderCount > 0 ? Math.round(actualSales / orderCount) : 0;

  if (isLoading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-indigo-500 mb-4" size={48} />
      <p className="font-black text-slate-400 tracking-widest">กำลังดึงข้อมูลบัญชี...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20 relative">

      {showSavePopup && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-200 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-4xl p-8 shadow-2xl flex flex-col items-center animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 border border-slate-100">
            <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-inner relative">
              <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-20"></div>
              <CheckCircle2 size={50} className="animate-bounce" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2">บันทึกสำเร็จ!</h2>
            <p className="text-slate-500 font-bold">โครงสร้างบัญชีถูกอัปเดตเรียบร้อยแล้ว</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Link href="/home" className="p-2 hover:bg-slate-100 rounded-full text-slate-500 bg-white shadow-sm border border-slate-200 active:scale-95 cursor-pointer">
              <ChevronLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                <PieChart className="text-indigo-600" size={24} /> ระบบบัญชีร้าน
              </h1>
            </div>
          </div>

          <div className="flex w-full md:w-auto gap-3 items-center">
            <div className="flex flex-1 items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
              <Calendar size={16} className="text-slate-500 ml-3 mr-1" />
              <select 
                value={timeRange}
                onChange={(e) => {
                  setIsLoading(true);
                  setTimeRange(e.target.value as TimeRange);
                }}
                className="bg-transparent text-sm font-black text-slate-700 outline-none cursor-pointer p-2 w-full"
              >
                <option value="today">🔥 วันนี้ (กะปัจจุบัน)</option>
                <option value="yesterday">⏪ เมื่อวาน</option>
                <option value="7days">📅 7 วันล่าสุด</option>
                <option value="this_month">📊 เดือนนี้</option>
                <option value="this_year">📆 ปีนี้</option>
                <option value="custom">⚙️ กำหนดวันเอง...</option>
              </select>
            </div>
            
            <button 
              onClick={handleSaveSettings}
              disabled={isSaving || totalPercent !== 100}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-500/30 transition-all active:scale-95 disabled:bg-slate-300 disabled:shadow-none cursor-pointer"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              บันทึก
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        
        {/* 🌟 Custom Date Input (เปลี่ยนเป็นเลือกวันเดียว) */}
        {timeRange === 'custom' && (
          <div className="flex justify-end animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-slate-500 font-bold text-xs">เลือกวันที่:</span>
              <input 
                type="date" 
                value={customDate} 
                onChange={e => { setIsLoading(true); setCustomDate(e.target.value); }} 
                className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-700 outline-none cursor-pointer"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800 text-white rounded-3xl p-5 shadow-lg border border-slate-700 flex flex-col justify-between relative overflow-hidden">
            <DollarSign className="absolute -right-2 -bottom-2 text-slate-700 opacity-50" size={80} />
            <div className="relative z-10">
              <p className="text-xs font-black text-slate-400 mb-1 uppercase tracking-wider">ยอดขายจริง (ที่เลือก)</p>
              <h3 className="text-2xl md:text-3xl font-black tracking-tighter">฿{actualSales.toLocaleString()}</h3>
            </div>
          </div>
          
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
            <p className="text-xs font-black text-slate-500 mb-1 uppercase tracking-wider flex items-center gap-1"><Receipt size={14}/> จำนวนออเดอร์</p>
            <h3 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter">{orderCount} <span className="text-sm font-bold text-slate-400">บิล</span></h3>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
            <p className="text-xs font-black text-slate-500 mb-1 uppercase tracking-wider flex items-center gap-1"><TrendingUp size={14}/> ยอดเฉลี่ย/บิล (AOV)</p>
            <h3 className="text-2xl md:text-3xl font-black text-indigo-600 tracking-tighter">฿{avgOrderValue.toLocaleString()}</h3>
          </div>

          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200 flex flex-col justify-center gap-2">
            <div className="flex justify-between items-center bg-emerald-50 px-3 py-2 rounded-xl">
              <span className="text-[10px] font-black text-emerald-600 flex items-center"><SmartphoneNfc size={12} className="mr-1"/> โอน</span>
              <span className="font-black text-emerald-700 text-sm">฿{transferTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center bg-amber-50 px-3 py-2 rounded-xl">
              <span className="text-[10px] font-black text-amber-600 flex items-center"><Wallet size={12} className="mr-1"/> เงินสด</span>
              <span className="font-black text-amber-700 text-sm">฿{cashTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {totalPercent !== 100 && (
          <div className={`p-4 rounded-3xl flex items-center gap-3 font-bold text-sm shadow-sm animate-in zoom-in-95 ${totalPercent > 100 ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
            <AlertTriangle size={20} className="animate-pulse" />
            <span>{totalPercent > 100 ? `ยอดรวมเกิน 100% (${totalPercent}%) คำนวณเพี้ยนแน่!` : `ยอดรวมยังไม่ถึง 100% (${totalPercent}%) กรุณาจัดสรรเพิ่ม`}</span>
          </div>
        )}

        <div className="bg-white rounded-4xl p-6 md:p-10 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden mt-8">
          <div className="absolute -right-10 -top-10 bg-indigo-50 w-48 h-48 rounded-full opacity-50 pointer-events-none"></div>
          <div className="w-full md:w-1/2 relative z-10">
            <h2 className="text-lg font-black text-slate-700 flex items-center gap-2 mb-2">
              <Calculator size={20} className="text-indigo-500" /> เครื่องจำลองยอดขาย (Simulator)
            </h2>
            <p className="text-xs font-bold text-slate-400 mb-4">* ค่าตั้งต้นจะดึงยอดขายจริงมาให้ แต่สามารถพิมพ์แก้เพื่อจำลองยอดอื่นได้</p>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <span className="text-2xl font-black text-slate-300 group-focus-within:text-indigo-500">฿</span>
              </div>
              <input
                type="number"
                value={simulatedSales || ""}
                onChange={(e) => setSimulatedSales(Number(e.target.value))}
                className="w-full pl-12 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl text-3xl font-black text-slate-800 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>
        </div>

        <h3 className="font-black text-slate-700 px-2 flex items-center gap-2 pt-4">
          ปรับแต่งโครงสร้างบัญชี <ArrowRight size={16} className="text-slate-400" />
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(allocations).map(([key, data]) => {
            const Icon = data.icon;
            return (
              <div key={key} className={`bg-white rounded-[2.5rem] p-8 border-2 transition-all hover:shadow-xl ${data.light} border-transparent hover:border-current group relative overflow-hidden`}>
                <Icon size={120} className={`absolute -right-6 -bottom-6 opacity-5 ${data.text}`} />
                
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm bg-white ${data.text}`}>
                    <Icon size={28} />
                  </div>
                  
                  <div className={`flex items-center gap-1 px-4 py-2 rounded-2xl shadow-sm transition-all focus-within:ring-4 bg-white border border-slate-200 focus-within:border-transparent ${data.text}`}>
                    <input
                      type="number"
                      value={data.percent === 0 ? "" : Number(data.percent.toFixed(4))}
                      onChange={(e) => handlePercentChange(data.id, e.target.value)}
                      className="w-12 text-right bg-transparent outline-none font-black text-xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-pointer"
                      placeholder="0"
                    />
                    <span className="text-sm font-black text-slate-400">%</span>
                  </div>
                </div>
                
                <h4 className="text-slate-500 font-bold text-sm mb-2 uppercase tracking-wide relative z-10">{data.label}</h4>
                
                <div className="relative mt-2 z-10 flex items-center group/amount">
                  <span className={`text-3xl font-black mr-1 ${data.text}`}>฿</span>
                  <input
                    type="number"
                    value={data.amount === 0 ? "" : Number(data.amount.toFixed(2))}
                    onChange={(e) => handleAmountChange(data.id, e.target.value)}
                    className={`w-full bg-transparent border-b-2 border-dashed border-slate-300 outline-none text-4xl font-black tracking-tighter text-slate-800 focus:border-current transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                    title="คลิกเพื่อแก้ไขยอดเงิน (เปอร์เซ็นต์จะเปลี่ยนตาม)"
                    placeholder="0"
                  />
                </div>

                {data.id === 'cogs' && (
                  <div className="mt-5 flex items-center justify-between bg-white border border-rose-100 p-3 rounded-2xl shadow-sm relative z-10">
                    <div>
                      <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1">
                        <Package size={12}/> มูลค่าสต๊อกรวม (ปัจจุบัน)
                      </p>
                      <p className="text-sm font-black text-rose-700">฿{stockValue.toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => handleAmountChange('cogs', stockValue.toString())}
                      className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black transition-all active:scale-95 shadow-md flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw size={14} className="hover:animate-spin" /> ดึงยอดมาใช้
                    </button>
                  </div>
                )}

                {data.id === 'payroll' && (
                  <div className="mt-5 flex items-center justify-between bg-white border border-blue-100 p-3 rounded-2xl shadow-sm relative z-10">
                    <div>
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1">
                        <Users size={12}/> ค่าแรงจ่ายจริงตามช่วงเวลา
                      </p>
                      <p className="text-sm font-black text-blue-700">฿{payrollValue.toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => handleAmountChange('payroll', payrollValue.toString())}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-black transition-all active:scale-95 shadow-md flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw size={14} className="hover:animate-spin" /> ดึงยอดมาใช้
                    </button>
                  </div>
                )}
                
                <div className="w-full bg-white/60 h-3 rounded-full mt-6 overflow-hidden shadow-inner relative z-10">
                  <div 
                    className={`h-full ${data.color} rounded-full transition-all duration-700 ease-out`}
                    style={{ width: `${Math.min(data.percent, 100)}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}