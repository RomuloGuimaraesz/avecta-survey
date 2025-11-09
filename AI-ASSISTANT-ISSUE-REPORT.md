# Executive Report: AI Assistant Query Classification Issue

**Date:** Generated on analysis  
**Issue:** Query "Mostrar análise de satisfação" incorrectly classified as name search  
**Severity:** High - Core functionality broken  
**Confidence:** 70% (as reported in system)

---

## Executive Summary

The AI Assistant is incorrectly classifying the query **"Mostrar análise de satisfação"** (Show satisfaction analysis) as a **name search query** instead of a **satisfaction analysis query**. This causes the system to search for residents named "análise satisfação" in the database, find no matches, and return the error message: *"Não encontrei registros para 'análise satisfação' no banco de dados municipal."*

**Root Cause:** The name search detection algorithm is too aggressive and treats analysis-related terms ("análise", "satisfação") as potential person names when combined with display verbs like "mostrar" (show).

---

## Technical Analysis

### Issue Flow

1. **Query Received:** "Mostrar análise de satisfação"
2. **Query Analyzer Processing:**
   - Detects "mostrar" (show) as a name search verb
   - Extracts "análise" and "satisfação" as "name-like words" (≥2 chars, contains letters)
   - **Incorrectly classifies as name search** instead of analysis query
3. **Knowledge Agent Processing:**
   - Routes to name search logic
   - Searches database for residents named "análise satisfação"
   - Finds no matches
4. **Error Response:** Returns "not found" message from `knowledgeAgent.js:250`

### Code Locations

#### Primary Issue: QueryAnalyzer.js (Lines 201-220)

```javascript
// CRITICAL: Name search detection (highest priority)
const nameSearchVerbs = ['encontre', 'encontrar', 'encontra', 'busque', 'buscar', 'busca', 'find', 'search', 'procure', 'procurar', 'procura', 'mostre', 'mostrar', 'mostra', 'show', 'exiba', 'exibir', 'traga', 'trazer', 'quem e', 'quem eh'];
const hasNameSearchVerb = nameSearchVerbs.some(t => qn.includes(t));

if (hasNameSearchVerb) {
  // Check if there are words that look like names (not just common words)
  const commonWords = ['o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'the', 'a', 'an'];
  const words = query.split(/\s+/).filter(w => {
    const normalized = normalize(w);
    return !commonWords.includes(normalized) && !nameSearchVerbs.includes(normalized);
  });
  const nameLikeWords = words.filter(w => w.length >= 2 && /[a-záàâãéèêíìîóòôõúùûç]/i.test(w));
  
  if (nameLikeWords.length >= 1) {
    analysis.primaryIntent = 'knowledge';
    analysis.queryType = 'listing';
    analysis.dataNeeds.push('name_search');
    return analysis;  // ⚠️ EXITS EARLY - prevents analysis query detection
  }
}
```

**Problem:** The algorithm exits early when it finds a search verb + any name-like words, without checking if those words are actually analysis-related terms.

#### Secondary Issue: ResidentFilterService.js (Lines 172-201)

Similar logic in `isNameSearchQuery()` method also incorrectly identifies analysis queries as name searches.

#### Missing Logic: Analysis Query Detection

The system has `determineAnalysisType()` in `knowledgeAgent.js:383` that correctly identifies satisfaction analysis queries:

```javascript
if (queryLower.includes('satisfaction') || queryLower.includes('satisf')) {
  return 'satisfaction';
}
```

However, this method is **never called** when the query is incorrectly classified as a name search, because the name search detection happens **earlier** in the pipeline and exits early.

---

## Root Causes Identified

### 1. **Priority Order Issue**
- Name search detection runs **before** analysis query detection
- Early exit prevents proper analysis query classification
- **Location:** `QueryAnalyzer.js:201-220`

### 2. **Insufficient Keyword Blacklist**
- Analysis-related terms not excluded from name search detection
- Terms like "análise", "satisfação", "relatório", "estatística" should be blacklisted
- **Location:** `QueryAnalyzer.js:207` (commonWords array)

### 3. **Overly Permissive Name Detection**
- Any word ≥2 chars with letters is considered "name-like"
- No semantic understanding of analysis vs. person names
- **Location:** `QueryAnalyzer.js:212`

### 4. **Missing Analysis Query Pre-Check**
- No pre-check for analysis keywords before name search detection
- Should check for "análise", "analysis", "relatório", "report", etc. first
- **Location:** `QueryAnalyzer.js` (missing before line 201)

---

## Impact Assessment

### Affected Queries
Any query containing:
- Display verbs: "mostrar", "mostre", "exibir", "show", "listar", "list"
- Analysis terms: "análise", "satisfação", "relatório", "estatística", "report", "analysis"

**Examples of broken queries:**
- "Mostrar análise de satisfação" ❌
- "Exibir relatório de satisfação" ❌
- "Listar análise de bairros" ❌
- "Mostrar estatísticas" ❌

### User Experience Impact
- **High:** Core functionality (satisfaction analysis) is broken
- Users cannot access satisfaction analysis reports
- System returns confusing "not found" messages
- Confidence level (70%) suggests uncertainty in classification

### Data Availability
- Satisfaction data **is available** in the database
- The `MunicipalAnalysisEngine` can process satisfaction analysis
- The issue is purely in query classification, not data access

---

## Recommended Solutions

### Solution 1: Add Analysis Query Pre-Check (Recommended)
**Priority:** High  
**Effort:** Low  
**Impact:** High

Add analysis keyword detection **before** name search detection in `QueryAnalyzer.js`:

```javascript
// Step 0.25: Pre-check for analysis/report queries
const analysisKeywords = [
  'análise', 'analysis', 'relatório', 'report', 'estatística', 'statistics',
  'satisfação', 'satisfaction', 'engajamento', 'engagement', 'bairro', 'neighborhood',
  'resumo', 'summary', 'overview', 'visão', 'view'
];
const hasAnalysisKeyword = analysisKeywords.some(kw => qn.includes(kw));
const hasDisplayVerb = ['mostrar', 'mostre', 'exibir', 'exiba', 'show', 'listar', 'lista', 'list', 'display'].some(v => qn.includes(v));

if (hasAnalysisKeyword && hasDisplayVerb) {
  // This is an analysis query, not a name search
  const heuristicAnalysis = this.analyzeQueryHeuristically(query);
  heuristicAnalysis.primaryIntent = 'knowledge';
  heuristicAnalysis.queryType = 'analysis';
  return {
    scope: { inScope: true, confidence: 0.95, categories: ['survey'], reason: 'Analysis query detected' },
    intent: 'knowledge',
    queryType: 'analysis',
    dataNeeds: heuristicAnalysis.dataNeeds,
    urgency: 'normal',
    blocked: false
  };
}
```

### Solution 2: Expand Common Words Blacklist
**Priority:** Medium  
**Effort:** Low  
**Impact:** Medium

Add analysis terms to the `commonWords` array in name search detection:

```javascript
const commonWords = [
  'o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na',
  'the', 'a', 'an',
  // Add analysis terms
  'análise', 'analysis', 'relatório', 'report', 'estatística', 'statistics',
  'satisfação', 'satisfaction', 'engajamento', 'engagement'
];
```

### Solution 3: Improve Name Search Detection Logic
**Priority:** Medium  
**Effort:** Medium  
**Impact:** Medium

Enhance name search detection to require:
- Search verb + name-like words
- **AND** name-like words must NOT be analysis keywords
- **AND** name-like words should have characteristics of person names (capitalization patterns, length, etc.)

### Solution 4: Add Semantic Context Check
**Priority:** Low  
**Effort:** High  
**Impact:** High

Use LLM-based classification to distinguish between:
- "Show me analysis of satisfaction" (analysis query)
- "Show me John Smith" (name search)

This would require calling the scope classifier earlier or adding a dedicated classification step.

---

## Implementation Priority

1. **Immediate (Solution 1):** Add analysis query pre-check - fixes the issue immediately
2. **Short-term (Solution 2):** Expand blacklist - prevents similar issues
3. **Medium-term (Solution 3):** Improve name detection - better accuracy
4. **Long-term (Solution 4):** Semantic classification - most robust solution

---

## Testing Recommendations

After implementing fixes, test with:

1. **Positive Cases (should work):**
   - "Mostrar análise de satisfação"
   - "Exibir relatório de satisfação"
   - "Análise de bairros"
   - "Mostrar estatísticas"

2. **Negative Cases (should still work as name searches):**
   - "Mostrar João Silva"
   - "Encontrar Maria Santos"
   - "Buscar Pedro Oliveira"

3. **Edge Cases:**
   - "Mostrar análise do João" (ambiguous - could be analysis about João or show João's analysis)
   - "Análise de satisfação do bairro Centro" (should be analysis, not name search)

---

## Additional Findings

### System Architecture
- Query processing follows: `QueryAnalyzer` → `Orchestrator` → `Knowledge Agent`
- Name search detection happens at the `QueryAnalyzer` level
- Analysis type detection happens at the `Knowledge Agent` level
- **Gap:** Analysis detection never runs if name search is detected first

### Data Flow
- Data is available: `IntelligentDataProcessor` can generate satisfaction statistics
- `MunicipalAnalysisEngine` has `analyzeSatisfaction()` method
- Issue is in routing/classification, not data processing

### Confidence Score
- 70% confidence suggests the system is uncertain about the classification
- This is a red flag that should trigger additional validation

---

## Conclusion

The issue is a **query classification bug** where analysis queries are incorrectly routed to name search logic. The fix is straightforward: add analysis keyword detection before name search detection. This is a high-priority issue affecting core functionality.

**Recommended Action:** Implement Solution 1 immediately to restore satisfaction analysis functionality.

---

**Report Generated By:** AI Code Analysis  
**Report Date:** Analysis Date  
**Next Steps:** Implement Solution 1 and test with provided test cases

