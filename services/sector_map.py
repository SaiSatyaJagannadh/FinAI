"""
Canonical sector mapping.

The Node fundamental-analysis benchmarks
(server/services/fundamentalAnalysis.js `sectorBenchmarks`) are keyed by a
fixed set of canonical sector names: IT_Services, Banking, Pharma, FMCG,
Auto, Energy, Telecom, Construction (plus `default`).

yfinance and Screener.in return human-readable sector strings
("Technology Services", "Financial Services", ...) that never match these
keys, so the benchmark lookup always falls through to `default` and the
valuation score uses the wrong PE/PEG range.

This module maps those free-form strings to the canonical keys so the
fundamental analysis uses the correct benchmarks.
"""

# Canonical keys must match server/services/fundamentalAnalysis.js sectorBenchmarks.
# Anything unmapped returns "default".
_SECTOR_ALIASES = {
    "IT_Services": [
        "it", "it services", "it-software", "information technology",
        "technology", "software", "software & services", "technology services",
        "computers - software", "it - software", "software & it",
    ],
    "Banking": [
        "banking", "bank", "banks", "financial services", "finance",
        "finance (nbfc)", "nbfc", "financial", "financials",
        "banks - private sector", "banks - public sector", "diversified financials",
    ],
    "Pharma": [
        "pharma", "pharmaceuticals", "pharmaceuticals & drugs", "pharma & healthcare",
        "healthcare", "drugs", "drugs & pharma", "healthcare & drugs",
        "pharmaceuticals and drugs", "pharma and diagnostics",
    ],
    "FMCG": [
        "fmcg", "consumer goods", "consumer defensive", "consumer defensive sector",
        "consumer staples", "packaged foods", "consumer goods - fmcg",
        "personal products", "packaged consumer goods", "diversified consumer",
    ],
    "Auto": [
        "auto", "automobile", "automobile sector", "automobile & ancillaries",
        "automobile and ancillaries", "automobiles", "auto ancillary",
        "consumer discretionary", "two wheelers", "commercial vehicles",
        "passenger vehicles", "auto - cars and light vehicles",
    ],
    "Energy": [
        "energy", "oil & gas", "oil and gas", "oil gas and refining",
        "refineries", "refineries, energy", "power", "power generation",
        "diversified energy", "energy - oil & gas operations", "coal",
        "oil & gas operations",
    ],
    "Telecom": [
        "telecom", "telecom services", "telecommunications", "telecommunications services",
        "telecommunication services", "communication",
    ],
    "Construction": [
        "construction", "construction & engineering", "construction & contracting",
        "infra", "infrastructure", "infrastructure & construction",
        "cement & construction", "cement", "engineering",
    ],
    "Metals": [
        "metals", "metal", "metals & mining", "mining", "steel", "iron & steel",
        "aluminium", "aluminum", "metal fabrication", "non ferrous metals",
        "basic materials",
    ],
    "Chemicals": [
        "chemicals", "chemical", "specialty chemicals", "speciality chemicals",
        "fertilizers", "fertilisers", "agrochemicals", "commodity chemicals",
    ],
    "Industrials": [
        "industrials", "industrial", "capital goods", "industrial products",
        "manufacturing", "machinery", "electrical equipment", "conglomerates",
    ],
}


def normalize_sector(text):
    """Map a free-form sector string to a canonical benchmark key."""
    if not text:
        return "default"
    t = str(text).strip().lower()
    if not t:
        return "default"

    # Exact membership test against each alias group.
    for canonical, aliases in _SECTOR_ALIASES.items():
        for a in aliases:
            if t == a:
                return canonical

    # Substring fallback: if any alias appears inside the text, use it.
    for canonical, aliases in _SECTOR_ALIASES.items():
        for a in aliases:
            if a in t:
                return canonical

    return "default"
