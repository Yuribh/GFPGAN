// PDF report and image sharing. Native: file + share sheet. Web: print dialog / text share.
import { Platform, Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { VehicleResult } from '../data/types.ts';
import { usingSampleData } from '../data/index.ts';
import { buildReportHtml } from '../logic/report.ts';
import { reportError } from './monitoring.ts';

export async function shareReportPdf(v: VehicleResult): Promise<boolean> {
  const html = buildReportHtml(v, new Date(), { sample: usingSampleData });
  try {
    if (Platform.OS === 'web') { await Print.printAsync({ html }); return true; }
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Relatório de preço' });
    } else {
      await Print.printAsync({ uri });
    }
    return true;
  } catch (e) {
    reportError(e);
    return false;
  }
}

export async function printReport(v: VehicleResult): Promise<boolean> {
  try { await Print.printAsync({ html: buildReportHtml(v, new Date(), { sample: usingSampleData }) }); return true; }
  catch (e) { reportError(e); return false; }
}

/** Shares a PNG file; falls back to text where files cannot be shared (web). */
export async function shareImage(uri: string | null, fallbackText: string): Promise<void> {
  try {
    if (uri && Platform.OS !== 'web' && await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Card de venda' });
      return;
    }
  } catch (e) { reportError(e); }
  await Share.share({ message: fallbackText }).catch(() => {});
}
