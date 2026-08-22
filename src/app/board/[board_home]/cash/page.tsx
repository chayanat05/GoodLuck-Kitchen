"use client";
import { useState, useEffect, use, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { 
  Banknote, 
  ArrowLeft, 
  CheckCircle2, 
  Circle, 
  User, 
  Receipt,
  Loader2,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import Swal from "sweetalert2";

interface CashOrder {
  id: string;
  order_number: string;
  total_price: number;
  delivery_fee: number;
  rider_name: string;
  is_cash_collected: boolean;
  cash_received: number; // 🌟 เพิ่มคอลัมน์เก็บยอดเงินที่รับมา
  end_time: string;
}

export default function CashClearancePage({ params }: { params: Promise<{ board_home: string }> }) {
  const resolvedParams = use(params);
  const branchSlug = resolvedParams.board_home;

  const [orders, setOrders] = useState<CashOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchId, setBranchId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    const { data: branchData } = await supabase.from("branches").select("id, cut_off_hour").eq("slug", branchSlug).single();
    if (!branchData) return;
    setBranchId(branchData.id);

    const now = new Date();
    const shiftStart = new Date(now);
    const cutOff = branchData.cut_off_hour || 4; 
    if (now.getHours() < cutOff) { shiftStart.setDate(shiftStart.getDate() - 1); }
    shiftStart.setHours(cutOff, 0, 0, 0);

    const { data, error } = await supabase
      .from("orders")
      .select("id, order_number, total_price, delivery_fee, rider_name, is_cash_collected, cash_received, end_time")
      .eq("branch_id", branchData.id)
      .eq("status", "ส่งแล้ว/เสร็จ")
      .eq("payment_method", "เงินสด")
      .gte("end_time", shiftStart.toISOString())
      .order("rider_name", { ascending: true });

    if (!error && data) setOrders(data as CashOrder[]);
    setLoading(false);
  }, [branchSlug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOrders();
  }, [fetchOrders]);

  // 🌟 ฟังก์ชันใส่จำนวนเงิน (แก้ไขยอด)
  const handleUpdateCash = async (order: CashOrder) => {
    const currentReceived = order.cash_received || 0;
    const remaining = order.total_price - currentReceived;

    const { value: formValue } = await Swal.fire({
      title: `ออเดอร์ ${order.order_number}`,
      html: `
        <div class="text-left text-sm space-y-2 mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div class="flex justify-between text-slate-500"><span>ยอดเต็มของบิล:</span> <b>฿${order.total_price}</b></div>
          <div class="flex justify-between text-emerald-600"><span>รับมาแล้ว:</span> <b>฿${currentReceived}</b></div>
          <div class="flex justify-between border-t border-slate-200 pt-2 mt-2 text-rose-500 text-lg"><span>ต้องเก็บเพิ่มอีก:</span> <b>฿${remaining > 0 ? remaining : 0}</b></div>
        </div>
      `,
      input: 'number',
      inputLabel: 'ใส่ยอดเงินรวมทั้งหมดที่รับมาแล้ว (บาท)',
      inputValue: order.total_price, // ค่าเริ่มต้นให้เป็นยอดเต็ม จะได้กดตกลงง่ายๆ
      showCancelButton: true,
      confirmButtonText: 'บันทึกยอด',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#3b82f6'
    });

    if (formValue !== undefined) {
      const received = parseInt(formValue, 10);
      if (isNaN(received) || received < 0) {
        toast.error("กรุณาใส่ตัวเลขที่ถูกต้อง");
        return;
      }

      const isCollected = received >= order.total_price;

      // 1. อัปเดตหน้าจอทันที
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, cash_received: received, is_cash_collected: isCollected } : o));

      // 2. บันทึกลงฐานข้อมูล
      const { error } = await supabase
        .from("orders")
        .update({ cash_received: received, is_cash_collected: isCollected })
        .eq("id", order.id);

      if (error) {
        toast.error("เกิดข้อผิดพลาดในการบันทึก");
        fetchOrders();
      } else {
        if (isCollected) toast.success("รับเงินครบแล้ว ✅");
        else toast.info(`รับมา ฿${received} (ค้าง ฿${order.total_price - received})`);
      }
    }
  };

  const markAllAsCollected = async (riderName: string, riderOrders: CashOrder[]) => {
    Swal.fire({
      title: `เก็บยอดทั้งหมดของ ${riderName}?`,
      text: "ระบบจะติ๊กรับเงินเต็มจำนวนให้ทุกบิลของคนนี้",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "รับเงินครบทั้งหมด",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#10b981",
    }).then(async (result) => {
      if (result.isConfirmed) {
        // อัปเดตหน้าจอทันที
        setOrders(prev => prev.map(o => o.rider_name === riderName ? { ...o, is_cash_collected: true, cash_received: o.total_price } : o));

        // คัดเฉพาะบิลที่ยังเก็บไม่ครบ
        const pendingOrders = riderOrders.filter(o => !o.is_cash_collected || (o.cash_received || 0) < o.total_price);
        
        // บันทึกลงฐานข้อมูล
        for (const order of pendingOrders) {
          await supabase.from("orders").update({ is_cash_collected: true, cash_received: order.total_price }).eq("id", order.id);
        }
        toast.success(`เคลียร์ยอด ${riderName} ครบถ้วน!`);
      }
    });
  };

  const groupedOrders = orders.reduce((acc, order) => {
    const name = order.rider_name || "ไม่ระบุไรเดอร์";
    if (!acc[name]) acc[name] = [];
    acc[name].push(order);
    return acc;
  }, {} as Record<string, CashOrder[]>);

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-emerald-500" size={40} /></div>;

  const totalStorePending = orders.reduce((sum, o) => sum + (o.total_price - (o.cash_received || 0)), 0);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans pb-24">
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-white p-4 md:p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <Link href={`/board/${branchSlug}`} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors">
              <ArrowLeft className="text-slate-600" size={20} />
            </Link>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-2">
                <Banknote className="text-emerald-500" /> เคลียร์ยอดเงินสด
              </h1>
              <p className="text-xs font-bold text-slate-500 mt-0.5">ไรเดอร์นำส่งเงินคืนร้าน ประจำรอบวันนี้</p>
            </div>
          </div>
          <div className="bg-rose-50 border border-rose-200 px-4 py-3 rounded-2xl text-rose-700 flex flex-col items-end">
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">ยอดค้างทั้งหมด (ทุกไรเดอร์)</span>
            <span className="text-xl md:text-2xl font-black mt-1">฿{totalStorePending}</span>
          </div>
        </div>

        {/* List by Rider */}
        {Object.keys(groupedOrders).length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <Banknote size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-bold">ไม่มีบิลเงินสดที่ส่งสำเร็จในรอบวันนี้</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedOrders).map(([riderName, riderOrders]) => {
              const totalOrderPrice = riderOrders.reduce((sum, o) => sum + o.total_price, 0);
              const totalReceived = riderOrders.reduce((sum, o) => sum + (o.cash_received || 0), 0);
              const pendingAmount = totalOrderPrice - totalReceived;
              const allCollected = pendingAmount <= 0;

              return (
                <div key={riderName} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                  
                  {/* Rider Header */}
                  <div className={`p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b ${allCollected ? 'bg-slate-50 border-slate-200' : 'bg-emerald-50/30 border-emerald-100'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-black shadow-inner border ${allCollected ? 'bg-slate-200 text-slate-500 border-slate-300' : 'bg-emerald-100 text-emerald-600 border-emerald-200'}`}>
                        <User size={20} />
                      </div>
                      <div>
                        <h2 className="text-lg font-black text-slate-800">{riderName}</h2>
                        <p className="text-xs font-bold text-slate-500 flex items-center gap-1 mt-0.5">
                          <Receipt size={12}/> {riderOrders.length} บิล (ยอดรวม ฿{totalOrderPrice})
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto bg-white md:bg-transparent p-3 md:p-0 rounded-xl md:rounded-none border md:border-none border-slate-100">
                      <div className="text-left md:text-right">
                        <div className="text-[10px] uppercase font-black text-slate-400">ค้างส่งคืนร้าน</div>
                        <div className={`text-xl font-black ${allCollected ? 'text-slate-400' : 'text-rose-500'}`}>฿{pendingAmount}</div>
                      </div>
                      {!allCollected && (
                        <button onClick={() => markAllAsCollected(riderName, riderOrders)} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-sm shadow-md shadow-emerald-500/20 active:scale-95 transition-all">
                          เก็บครบทั้งหมด
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Orders List */}
                  <div className="divide-y divide-slate-100">
                    {riderOrders.map((order) => {
                      const received = order.cash_received || 0;
                      const remaining = order.total_price - received;
                      const isFullyPaid = remaining <= 0;
                      const isPartial = received > 0 && remaining > 0;

                      return (
                        <div 
                          key={order.id} 
                          onClick={() => handleUpdateCash(order)}
                          className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors ${isFullyPaid ? 'bg-slate-50/80' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <button className={`p-1 shrink-0 rounded-full transition-colors ${isFullyPaid ? 'text-emerald-500' : isPartial ? 'text-amber-500' : 'text-slate-300'}`}>
                              {isFullyPaid ? <CheckCircle2 size={28} /> : isPartial ? <AlertCircle size={28} className="fill-amber-100" /> : <Circle size={28} />}
                            </button>
                            <div>
                              <div className={`font-black text-base flex items-center gap-2 ${isFullyPaid ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                {order.order_number}
                              </div>
                              <div className="text-[11px] text-slate-500 font-bold mt-1 bg-slate-100 px-2 py-0.5 rounded-md inline-flex items-center gap-2">
                                <span>ยอดเต็ม: ฿{order.total_price}</span>
                                {received > 0 && <span className="text-emerald-600">รับแล้ว: ฿{received}</span>}
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right sm:ml-auto ml-11">
                            <div className={`text-lg font-black ${isFullyPaid ? 'text-slate-400' : 'text-rose-500'}`}>
                              {isFullyPaid ? 'เคลียร์แล้ว' : `ค้าง ฿${remaining}`}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                              ส่งเมื่อ {new Date(order.end_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}