const { buildProjection, buildMoat, sectorOutlook, YEARS } = require('../server/services/projectionMoat');

const stockData = {
  priceData: { current: 1000 },
  epsGrowth: { yoy: 12 },
  revenueGrowth: { yoy: -5 },
  targetMeanPrice: 1150,
  roe: 22, roce: 30, profitMargin: 16, debtToEquity: 0.1,
  sector: 'IT_Services',
};
const finviz = { success: true, analystTarget: 1200, epsGrowthNextY: 10, epsGrowthNext5Y: 11, source: 'https://finviz.com/quote.ashx?t=X' };

describe('buildProjection', () => {
  const p = buildProjection(stockData, finviz);

  test('base-case median row comes first, one row per scenario', () => {
    expect(p.scenarios).toHaveLength(7); // base + eps + rev + yahoo + 3 finviz
    expect(p.scenarios[0].label).toMatch(/^★ Base case/);
  });

  test('every scenario has a price per projection year and a why/source', () => {
    for (const s of p.scenarios) {
      expect(s.prices).toHaveLength(YEARS.length);
      expect(s.why).toBeTruthy();
      expect(s.source).toBeTruthy();
    }
    expect(p.years).toEqual([1, 2, 3, 4, 5, 10]);
  });

  test('negative growth projects a declining price path', () => {
    const neg = p.scenarios.find((s) => s.growthPct < 0);
    expect(neg).toBeDefined();
    expect(neg.prices[YEARS.length - 1]).toBeLessThan(stockData.priceData.current);
  });

  test('returns null without price or scenarios', () => {
    expect(buildProjection({ priceData: { current: 0 } }, null)).toBeNull();
    expect(buildProjection({ priceData: { current: 100 } }, null)).toBeNull();
  });
});

describe('buildMoat', () => {
  test('wide moat when all checks pass (incl. roce + promoter)', () => {
    const m = buildMoat(stockData, { percentages: { promoter: 55 } });
    expect(m.total).toBe(5);
    expect(m.passed).toBe(5);
    expect(m.verdict).toBe('WIDE');
  });

  test('skips roce/promoter checks when data missing, verdict degrades', () => {
    const m = buildMoat({ roe: 5, profitMargin: 2, debtToEquity: 2 }, null);
    expect(m.total).toBe(3);
    expect(m.passed).toBe(0);
    expect(m.verdict).toBe('NONE');
  });
});

describe('sectorOutlook', () => {
  test('known canonical sector and default fallback', () => {
    expect(sectorOutlook('IT_Services').cagr).toBe('8–10%');
    expect(sectorOutlook('NoSuchSector')).toEqual(sectorOutlook('default'));
  });
});
