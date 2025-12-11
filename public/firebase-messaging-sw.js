
// This service worker file is intentionally left almost empty.
// Firebase's messaging SDK will handle the background message notifications automatically.

// Scripts for Firebase products are imported on-demand.
importScripts("https://www.gstatic.com/firebasejs/11.9.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.9.1/firebase-messaging-compat.js");

// Initialize the Firebase app in the service worker
// Be sure to replace the config values with your own
firebase.initializeApp({
  apiKey: "AIzaSyClDJe_JQTQbC34Bp4pJlEqBTW2HUEDcBA",
  authDomain: "studio-6661404512-7e22c.firebaseapp.com",
  projectId: "studio-6661404512-7e22c",
  storageBucket: "studio-6661404512-7e22c.appspot.com",
  messagingSenderId: "1071692184412",
  appId: "1:1071692184412:web:f3f26c05d0723501a2df99",
  measurementId: ""
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/firebase-logo.png' // Make sure you have this icon in your public folder
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
