// src/hooks/useFCM.ts
'use client';
import { useEffect } from 'react';
import { messaging } from '@/lib/firebase';
import { getToken } from 'firebase/messaging';
import { supabase } from '@/lib/supabase';

export const useFCM = () => {
  useEffect(() => {
    const requestNotificationPermission = async () => {
      try {
        // เช็คว่า Browser รองรับ Notification หรือไม่
        if (!('Notification' in window)) {
          console.warn('เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน');
          return;
        }

        // ขอสิทธิ์ผู้ใช้
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
          // ดึงข้อมูล User ปัจจุบันที่ล็อกอินอยู่
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;

          // สร้าง/ดึง Token ของเครื่องนี้
          if (messaging) {
            const currentToken = await getToken(messaging, {
              vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
            });

            if (currentToken) {
              console.log('ได้ Token เครื่องนี้แล้ว:', currentToken);
              
              // บันทึก Token ลงตาราง profiles ของ Supabase
              const { error } = await supabase
                .from('profiles')
                .update({ fcm_token: currentToken })
                .eq('id', session.user.id);
                
              if (error) {
                console.error('บันทึก Token ลงฐานข้อมูลไม่สำเร็จ:', error);
              }
            }
          }
        } else {
          console.log('ผู้ใช้ไม่อนุญาตให้ส่งการแจ้งเตือน');
        }
      } catch (error) {
        console.error('เกิดข้อผิดพลาดในการตั้งค่าแจ้งเตือน:', error);
      }
    };

    requestNotificationPermission();
  }, []);
};