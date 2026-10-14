// Parsers for the FIPE API's text formats. Shapes from https://fipe.api.br/docs/api/fipe (read 2026-10-13).

const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, 'março': 3, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

/** "R$ 10.000,00" -> 1000000 (cents). Integer math only. */
export function parsePriceToCents(text: string): number {
  const m = /^\s*R\$\s*([\d.]+),(\d{2})\s*$/.exec(text);
  if (!m) throw new Error(`unrecognised price: ${JSON.stringify(text)}`);
  return Number(m[1].replace(/\./g, '')) * 100 + Number(m[2]);
}

/** "outubro/2026" (what /references returns, seen 2026-10-14) or "abril de 2024" (vehicle answers) -> { year, month } */
export function parseReferenceMonth(text: string): { year: number; month: number } {
  const m = /^\s*([a-zç]+)\s*(?:\/|\s+de\s+)\s*(\d{4})\s*$/i.exec(text);
  const month = m ? MONTHS[m[1].toLowerCase()] : undefined;
  if (!m || !month) throw new Error(`unrecognised reference month: ${JSON.stringify(text)}`);
  return { year: Number(m[2]), month };
}

/** "2022-3" -> { modelYear: 2022, fuelCode: 3 }. 32000 is FIPE's label for zero km. */
export function parseYearCode(code: string): { modelYear: number; fuelCode: number } {
  const m = /^(\d{4,5})-(\d+)$/.exec(code);
  if (!m) throw new Error(`unrecognised year code: ${JSON.stringify(code)}`);
  return { modelYear: Number(m[1]), fuelCode: Number(m[2]) };
}
