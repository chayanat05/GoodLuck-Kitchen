importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// ใส่ค่าให้ครบจาก Firebase Console
firebase.initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
});

const messaging = firebase.messaging();

// ฟังก์ชันเมื่อได้รับข้อความตอนที่แอปปิดอยู่ (Background)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const notificationTitle = payload.notification?.title || "มีแจ้งเตือนใหม่";
  const notificationOptions = {
    body: payload.notification?.body || "ตรวจสอบที่หน้าเว็บนะครับ",
    icon: '/riderlogo_192x192.png',
    // เพิ่มคลิกแล้วให้เปิดหน้าเว็บ
    data: { url: payload.fcmOptions?.link || '/' }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// ฟังก์ชันเมื่อกดที่แจ้งเตือน (เปิดหน้าเว็บตาม URL ที่ส่งมา)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data.url;
  
  event.waitUntil(
    clients.openWindow(url)
  );
});