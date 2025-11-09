/**
 * Smoke Test for Attorney-Friendly Report Language
 * Tests that all reports use the new user-friendly language instead of technical jargon
 */

const MunicipalAnalysisEngine = require('../services/MunicipalAnalysisEngine');
const DataAccessLayer = require('../services/DataAccessLayer');

// Mock data for testing
const mockData = [
  {
    id: 1,
    name: "João Silva",
    age: 35,
    neighborhood: "Centro",
    whatsapp: "5511999999999",
    survey: {
      satisfaction: "Satisfeito",
      issue: "Transporte",
      participate: "Sim"
    }
  },
  {
    id: 2,
    name: "Maria Santos",
    age: 25,
    neighborhood: "Centro",
    whatsapp: "5511888888888",
    survey: {
      satisfaction: "Muito insatisfeito",
      issue: "Segurança",
      participate: "Não"
    }
  },
  {
    id: 3,
    name: "Pedro Costa",
    age: 52,
    neighborhood: "Vila Nova",
    whatsapp: "5511777777777",
    survey: {
      satisfaction: "Neutro",
      issue: "Saúde",
      participate: "Sim"
    }
  }
];

// Technical terms that should NOT appear
const technicalTerms = [
  'statistical',
  'significance',
  'confidence interval',
  'benchmark',
  'statistical reliability',
  'intervalos de confiança',
  'significância estatística',
  'benchmarking',
  'statistical confidence',
  'margin of error',
  'confidence',
  'sample size',
  'n=',
  'Limited',
  'Insufficient',
  'Insuficiente' // when used as classification
];

// User-friendly terms that SHOULD appear
const userFriendlyTerms = [
  'ação',
  'contatar',
  'agendar',
  'reuniões',
  'investigar',
  'resolver',
  'prático',
  'práticas',
  'prioritário',
  'prioridade',
  'Boa Satisfação',
  'Satisfação Regular',
  'Baixa Satisfação'
];

// Expected patterns in Portuguese
const expectedPatterns = [
  /ação prioritária/i,
  /contatar diretamente/i,
  /agendar reuniões/i,
  /investigar/i,
  /resolver/i,
  /o que significa/i,
  /o que fazer/i,
  /precisa de atenção/i
];

class ReportSmokeTest {
  constructor() {
    this.engine = new MunicipalAnalysisEngine();
    this.results = {
      passed: [],
      failed: [],
      warnings: []
    };
  }

  /**
   * Test if string contains technical jargon
   */
  containsTechnicalJargon(text) {
    const lowerText = text.toLowerCase();
    return technicalTerms.some(term => lowerText.includes(term.toLowerCase()));
  }

  /**
   * Test if string contains user-friendly language
   */
  containsUserFriendlyLanguage(text) {
    const lowerText = text.toLowerCase();
    return userFriendlyTerms.some(term => lowerText.includes(term.toLowerCase())) ||
           expectedPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Test age satisfaction analysis
   */
  async testAgeSatisfaction() {
    console.log('\n🧪 Testing Age Satisfaction Analysis...');
    
    try {
      const result = await this.engine.analyzeSatisfactionByAge();
      
      // Check insightSummary
      if (result.insightSummary) {
        if (this.containsTechnicalJargon(result.insightSummary)) {
          this.results.failed.push({
            test: 'Age Satisfaction - insightSummary',
            issue: 'Contains technical jargon',
            text: result.insightSummary
          });
        } else if (this.containsUserFriendlyLanguage(result.insightSummary)) {
          this.results.passed.push('Age Satisfaction - insightSummary uses user-friendly language');
        }
      }

      // Check recommendations
      if (result.recommendations && result.recommendations.length > 0) {
        result.recommendations.forEach((rec, idx) => {
          if (this.containsTechnicalJargon(rec)) {
            this.results.failed.push({
              test: `Age Satisfaction - recommendation ${idx + 1}`,
              issue: 'Contains technical jargon',
              text: rec
            });
          } else if (this.containsUserFriendlyLanguage(rec)) {
            this.results.passed.push(`Age Satisfaction - recommendation ${idx + 1} uses user-friendly language`);
          }
        });
      }

      // Check for specific user-friendly patterns
      const allText = [result.insightSummary, ...(result.recommendations || [])].join(' ');
      if (allText.includes('Contatar diretamente') || allText.includes('Agendar reuniões')) {
        this.results.passed.push('Age Satisfaction - contains actionable recommendations');
      }

    } catch (error) {
      this.results.failed.push({
        test: 'Age Satisfaction Analysis',
        issue: 'Error during test',
        error: error.message
      });
    }
  }

  /**
   * Test satisfaction analysis
   */
  async testSatisfaction() {
    console.log('\n🧪 Testing Satisfaction Analysis...');
    
    try {
      const result = await this.engine.analyzeSatisfaction();
      
      if (result.insights && result.insights.length > 0) {
        result.insights.forEach((insight, idx) => {
          if (this.containsTechnicalJargon(insight)) {
            this.results.failed.push({
              test: `Satisfaction - insight ${idx + 1}`,
              issue: 'Contains technical jargon',
              text: insight
            });
          } else if (this.containsUserFriendlyLanguage(insight)) {
            this.results.passed.push(`Satisfaction - insight ${idx + 1} uses user-friendly language`);
          }
        });
      }

      if (result.recommendations && result.recommendations.length > 0) {
        result.recommendations.forEach((rec, idx) => {
          if (this.containsTechnicalJargon(rec)) {
            this.results.failed.push({
              test: `Satisfaction - recommendation ${idx + 1}`,
              issue: 'Contains technical jargon',
              text: rec
            });
          }
        });
      }

    } catch (error) {
      this.results.failed.push({
        test: 'Satisfaction Analysis',
        issue: 'Error during test',
        error: error.message
      });
    }
  }

  /**
   * Test neighborhood analysis
   */
  async testNeighborhoods() {
    console.log('\n🧪 Testing Neighborhood Analysis...');
    
    try {
      const result = await this.engine.analyzeNeighborhoods();
      
      if (result.insights && result.insights.length > 0) {
        result.insights.forEach((insight, idx) => {
          if (this.containsTechnicalJargon(insight)) {
            this.results.failed.push({
              test: `Neighborhoods - insight ${idx + 1}`,
              issue: 'Contains technical jargon',
              text: insight
            });
          }
        });
      }

      if (result.recommendations && result.recommendations.length > 0) {
        result.recommendations.forEach((rec, idx) => {
          if (this.containsTechnicalJargon(rec)) {
            this.results.failed.push({
              test: `Neighborhoods - recommendation ${idx + 1}`,
              issue: 'Contains technical jargon',
              text: rec
            });
          }
        });
      }

    } catch (error) {
      this.results.failed.push({
        test: 'Neighborhood Analysis',
        issue: 'Error during test',
        error: error.message
      });
    }
  }

  /**
   * Test issues analysis
   */
  async testIssues() {
    console.log('\n🧪 Testing Issues Analysis...');
    
    try {
      const result = await this.engine.analyzeIssues();
      
      if (result.insights && result.insights.length > 0) {
        result.insights.forEach((insight, idx) => {
          if (this.containsTechnicalJargon(insight)) {
            this.results.failed.push({
              test: `Issues - insight ${idx + 1}`,
              issue: 'Contains technical jargon',
              text: insight
            });
          }
        });
      }

      if (result.recommendations && result.recommendations.length > 0) {
        result.recommendations.forEach((rec, idx) => {
          if (this.containsTechnicalJargon(rec)) {
            this.results.failed.push({
              test: `Issues - recommendation ${idx + 1}`,
              issue: 'Contains technical jargon',
              text: rec
            });
          }
        });
      }

    } catch (error) {
      this.results.failed.push({
        test: 'Issues Analysis',
        issue: 'Error during test',
        error: error.message
      });
    }
  }

  /**
   * Test engagement analysis
   */
  async testEngagement() {
    console.log('\n🧪 Testing Engagement Analysis...');
    
    try {
      const result = await this.engine.analyzeEngagement();
      
      if (result.insights && result.insights.length > 0) {
        result.insights.forEach((insight, idx) => {
          if (this.containsTechnicalJargon(insight)) {
            this.results.failed.push({
              test: `Engagement - insight ${idx + 1}`,
              issue: 'Contains technical jargon',
              text: insight
            });
          }
        });
      }

    } catch (error) {
      this.results.failed.push({
        test: 'Engagement Analysis',
        issue: 'Error during test',
        error: error.message
      });
    }
  }

  /**
   * Test participation analysis
   */
  async testParticipation() {
    console.log('\n🧪 Testing Participation Analysis...');
    
    try {
      const result = await this.engine.analyzeParticipation();
      
      if (result.insights && result.insights.length > 0) {
        result.insights.forEach((insight, idx) => {
          if (this.containsTechnicalJargon(insight)) {
            this.results.failed.push({
              test: `Participation - insight ${idx + 1}`,
              issue: 'Contains technical jargon',
              text: insight
            });
          }
        });
      }

    } catch (error) {
      this.results.failed.push({
        test: 'Participation Analysis',
        issue: 'Error during test',
        error: error.message
      });
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🚀 Starting Smoke Test for Attorney-Friendly Reports\n');
    console.log('='.repeat(60));

    await this.testAgeSatisfaction();
    await this.testSatisfaction();
    await this.testNeighborhoods();
    await this.testIssues();
    await this.testEngagement();
    await this.testParticipation();

    this.printResults();
  }

  /**
   * Print test results
   */
  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(60));

    console.log(`\n✅ PASSED: ${this.results.passed.length}`);
    if (this.results.passed.length > 0) {
      this.results.passed.slice(0, 5).forEach(test => {
        console.log(`  ✓ ${test}`);
      });
      if (this.results.passed.length > 5) {
        console.log(`  ... and ${this.results.passed.length - 5} more`);
      }
    }

    console.log(`\n❌ FAILED: ${this.results.failed.length}`);
    if (this.results.failed.length > 0) {
      this.results.failed.forEach(failure => {
        console.log(`\n  ✗ ${failure.test}`);
        console.log(`    Issue: ${failure.issue}`);
        if (failure.text) {
          console.log(`    Text: "${failure.text.substring(0, 100)}..."`);
        }
        if (failure.error) {
          console.log(`    Error: ${failure.error}`);
        }
      });
    }

    console.log(`\n⚠️  WARNINGS: ${this.results.warnings.length}`);
    if (this.results.warnings.length > 0) {
      this.results.warnings.forEach(warning => {
        console.log(`  ⚠ ${warning}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    
    const totalTests = this.results.passed.length + this.results.failed.length;
    const passRate = totalTests > 0 ? (this.results.passed.length / totalTests * 100).toFixed(1) : 0;
    
    console.log(`\n📈 Overall: ${passRate}% pass rate`);
    
    if (this.results.failed.length === 0) {
      console.log('✨ All tests passed! Reports are using attorney-friendly language.');
    } else {
      console.log('⚠️  Some tests failed. Check the issues above.');
    }
    
    console.log('\n');
  }
}

// Run tests if executed directly
if (require.main === module) {
  const test = new ReportSmokeTest();
  test.runAllTests().catch(console.error);
}

module.exports = ReportSmokeTest;

