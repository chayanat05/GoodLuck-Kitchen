importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// ใส่ค่าให้ครบจาก Firebase Console
firebase.initializeApp({
  apiKey: "AIzaSyCyAxnYD36ETjr-eYquvvJNOX2IdRaUKJg",
  authDomain: "goodluck-kitchen.firebaseapp.com",
  projectId: "goodluck-kitchen",
  storageBucket: "goodluck-kitchen.firebasestorage.app",
  messagingSenderId: "859897989366",
  appId: "1:859897989366:web:93358979409815dd12c4d7"
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