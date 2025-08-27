/**
 * Test script for the Breakout matchmaking system
 * Demonstrates asynchronous turn-based matchmaking functionality
 */

import { createClient } from 'redis';

// Configuration
const SERVER_URL = 'http://localhost:3001';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Test data
const testPlayers = [
  { name: 'Alice', score: 45, level: 3 },
  { name: 'Bob', score: 52, level: 4 },
  { name: 'Charlie', score: 38, level: 2 },
  { name: 'Diana', score: 61, level: 5 },
  { name: 'Eve', score: 47, level: 3 }
];

/**
 * Make HTTP request to server
 */
async function makeRequest(endpoint, method = 'GET', data = null) {
  try {
    const url = `${SERVER_URL}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const result = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      data: result
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test 1: Create matches for different players
 */
async function testCreateMatches() {
  console.log('\n🎮 Test 1: Creating matches for players...');
  
  const createdMatches = [];
  
  for (const player of testPlayers) {
    console.log(`Creating match for ${player.name} (score: ${player.score})`);
    
    const result = await makeRequest('/api/matchmaking/create', 'POST', {
      playerName: player.name,
      score: player.score,
      level: player.level
    });
    
    if (result.success) {
      console.log(`✅ Match created: ${result.data.match.id}`);
      createdMatches.push(result.data.match);
    } else {
      console.log(`❌ Failed to create match for ${player.name}: ${result.error}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return createdMatches;
}

/**
 * Test 2: Get open lobbies
 */
async function testGetLobbies() {
  console.log('\n📋 Test 2: Getting open lobbies...');
  
  const result = await makeRequest('/api/matchmaking/lobbies?limit=10');
  
  if (result.success) {
    console.log(`✅ Found ${result.data.count} open lobbies:`);
    result.data.lobbies.forEach((lobby, index) => {
      const waitingTime = Math.round(lobby.waitingTime / 1000);
      console.log(`  ${index + 1}. ${lobby.player1} (${lobby.player1Score} bricks, Level ${lobby.player1Level}) - waiting ${waitingTime}s`);
    });
  } else {
    console.log(`❌ Failed to get lobbies: ${result.error}`);
  }
  
  return result.success ? result.data.lobbies : [];
}

/**
 * Test 3: Join matches (simulate opponents)
 */
async function testJoinMatches(lobbies) {
  console.log('\n🎯 Test 3: Joining matches...');
  
  const opponents = [
    { name: 'Frank', score: 58, level: 4 },
    { name: 'Grace', score: 42, level: 3 },
    { name: 'Henry', score: 67, level: 5 },
    { name: 'Ivy', score: 39, level: 2 },
    { name: 'Jack', score: 55, level: 4 }
  ];
  
  for (let i = 0; i < Math.min(lobbies.length, opponents.length); i++) {
    const lobby = lobbies[i];
    const opponent = opponents[i];
    
    console.log(`\n${opponent.name} joining ${lobby.player1}'s match...`);
    
    const result = await makeRequest('/api/matchmaking/join', 'POST', {
      matchId: lobby.matchId,
      playerName: opponent.name,
      score: opponent.score,
      level: opponent.level
    });
    
    if (result.success) {
      const resolution = result.data.resolution;
      console.log(`✅ Match resolved!`);
      console.log(`   Winner: ${resolution.winner} (${resolution.winnerScore} bricks)`);
      console.log(`   Loser: ${resolution.loser} (${resolution.loserScore} bricks)`);
      console.log(`   Total: ${resolution.totalScore} bricks destroyed`);
    } else {
      console.log(`❌ Failed to join match: ${result.error}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

/**
 * Test 4: Get player match history
 */
async function testPlayerHistory() {
  console.log('\n📊 Test 4: Getting player match history...');
  
  for (const player of testPlayers.slice(0, 3)) {
    console.log(`\nGetting matches for ${player.name}...`);
    
    const result = await makeRequest(`/api/matchmaking/player/${player.name}/matches?limit=5`);
    
    if (result.success) {
      console.log(`✅ ${player.name} has ${result.data.count} matches:`);
      result.data.matches.forEach((match, index) => {
        const status = match.state === 'completed' ? '✅' : match.state === 'waiting' ? '⏳' : '❌';
        console.log(`  ${index + 1}. ${status} Match ${match.id.substring(0, 8)}... (${match.state})`);
        if (match.state === 'completed') {
          console.log(`     Winner: ${match.winner}`);
        }
      });
    } else {
      console.log(`❌ Failed to get matches for ${player.name}: ${result.error}`);
    }
  }
}

/**
 * Test 5: Get matchmaking statistics
 */
async function testMatchmakingStats() {
  console.log('\n📈 Test 5: Getting matchmaking statistics...');
  
  const result = await makeRequest('/api/matchmaking/stats');
  
  if (result.success) {
    const stats = result.data.stats;
    console.log('✅ Matchmaking Statistics:');
    console.log(`   Open Lobbies: ${stats.openLobbies}`);
    console.log(`   Total Matches: ${stats.totalMatches}`);
    console.log(`   Active Players: ${stats.activePlayers}`);
  } else {
    console.log(`❌ Failed to get stats: ${result.error}`);
  }
}

/**
 * Test 6: Get specific match details
 */
async function testMatchDetails() {
  console.log('\n🔍 Test 6: Getting match details...');
  
  // First get a list of lobbies to find a match ID
  const lobbiesResult = await makeRequest('/api/matchmaking/lobbies?limit=1');
  
  if (lobbiesResult.success && lobbiesResult.data.lobbies.length > 0) {
    const matchId = lobbiesResult.data.lobbies[0].matchId;
    console.log(`Getting details for match: ${matchId}`);
    
    const result = await makeRequest(`/api/matchmaking/matches/${matchId}`);
    
    if (result.success) {
      const match = result.data.match;
      console.log('✅ Match Details:');
      console.log(`   ID: ${match.id}`);
      console.log(`   State: ${match.state}`);
      console.log(`   Player 1: ${match.player1.name} (${match.player1.score} bricks, Level ${match.player1.level})`);
      if (match.player2) {
        console.log(`   Player 2: ${match.player2.name} (${match.player2.score} bricks, Level ${match.player2.level})`);
        console.log(`   Winner: ${match.winner}`);
      }
      console.log(`   Created: ${new Date(match.createdAt).toLocaleString()}`);
    } else {
      console.log(`❌ Failed to get match details: ${result.error}`);
    }
  } else {
    console.log('❌ No lobbies available for testing match details');
  }
}

/**
 * Test 7: Cancel a match
 */
async function testCancelMatch() {
  console.log('\n❌ Test 7: Cancelling a match...');
  
  // Create a match to cancel
  const createResult = await makeRequest('/api/matchmaking/create', 'POST', {
    playerName: 'TestPlayer',
    score: 30,
    level: 2
  });
  
  if (createResult.success) {
    const matchId = createResult.data.match.id;
    console.log(`Created match ${matchId} to test cancellation`);
    
    // Cancel the match
    const cancelResult = await makeRequest(`/api/matchmaking/matches/${matchId}`, 'DELETE', {
      playerName: 'TestPlayer'
    });
    
    if (cancelResult.success) {
      console.log('✅ Match cancelled successfully');
    } else {
      console.log(`❌ Failed to cancel match: ${cancelResult.error}`);
    }
  } else {
    console.log('❌ Failed to create match for cancellation test');
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🚀 Starting Breakout Matchmaking System Tests');
  console.log('=' .repeat(50));
  
  try {
    // Test 1: Create matches
    const createdMatches = await testCreateMatches();
    
    // Test 2: Get lobbies
    const lobbies = await testGetLobbies();
    
    // Test 3: Join matches
    await testJoinMatches(lobbies);
    
    // Test 4: Player history
    await testPlayerHistory();
    
    // Test 5: Statistics
    await testMatchmakingStats();
    
    // Test 6: Match details
    await testMatchDetails();
    
    // Test 7: Cancel match
    await testCancelMatch();
    
    console.log('\n🎉 All tests completed!');
    console.log('=' .repeat(50));
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { runTests };
