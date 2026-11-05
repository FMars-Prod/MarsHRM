"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useFirestore, useDoc, useMemoFirebase, setDocumentNonBlocking } from "@/firebase";
import { doc, serverTimestamp } from "firebase/firestore";

interface BrandingContextType {
  hideFortuMarsBranding: boolean;
  isLoading: boolean;
  setHideFortuMarsBranding: (hide: boolean) => Promise<void>;
}

const LOCAL_STORAGE_KEY = "marshrm_hide_fortumars_branding";

const BrandingContext = createContext<BrandingContextType>({
  hideFortuMarsBranding: false,
  isLoading: false,
  setHideFortuMarsBranding: async () => {},
});

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const firestore = useFirestore();
  const configRef = useMemoFirebase(() => (firestore ? doc(firestore, "settings", "branding") : null), [firestore]);
  const { data: brandingData, isLoading } = useDoc<any>(configRef);

  // Initialize from localStorage if present so there is no flicker on page load or on public pages
  const [localOverride, setLocalOverride] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored !== null) return stored === "true";
    }
    return false;
  });

  // Sync when Firestore data loads or updates
  useEffect(() => {
    if (brandingData !== undefined) {
      const val = !!brandingData?.hideFortuMarsBranding;
      setLocalOverride(val);
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_STORAGE_KEY, String(val));
      }
    }
  }, [brandingData]);

  const setHideFortuMarsBranding = async (hide: boolean) => {
    // 1. Immediately update local state & localStorage for instantaneous UI reaction across the entire app
    setLocalOverride(hide);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_KEY, String(hide));
    }

    // 2. Persist to Firestore settings/branding
    if (firestore && configRef) {
      await setDocumentNonBlocking(
        configRef,
        {
          hideFortuMarsBranding: hide,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  };

  const hideFortuMarsBranding = brandingData !== undefined ? !!brandingData?.hideFortuMarsBranding : localOverride;

  return (
    <BrandingContext.Provider value={{ hideFortuMarsBranding, isLoading, setHideFortuMarsBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}


