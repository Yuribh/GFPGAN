// Where a vehicle goes after it is chosen for a tool (comparison, sale card, report).
import { router } from 'expo-router';
import { compareList } from '../storage.ts';

export type Tool = 'compare' | 'card' | 'report';
export const isTool = (v: unknown): v is Tool => v === 'compare' || v === 'card' || v === 'report';

export const TOOL_TITLE: Record<Tool, string> = {
  compare: 'Adicionar à comparação',
  card: 'Card de venda',
  report: 'Relatório de preço',
};

export async function openTool(tool: Tool, modelYearId: string): Promise<void> {
  const id = encodeURIComponent(modelYearId);
  if (tool === 'compare') {
    await compareList.add(modelYearId);
    router.dismissTo('/compare');          // back to the comparison, closing the chooser and the picker
  } else if (tool === 'card') {
    router.replace(`/sale-card?id=${id}`);
  } else {
    router.replace(`/report?id=${id}`);
  }
}
