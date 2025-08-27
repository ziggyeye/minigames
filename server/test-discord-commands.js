/**
 * Test script for Discord bot commands
 * Demonstrates the new matchmaking Discord commands
 */

import { createClient } from 'redis';

// Configuration
const SERVER_URL = 'http://localhost:3001';

// Test data for creating matches
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
 * Test 1: Create matches to demonstrate automatic matchmaking
 */
async function testAutomaticMatchmaking() {
  console.log('\n🎮 Test 1: Testing automatic matchmaking...');
  
  for (const player of testPlayers) {
    console.log(`\nSubmitting score for ${player.name} (${player.score} bricks)...`);
    
    const result = await makeRequest('/api/score', 'POST', {
      playerName: player.name,
      score: player.score,
      level: player.level
    });
    
    if (result.success) {
      const matchmaking = result.data.matchmaking;
      if (matchmaking && matchmaking.success) {
        if (matchmaking.match.state === 'waiting') {
          console.log(`✅ ${player.name} created new match: ${matchmaking.match.id.substring(0, 8)}...`);
        } else if (matchmaking.resolution) {
          console.log(`🎯 ${player.name} joined match and ${matchmaking.resolution.winner} won!`);
        }
      }
    } else {
      console.log(`❌ Failed to submit score for ${player.name}: ${result.error}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

/**
 * Test 2: Demonstrate Discord commands (simulated)
 */
async function testDiscordCommands() {
  console.log('\n🤖 Test 2: Discord Bot Commands Available');
  console.log('=' .repeat(50));
  console.log('The following Discord commands are now available:');
  console.log('');
  console.log('📋 !matches <playerName>');
  console.log('   Example: !matches Alice');
  console.log('   Shows match history for a specific player');
  console.log('');
  console.log('📊 !stats');
  console.log('   Shows current matchmaking system statistics');
  console.log('');
  console.log('❌ !cancel <matchId>');
  console.log('   Example: !cancel match_1234567890_abc123');
  console.log('   Cancels a waiting match (match creator only)');
  console.log('');
  console.log('❓ !help');
  console.log('   Shows all available commands and how to play');
  console.log('');
  console.log('💡 To test these commands:');
  console.log('   1. Go to your Discord server');
  console.log('   2. Type the commands in the configured channel');
  console.log('   3. The bot will respond with rich embeds');
  console.log('');
}

/**
 * Test 3: Get current matchmaking stats
 */
async function testGetStats() {
  console.log('\n📈 Test 3: Getting current matchmaking statistics...');
  
  const result = await makeRequest('/api/matchmaking/stats');
  
  if (result.success) {
    const stats = result.data.stats;
    console.log('✅ Current Statistics:');
    console.log(`   Open Lobbies: ${stats.openLobbies}`);
    console.log(`   Total Matches: ${stats.totalMatches}`);
    console.log(`   Active Players: ${stats.activePlayers}`);
  } else {
    console.log(`❌ Failed to get stats: ${result.error}`);
  }
}

/**
 * Test 4: Get player matches
 */
async function testGetPlayerMatches() {
  console.log('\n📊 Test 4: Getting player match history...');
  
  for (const player of testPlayers.slice(0, 3)) {
    console.log(`\nGetting matches for ${player.name}...`);
    
    const result = await makeRequest(`/api/matchmaking/player/${player.name}/matches?limit=5`);
    
    if (result.success) {
      console.log(`✅ ${player.name} has ${result.data.count} matches`);
      result.data.matches.forEach((match, index) => {
        const status = match.state === 'completed' ? '✅' : match.state === 'waiting' ? '⏳' : '❌';
        console.log(`  ${index + 1}. ${status} ${match.state} - ${match.id.substring(0, 8)}...`);
        if (match.state === 'completed' && match.winner) {
          console.log(`     Winner: ${match.winner}`);
        }
      });
    } else {
      console.log(`❌ Failed to get matches for ${player.name}: ${result.error}`);
    }
  }
}

/**
 * Test 5: Demonstrate automatic matchmaking flow
 */
async function testMatchmakingFlow() {
  console.log('\n🔄 Test 5: Demonstrating automatic matchmaking flow...');
  
  // Create a few matches first
  console.log('\nStep 1: Creating initial matches...');
  const players = ['Frank', 'Grace', 'Henry'];
  
  for (const player of players) {
    const score = Math.floor(Math.random() * 50) + 30;
    const level = Math.floor(Math.random() * 5) + 1;
    
    console.log(`Creating match for ${player} (${score} bricks, Level ${level})...`);
    
    const result = await makeRequest('/api/score', 'POST', {
      playerName: player,
      score: score,
      level: level
    });
    
    if (result.success && result.data.matchmaking) {
      console.log(`✅ ${player} created match: ${result.data.matchmaking.match.id.substring(0, 8)}...`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Now have new players join existing matches
  console.log('\nStep 2: New players joining existing matches...');
  const joiners = ['Ivy', 'Jack', 'Kate'];
  
  for (const joiner of joiners) {
    const score = Math.floor(Math.random() * 50) + 30;
    const level = Math.floor(Math.random() * 5) + 1;
    
    console.log(`\n${joiner} submitting score (${score} bricks, Level ${level})...`);
    
    const result = await makeRequest('/api/score', 'POST', {
      playerName: joiner,
      score: score,
      level: level
    });
    
    if (result.success && result.data.matchmaking) {
      if (result.data.matchmaking.resolution) {
        const resolution = result.data.matchmaking.resolution;
        console.log(`🎯 ${joiner} joined match and ${resolution.winner} won!`);
        console.log(`   ${resolution.winner}: ${resolution.winnerScore} bricks`);
        console.log(`   ${resolution.loser}: ${resolution.loserScore} bricks`);
      } else {
        console.log(`✅ ${joiner} created new match (no available lobbies)`);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🤖 Starting Discord Bot Commands Test');
  console.log('=' .repeat(50));
  
  try {
    // Test 1: Automatic matchmaking
    await testAutomaticMatchmaking();
    
    // Test 2: Discord commands info
    await testDiscordCommands();
    
    // Test 3: Get stats
    await testGetStats();
    
    // Test 4: Get player matches
    await testGetPlayerMatches();
    
    // Test 5: Matchmaking flow
    await testMatchmakingFlow();
    
    console.log('\n🎉 Discord bot commands test completed!');
    console.log('=' .repeat(50));
    console.log('\n💡 Next steps:');
    console.log('   1. Check your Discord server for the bot responses');
    console.log('   2. Try the commands: !help, !stats, !matches <playerName>');
    console.log('   3. Watch for automatic match creation and resolution');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { runTests };
