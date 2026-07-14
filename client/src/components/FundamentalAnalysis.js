import React from 'react';

const isNum = (v) => v !== null && v !== undefined && !isNaN(v);
const fmt = (v, d = 2) => (isNum(v) ? Number(v).toFixed(d) : 'N/A');

const peVerdictText = {
  CHEAPER_THAN_SECTOR: 'cheaper than peers',
  IN_LINE_WITH_SECTOR: 'in line with peers',
  PRICIER_THAN_SECTOR: 'pricier than peers',
};
const deVerdictText = {
  HEALTHY_FOR_SECTOR: 'healthy for the sector',
  HIGH_FOR_SECTOR: 'high for the sector',
};

const IndustryComparison = ({ ic }) => {
  if (!ic) return null;
  const rows = [];

  const pe = ic.peRatio;
  if (pe && isNum(pe.value) && pe.verdict && pe.verdict !== 'NO_DATA') {
    const range = Array.isArray(pe.sectorRange) ? `${pe.sectorRange[0]}–${pe.sectorRange[1]}` : null;
    rows.push(
      <div className="metric" key="pe">
        <span>P/E {fmt(pe.value, 1)}{range ? ` vs sector range ${range}` : ''}</span>
        <span className={pe.verdict === 'CHEAPER_THAN_SECTOR' ? 'positive' : pe.verdict === 'PRICIER_THAN_SECTOR' ? 'negative' : 'neutral'}>
          {peVerdictText[pe.verdict] || pe.verdict}
        </span>
      </div>
    );
  }

  const peg = ic.pegRatio;
  if (peg && isNum(peg.value)) {
    const target = Array.isArray(peg.sectorTarget) ? `${peg.sectorTarget[0]}–${peg.sectorTarget[1]}` : null;
    rows.push(
      <div className="metric" key="peg">
        <span>PEG {fmt(peg.value, 2)}{target ? ` vs sector target ${target}` : ''}</span>
        <span className={peg.value < 1 ? 'positive' : peg.value < 2 ? 'neutral' : 'negative'}>
          {peg.value < 1 ? 'attractive' : peg.value < 2 ? 'fair' : 'expensive'}
        </span>
      </div>
    );
  }

  const de = ic.debtToEquity;
  if (de && isNum(de.value) && de.verdict) {
    rows.push(
      <div className="metric" key="de">
        <span>Debt/Equity {fmt(de.value, 2)}{isNum(de.sectorMax) ? ` (sector max ${de.sectorMax})` : ''}</span>
        <span className={de.verdict === 'HEALTHY_FOR_SECTOR' ? 'positive' : 'negative'}>
          {deVerdictText[de.verdict] || de.verdict}
        </span>
      </div>
    );
  }

  if (rows.length === 0) return null;

  return (
    <div className="metric-group">
      <h4>Compared to industry{ic.sector ? ` (${ic.sector})` : ''}</h4>
      {rows}
    </div>
  );
};

const FundamentalAnalysis = ({ data }) => {
  if (!data) return <div>No fundamental data available</div>;

  const { peRatio, pegRatio, priceToBook, debtToEquity, currentRatio, roe, roa, profitMargin, roce, efficiency, scores = {}, industryComparison } = data;

  return (
    <div className="analysis-panel">
      <h3>Fundamental Analysis</h3>
      <p className="explainer">P/E = price ÷ yearly profit per share. Lower usually means cheaper vs peers.</p>
      <div className="metrics-grid">
        {/* Valuation Metrics */}
        <div className="metric-group">
          <h4>Valuation</h4>
          <div className="metric">
            <span>P/E Ratio (TTM):</span>
            <span>{fmt(peRatio && peRatio.trailing)}</span>
          </div>
          <div className="metric">
            <span>P/E Ratio (Forward):</span>
            <span>{fmt(peRatio && peRatio.forward)}</span>
          </div>
          <div className="metric">
            <span>PEG Ratio:</span>
            <span className={pegRatio && pegRatio.value < 1 ? 'positive' : pegRatio && pegRatio.value < 2 ? 'neutral' : 'negative'}>
              {fmt(pegRatio && pegRatio.value)}
            </span>
          </div>
          <div className="metric">
            <span>P/B Ratio:</span>
            <span>{fmt(priceToBook)}</span>
          </div>
        </div>

        {/* Profitability Metrics */}
        <div className="metric-group">
          <h4>Profitability</h4>
          <div className="metric">
            <span>ROE:</span>
            <span className={roe > 15 ? 'positive' : roe > 10 ? 'neutral' : 'negative'}>
              {fmt(roe)}%
            </span>
          </div>
          <div className="metric">
            <span>ROA:</span>
            <span className={roa > 10 ? 'positive' : roa > 5 ? 'neutral' : 'negative'}>
              {fmt(roa)}%
            </span>
          </div>
          <div className="metric">
            <span>Profit Margin:</span>
            <span className={profitMargin > 15 ? 'positive' : profitMargin > 5 ? 'neutral' : 'negative'}>
              {fmt(profitMargin)}%
            </span>
          </div>
          {roce && isNum(roce.value) && roce.value > 0 && (
            <div className="metric">
              <span>ROCE:</span>
              <span className={roce.value > 18 ? 'positive' : roce.value > 10 ? 'neutral' : 'negative'}>
                {fmt(roce.value)}% ({roce.interpretation})
              </span>
            </div>
          )}
        </div>

        {/* Financial Health Metrics */}
        <div className="metric-group">
          <h4>Financial Health</h4>
          <div className="metric">
            <span>Debt/Equity:</span>
            <span className={debtToEquity < 0.5 ? 'positive' : debtToEquity < 1.0 ? 'neutral' : 'negative'}>
              {fmt(debtToEquity)}
            </span>
          </div>
          <div className="metric">
            <span>Current Ratio:</span>
            <span className={currentRatio > 1.5 ? 'positive' : currentRatio > 1.0 ? 'neutral' : 'negative'}>
              {fmt(currentRatio)}
            </span>
          </div>
          {efficiency && efficiency.debtorDays != null && (
            <div className="metric">
              <span>Debtor Days:</span>
              <span>{efficiency.debtorDays}</span>
            </div>
          )}
          {efficiency && efficiency.cashConversionCycle != null && (
            <div className="metric">
              <span>Cash Conversion Cycle (days):</span>
              <span>{efficiency.cashConversionCycle}</span>
            </div>
          )}
          {efficiency && efficiency.workingCapitalDays != null && (
            <div className="metric">
              <span>Working Capital Days:</span>
              <span>{efficiency.workingCapitalDays}</span>
            </div>
          )}
        </div>

        {/* Compared to industry */}
        <IndustryComparison ic={industryComparison} />

        {/* Scores */}
        <div className="metric-group">
          <h4>Category Scores</h4>
          <div className="metric">
            <span>Valuation:</span>
            <span className={scores.valuation >= 70 ? 'positive' : scores.valuation >= 40 ? 'neutral' : 'negative'}>
              {isNum(scores.valuation) ? scores.valuation : 'N/A'}/100
            </span>
          </div>
          <div className="metric">
            <span>Profitability:</span>
            <span className={scores.profitability >= 70 ? 'positive' : scores.profitability >= 40 ? 'neutral' : 'negative'}>
              {isNum(scores.profitability) ? scores.profitability : 'N/A'}/100
            </span>
          </div>
          <div className="metric">
            <span>Financial Health:</span>
            <span className={scores.financialHealth >= 70 ? 'positive' : scores.financialHealth >= 40 ? 'neutral' : 'negative'}>
              {isNum(scores.financialHealth) ? scores.financialHealth : 'N/A'}/100
            </span>
          </div>
          <div className="metric">
            <span>Growth:</span>
            <span className={scores.growth >= 70 ? 'positive' : scores.growth >= 40 ? 'neutral' : 'negative'}>
              {isNum(scores.growth) ? scores.growth : 'N/A'}/100
            </span>
          </div>
        </div>
      </div>

      <div className="summary">
        <h4>Overall Fundamental Score: <span>{isNum(scores.valuation) && isNum(scores.profitability) && isNum(scores.financialHealth) && isNum(scores.growth) ?
          Math.round((scores.valuation + scores.profitability + scores.financialHealth + scores.growth) / 4) : 'N/A'}</span>/100</h4>
      </div>
    </div>
  );
};

export default FundamentalAnalysis;
