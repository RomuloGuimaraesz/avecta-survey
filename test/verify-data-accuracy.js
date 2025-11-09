/**
 * Data Accuracy Verification Test
 * Verifies that reports actually use data from data.json and reflect real information
 */

const MunicipalAnalysisEngine = require('../services/MunicipalAnalysisEngine');
const DataAccessLayer = require('../services/DataAccessLayer');

class DataAccuracyTest {
  constructor() {
    this.engine = new MunicipalAnalysisEngine();
    this.dataAccess = new DataAccessLayer();
    this.results = {
      passed: [],
      failed: [],
      warnings: []
    };
  }

  /**
   * Get actual data from data.json
   */
  getActualData() {
    const data = this.dataAccess.loadData();
    const responses = this.dataAccess.getSurveyResponses();
    
    return {
      totalContacts: data.length,
      totalResponses: responses.length,
      neighborhoods: [...new Set(data.map(d => d.neighborhood).filter(Boolean))],
      satisfactionLevels: [...new Set(responses.map(r => r.survey?.satisfaction).filter(Boolean))],
      issues: [...new Set(responses.map(r => r.survey?.issue).filter(Boolean))],
      ages: responses.map(r => r.age).filter(Boolean),
      participationInterest: responses.filter(r => r.survey?.participate === 'Sim').length,
      dissatisfied: responses.filter(r => 
        ['Muito insatisfeito', 'Insatisfeito'].includes(r.survey?.satisfaction)
      ).length
    };
  }

  /**
   * Verify that numbers in text match actual data
   */
  verifyNumbersMatch(text, actualData, testName) {
    const issues = [];
    
    // Check total contacts
    if (text.includes('cidadãos')) {
      const match = text.match(/(\d+)\s*cidadãos/);
      if (match) {
        const reported = parseInt(match[1]);
        if (reported !== actualData.totalContacts && reported !== actualData.totalResponses) {
          issues.push(`Reported ${reported} but actual data has ${actualData.totalContacts} contacts / ${actualData.totalResponses} responses`);
        }
      }
    }

    // Check neighborhoods
    actualData.neighborhoods.forEach(neighborhood => {
      if (text.includes(neighborhood)) {
        this.results.passed.push(`${testName}: Mentions real neighborhood "${neighborhood}"`);
      }
    });

    // Check satisfaction levels
    actualData.satisfactionLevels.forEach(level => {
      if (text.includes(level)) {
        this.results.passed.push(`${testName}: Mentions real satisfaction level "${level}"`);
      }
    });

    // Check issues
    actualData.issues.forEach(issue => {
      if (text.includes(issue)) {
        this.results.passed.push(`${testName}: Mentions real issue "${issue}"`);
      }
    });

    if (issues.length > 0) {
      this.results.failed.push({
        test: testName,
        issues: issues
      });
    }
  }

  /**
   * Test age satisfaction analysis uses real data
   */
  async testAgeSatisfactionDataAccuracy() {
    console.log('\n📊 Testing Age Satisfaction Data Accuracy...');
    
    const actualData = this.getActualData();
    const result = await this.engine.analyzeSatisfactionByAge();

    // Verify total responses match
    if (result.totalResponses === actualData.ages.length) {
      this.results.passed.push('Age Satisfaction: Total responses matches actual data');
    } else {
      this.results.failed.push({
        test: 'Age Satisfaction - Total Responses',
        issue: `Reported ${result.totalResponses} but actual data has ${actualData.ages.length} responses with age`
      });
    }

    // Verify brackets have real counts
    if (result.brackets && result.brackets.length > 0) {
      const totalInBrackets = result.brackets.reduce((sum, b) => sum + b.count, 0);
      if (totalInBrackets === actualData.ages.length) {
        this.results.passed.push('Age Satisfaction: Bracket counts sum to actual data');
      } else {
        this.results.failed.push({
          test: 'Age Satisfaction - Bracket Counts',
          issue: `Brackets sum to ${totalInBrackets} but actual data has ${actualData.ages.length}`
        });
      }

      // Verify each bracket has valid scores
      result.brackets.forEach(bracket => {
        if (bracket.averageScore >= 1 && bracket.averageScore <= 5) {
          this.results.passed.push(`Age Satisfaction: Bracket ${bracket.label} has valid score ${bracket.averageScore}`);
        } else {
          this.results.failed.push({
            test: `Age Satisfaction - Bracket ${bracket.label}`,
            issue: `Invalid average score: ${bracket.averageScore} (should be 1-5)`
          });
        }
      });
    }

    // Verify insights mention real data
    if (result.insightSummary) {
      this.verifyNumbersMatch(result.insightSummary, actualData, 'Age Satisfaction - insightSummary');
    }
  }

  /**
   * Test satisfaction analysis uses real data
   */
  async testSatisfactionDataAccuracy() {
    console.log('\n📊 Testing Satisfaction Analysis Data Accuracy...');
    
    const actualData = this.getActualData();
    const result = await this.engine.analyzeSatisfaction();

    // Verify total matches
    if (result.total === actualData.totalResponses) {
      this.results.passed.push('Satisfaction: Total matches actual responses');
    } else {
      this.results.failed.push({
        test: 'Satisfaction - Total',
        issue: `Reported ${result.total} but actual data has ${actualData.totalResponses} responses`
      });
    }

    // Verify average score is calculated from real data
    if (result.averageScore >= 1 && result.averageScore <= 5) {
      this.results.passed.push(`Satisfaction: Average score ${result.averageScore} is valid`);
    } else {
      this.results.failed.push({
        test: 'Satisfaction - Average Score',
        issue: `Invalid average score: ${result.averageScore} (should be 1-5)`
      });
    }

    // Verify breakdown matches actual satisfaction levels
    if (result.breakdown && result.breakdown.length > 0) {
      const breakdownTotal = result.breakdown.reduce((sum, b) => sum + parseInt(b.count), 0);
      if (breakdownTotal === actualData.totalResponses) {
        this.results.passed.push('Satisfaction: Breakdown total matches actual responses');
      }

      // Check if breakdown includes actual satisfaction levels
      result.breakdown.forEach(b => {
        if (actualData.satisfactionLevels.includes(b.level)) {
          this.results.passed.push(`Satisfaction: Breakdown includes real level "${b.level}"`);
        }
      });
    }

    // Verify insights mention real numbers
    if (result.insights && result.insights.length > 0) {
      result.insights.forEach(insight => {
        this.verifyNumbersMatch(insight, actualData, 'Satisfaction - Insight');
      });
    }
  }

  /**
   * Test neighborhood analysis uses real data
   */
  async testNeighborhoodDataAccuracy() {
    console.log('\n📊 Testing Neighborhood Analysis Data Accuracy...');
    
    const actualData = this.getActualData();
    const result = await this.engine.analyzeNeighborhoods();

    // Verify neighborhoods match actual data
    if (result.neighborhoods && result.neighborhoods.length > 0) {
      const reportedNeighborhoods = result.neighborhoods.map(n => n.neighborhood);
      const matchingNeighborhoods = reportedNeighborhoods.filter(n => 
        actualData.neighborhoods.includes(n)
      );

      if (matchingNeighborhoods.length === reportedNeighborhoods.length) {
        this.results.passed.push(`Neighborhoods: All ${reportedNeighborhoods.length} neighborhoods match actual data`);
      } else {
        this.results.failed.push({
          test: 'Neighborhoods - Neighborhood Names',
          issue: `Only ${matchingNeighborhoods.length} of ${reportedNeighborhoods.length} neighborhoods match actual data`
        });
      }

      // Verify insights mention real neighborhood names
      if (result.insights && result.insights.length > 0) {
        result.insights.forEach(insight => {
          actualData.neighborhoods.forEach(neighborhood => {
            if (insight.includes(neighborhood)) {
              this.results.passed.push(`Neighborhoods: Insight mentions real neighborhood "${neighborhood}"`);
            }
          });
        });
      }
    }
  }

  /**
   * Test issues analysis uses real data
   */
  async testIssuesDataAccuracy() {
    console.log('\n📊 Testing Issues Analysis Data Accuracy...');
    
    const actualData = this.getActualData();
    const result = await this.engine.analyzeIssues();

    // Verify total matches
    if (result.total === actualData.totalResponses) {
      this.results.passed.push('Issues: Total matches actual responses');
    }

    // Verify breakdown includes real issues
    if (result.breakdown && result.breakdown.length > 0) {
      result.breakdown.forEach(issue => {
        if (actualData.issues.includes(issue.issue)) {
          this.results.passed.push(`Issues: Breakdown includes real issue "${issue.issue}"`);
        }
      });

      // Verify breakdown percentages are valid
      const totalPercentage = result.breakdown.reduce((sum, i) => sum + parseFloat(i.percentage), 0);
      if (totalPercentage >= 95 && totalPercentage <= 105) { // Allow small rounding differences
        this.results.passed.push('Issues: Breakdown percentages sum correctly');
      } else {
        this.results.failed.push({
          test: 'Issues - Breakdown Percentages',
          issue: `Percentages sum to ${totalPercentage}% (should be ~100%)`
        });
      }
    }

    // Verify priority issues are from actual data
    if (result.priorityIssues && result.priorityIssues.length > 0) {
      result.priorityIssues.forEach(issue => {
        if (actualData.issues.includes(issue.issue)) {
          this.results.passed.push(`Issues: Priority issue "${issue.issue}" is from actual data`);
        }
      });
    }
  }

  /**
   * Test engagement analysis uses real data
   */
  async testEngagementDataAccuracy() {
    console.log('\n📊 Testing Engagement Analysis Data Accuracy...');
    
    const actualData = this.getActualData();
    const result = await this.engine.analyzeEngagement();

    // Verify totals match
    if (result.total === actualData.totalContacts) {
      this.results.passed.push('Engagement: Total contacts matches actual data');
    }

    if (result.answered === actualData.totalResponses) {
      this.results.passed.push('Engagement: Answered count matches actual responses');
    }

    // Verify rates are valid percentages
    if (result.rates) {
      const responseRate = parseFloat(result.rates.response);
      if (responseRate >= 0 && responseRate <= 100) {
        this.results.passed.push(`Engagement: Response rate ${responseRate}% is valid`);
      } else {
        this.results.failed.push({
          test: 'Engagement - Response Rate',
          issue: `Invalid response rate: ${responseRate}% (should be 0-100)`
        });
      }
    }
  }

  /**
   * Test participation analysis uses real data
   */
  async testParticipationDataAccuracy() {
    console.log('\n📊 Testing Participation Analysis Data Accuracy...');
    
    const actualData = this.getActualData();
    const result = await this.engine.analyzeParticipation();

    // Verify total matches
    if (result.total === actualData.totalResponses) {
      this.results.passed.push('Participation: Total matches actual responses');
    }

    // Verify interested count matches
    if (result.interested === actualData.participationInterest) {
      this.results.passed.push(`Participation: Interested count ${result.interested} matches actual data`);
    } else {
      this.results.failed.push({
        test: 'Participation - Interested Count',
        issue: `Reported ${result.interested} but actual data has ${actualData.participationInterest}`
      });
    }

    // Verify rate is valid
    const rate = parseFloat(result.rate);
    if (rate >= 0 && rate <= 100) {
      this.results.passed.push(`Participation: Rate ${rate}% is valid`);
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🔍 Starting Data Accuracy Verification Test\n');
    console.log('='.repeat(60));

    const actualData = this.getActualData();
    console.log(`\n📋 Actual Data Summary:`);
    console.log(`  Total Contacts: ${actualData.totalContacts}`);
    console.log(`  Total Responses: ${actualData.totalResponses}`);
    console.log(`  Neighborhoods: ${actualData.neighborhoods.length} (${actualData.neighborhoods.slice(0, 3).join(', ')}...)`);
    console.log(`  Satisfaction Levels: ${actualData.satisfactionLevels.join(', ')}`);
    console.log(`  Issues: ${actualData.issues.join(', ')}`);
    console.log(`  Dissatisfied: ${actualData.dissatisfied}`);
    console.log(`  Participation Interest: ${actualData.participationInterest}`);

    await this.testAgeSatisfactionDataAccuracy();
    await this.testSatisfactionDataAccuracy();
    await this.testNeighborhoodDataAccuracy();
    await this.testIssuesDataAccuracy();
    await this.testEngagementDataAccuracy();
    await this.testParticipationDataAccuracy();

    this.printResults();
  }

  /**
   * Print test results
   */
  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 DATA ACCURACY TEST RESULTS');
    console.log('='.repeat(60));

    console.log(`\n✅ PASSED: ${this.results.passed.length}`);
    if (this.results.passed.length > 0) {
      this.results.passed.slice(0, 10).forEach(test => {
        console.log(`  ✓ ${test}`);
      });
      if (this.results.passed.length > 10) {
        console.log(`  ... and ${this.results.passed.length - 10} more`);
      }
    }

    console.log(`\n❌ FAILED: ${this.results.failed.length}`);
    if (this.results.failed.length > 0) {
      this.results.failed.forEach(failure => {
        console.log(`\n  ✗ ${failure.test}`);
        if (failure.issue) {
          console.log(`    Issue: ${failure.issue}`);
        }
        if (failure.issues) {
          failure.issues.forEach(issue => {
            console.log(`    Issue: ${issue}`);
          });
        }
      });
    }

    console.log('\n' + '='.repeat(60));
    
    const totalTests = this.results.passed.length + this.results.failed.length;
    const passRate = totalTests > 0 ? (this.results.passed.length / totalTests * 100).toFixed(1) : 0;
    
    console.log(`\n📈 Overall: ${passRate}% pass rate`);
    
    if (this.results.failed.length === 0) {
      console.log('✨ All tests passed! Reports accurately reflect data.json.');
    } else {
      console.log('⚠️  Some tests failed. Reports may not be using actual data.');
    }
    
    console.log('\n');
  }
}

// Run tests if executed directly
if (require.main === module) {
  const test = new DataAccuracyTest();
  test.runAllTests().catch(console.error);
}

module.exports = DataAccuracyTest;

