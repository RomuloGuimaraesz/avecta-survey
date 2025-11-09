#!/usr/bin/env node
/**
 * Integration test to verify name search through the full API endpoint
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const TEST_QUERY = 'Encontre o Rômulo Guimarães';

async function testAPINameSearch() {
  console.log('🧪 Testing Name Search via API Endpoint\n');
  console.log(`📍 Server: ${BASE_URL}`);
  console.log(`📝 Query: "${TEST_QUERY}"\n`);
  console.log('─'.repeat(60));
  
  try {
    const response = await axios.post(`${BASE_URL}/api/admin/agent-ui`, {
      query: TEST_QUERY
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    const result = response.data;
    
    console.log('\n📊 Response Details:');
    console.log('─'.repeat(60));
    console.log(`✅ Success: ${result.success}`);
    console.log(`🤖 Intent: ${result.intent || 'N/A'}`);
    console.log(`⏱️  Processing Time: ${result.processingTime}ms`);
    
    if (result.intent === 'out_of_scope') {
      console.log('\n❌ PROBLEM: Query was marked as out_of_scope!');
      console.log(`   Response: ${result.response}`);
      return false;
    }
    
    if (result.intent !== 'knowledge') {
      console.log(`\n⚠️  WARNING: Expected intent 'knowledge', got '${result.intent}'`);
    } else {
      console.log(`\n✅ Intent is correct: 'knowledge'`);
    }
    
    console.log(`\n📝 Response Text:`);
    console.log(result.response || 'No response text');
    
    if (result.residents && Array.isArray(result.residents)) {
      console.log(`\n👥 Residents Found: ${result.residents.length}`);
      if (result.residents.length > 0) {
        result.residents.forEach((resident, idx) => {
          console.log(`   ${idx + 1}. ${resident.name} (${resident.neighborhood || 'N/A'})`);
        });
        
        // Check if Rômulo Guimarães was found
        const found = result.residents.find(r => 
          r.name.toLowerCase().includes('rômulo') || 
          r.name.toLowerCase().includes('romulo')
        );
        
        if (found) {
          console.log(`\n✅ SUCCESS: Rômulo Guimarães was found in results!`);
        } else {
          console.log(`\n⚠️  WARNING: Rômulo Guimarães not found in results`);
        }
      }
    } else {
      console.log(`\n⚠️  No residents array in response`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ API Test Completed Successfully');
    console.log('='.repeat(60));
    
    return result.intent !== 'out_of_scope';
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('\n❌ ERROR: Could not connect to server');
      console.log(`   Make sure the server is running on ${BASE_URL}`);
      console.log(`   Start it with: npm start`);
      return false;
    }
    
    console.log('\n❌ ERROR:', error.message);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data:`, JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

// Run the test
testAPINameSearch()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

