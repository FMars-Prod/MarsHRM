
'use client';

import { useEffect } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { useFirebase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc } from 'firebase/firestore';

export function NotificationManager() {
    const { firebaseApp, firestore } = useFirebase();
    const { user } = useUser();
    const { toast } = useToast();

    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && firebaseApp) {
            const messaging = getMessaging(firebaseApp);

            // 1. Request Permission
            Notification.requestPermission().then((permission) => {
                if (permission === 'granted') {
                    console.log('Notification permission granted.');
                    
                    // 2. Get Token
                    getToken(messaging, { vapidKey: 'YOUR_VAPID_KEY_HERE' }) // IMPORTANT: Replace with your actual VAPID key
                        .then((currentToken) => {
                            if (currentToken && user) {
                                // 3. Save Token to Firestore
                                const userDocRef = doc(firestore, 'users', user.uid);
                                updateDoc(userDocRef, { fcmToken: currentToken });
                            } else {
                                console.log('No registration token available. Request permission to generate one.');
                            }
                        }).catch((err) => {
                            console.log('An error occurred while retrieving token. ', err);
                        });
                } else {
                    console.log('Unable to get permission to notify.');
                }
            });

            // 4. Handle Foreground Messages
            const unsubscribe = onMessage(messaging, (payload) => {
                console.log('Message received. ', payload);
                toast({
                    title: payload.notification?.title,
                    description: payload.notification?.body,
                });
            });

            return () => {
                unsubscribe();
            };
        }
    }, [firebaseApp, user, firestore, toast]);

    return null; // This component does not render anything
}
