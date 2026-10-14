// Régua Plus (no ads) through RevenueCat. Prices always come from the store at purchase time, never from the code.
// Off when there is no RevenueCat key for the platform, on the web and in Expo Go: then everyone is on the free plan.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Linking, Platform } from 'react-native';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { isExpoGo, isNative } from './runtime.ts';
import { reportError } from './monitoring.ts';
import { track } from './track.ts';

export const ENTITLEMENT = 'plus';
const apiKey = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
  : Platform.OS === 'android' ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY : undefined;
export const plusAvailable = Boolean(apiKey) && isNative && !isExpoGo;

// loaded only when usable, so Expo Go and the web never touch the native module
type PurchasesModule = typeof import('react-native-purchases');
const RC: PurchasesModule | null = plusAvailable ? require('react-native-purchases') : null;

export interface PlusOption { id: string; label: string; price: string; note?: string }
export type PurchaseOutcome = 'purchased' | 'cancelled' | 'failed';

interface PlusState {
  available: boolean;
  isPlus: boolean;
  /** true until the first answer from the store (ads wait for it, so a subscriber never sees a flash of ad) */
  checking: boolean;
  options: PlusOption[] | null;
  loadOptions(): Promise<void>;
  purchase(id: string): Promise<PurchaseOutcome>;
  restore(): Promise<boolean>;
  manage(): Promise<void>;
  /** RevenueCat's anonymous id for this install, so the server can check Plus itself (plate lookup limits) */
  appUserId(): Promise<string | undefined>;
}

const Ctx = createContext<PlusState | null>(null);
const hasPlus = (info: CustomerInfo) => Boolean(info.entitlements.active[ENTITLEMENT]);

function labelFor(p: PurchasesPackage): { label: string; note?: string } {
  switch (String(p.packageType)) {
    case 'ANNUAL': return { label: 'Anual', note: 'Cobrança uma vez por ano. Aviso antes de renovar.' };
    case 'MONTHLY': return { label: 'Mensal', note: 'Cobrança todo mês.' };
    default: return { label: p.product.title || p.identifier };
  }
}

export function PlusProvider({ children }: { children: ReactNode }) {
  const [isPlus, setIsPlus] = useState(false);
  const [checking, setChecking] = useState(plusAvailable);
  const [packages, setPackages] = useState<PurchasesPackage[] | null>(null);

  useEffect(() => {
    if (!RC) return;
    const Purchases = RC.default;
    const onInfo = (info: CustomerInfo) => setIsPlus(hasPlus(info));
    try {
      Purchases.configure({ apiKey: apiKey! });
      Purchases.addCustomerInfoUpdateListener(onInfo);
      Purchases.getCustomerInfo().then(onInfo, reportError).finally(() => setChecking(false));
    } catch (e) {
      reportError(e);
      setChecking(false);
    }
    return () => { Purchases.removeCustomerInfoUpdateListener(onInfo); };
  }, []);

  const loadOptions = useCallback(async () => {
    if (!RC) { setPackages([]); return; }
    try {
      const offerings = await RC.default.getOfferings();
      setPackages(offerings.current?.availablePackages ?? []);
    } catch (e) {
      reportError(e);
      setPackages([]);
    }
  }, []);

  const purchase = useCallback(async (id: string): Promise<PurchaseOutcome> => {
    const pkg = packages?.find(p => p.identifier === id);
    if (!RC || !pkg) return 'failed';
    try {
      const { customerInfo } = await RC.default.purchasePackage(pkg);
      const ok = hasPlus(customerInfo);
      setIsPlus(ok);
      if (ok) track('plus_purchased');
      return ok ? 'purchased' : 'failed';
    } catch (e) {
      if ((e as { userCancelled?: boolean }).userCancelled) return 'cancelled';
      reportError(e);
      return 'failed';
    }
  }, [packages]);

  const restore = useCallback(async () => {
    if (!RC) return false;
    try {
      const ok = hasPlus(await RC.default.restorePurchases());
      setIsPlus(ok);
      return ok;
    } catch (e) {
      reportError(e);
      return false;
    }
  }, []);

  // cancel or change plan in the store's own screen (one tap from the app, no email to write)
  const manage = useCallback(async () => {
    try {
      if (RC) { await RC.default.showManageSubscriptions(); return; }
    } catch (e) { reportError(e); }
    await Linking.openURL(Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions');
  }, []);

  const appUserId = useCallback(async () => {
    if (!RC) return undefined;
    try { return await RC.default.getAppUserID(); } catch { return undefined; }
  }, []);

  const options = useMemo(() => packages?.map(p => ({ id: p.identifier, price: p.product.priceString, ...labelFor(p) })) ?? null, [packages]);
  const value = useMemo<PlusState>(() => ({
    available: plusAvailable, isPlus, checking, options, loadOptions, purchase, restore, manage, appUserId,
  }), [isPlus, checking, options, loadOptions, purchase, restore, manage, appUserId]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlus(): PlusState {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePlus must be used inside PlusProvider');
  return v;
}
