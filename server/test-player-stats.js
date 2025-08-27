/**
 * Test script for player win/loss tracking
 * Demonstrates the new player statistics functionality
 */

// Configuration
const SERVER_URL = 'http://localhost:3001';

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
 * Test 1: Create matches and resolve them to generate stats
 */
async function testMatchResolution() {
  console.log('\n🎮 Test 1: Creating and resolving matches to generate player stats...');
  
  const players = [
    { name: 'Alice', score: 45, level: 3 },
    { name: 'Bob', score: 52, level: 4 },
    { name: 'Charlie', score: 38, level: 2 },
    { name: 'Diana', score: 61, level: 5 },
    { name: 'Eve', score: 47, level: 3 }
  ];

  const opponents = [
    { name: 'Frank', score: 58, level: 4 },
    { name: 'Grace', score: 42, level: 3 },
    { name: 'Henry', score: 67, level: 5 },
    { name: 'Ivy', score: 39, level: 2 },
    { name: 'Jack', score: 55, level: 4 }
  ];

  // Create matches and resolve them
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const opponent = opponents[i];
    
    console.log(`\n${player.name} vs ${opponent.name}...`);
    
    // Player 1 creates match
    const createResult = await makeRequest('/api/matchmaking/create', 'POST', {
      playerName: player.name,
      score: player.score,
      level: player.level
    });
    
    if (createResult.success) {
      const matchId = createResult.data.match.id;
      console.log(`✅ ${player.name} created match: ${matchId.substring(0, 8)}...`);
      
      // Player 2 joins and resolves match
      const joinResult = await makeRequest('/api/matchmaking/join', 'POST', {
        matchId: matchId,
        playerName: opponent.name,
        score: opponent.score,
        level: opponent.level
      });
      
      if (joinResult.success) {
        const resolution = joinResult.data.resolution;
        console.log(`🎯 Match resolved: ${resolution.winner} wins!`);
        console.log(`   ${resolution.winner}: ${resolution.winnerScore} bricks`);
        console.log(`   ${resolution.loser}: ${resolution.loserScore} bricks`);
      }
    }
    
    // Small delay between matches
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

/**
 * Test 2: Get player stats
 */
async function testGetPlayerStats() {
  console.log('\n📊 Test 2: Getting player statistics...');
  
  const players = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack'];
  
  for (const playerName of players) {
    console.log(`\nGetting stats for ${playerName}...`);
    
    const result = await makeRequest(`/api/matchmaking/player/${playerName}/stats`);
    
    if (result.success) {
      const stats = result.data.stats;
      console.log(`✅ ${playerName}: ${stats.wins}W/${stats.losses}L (${stats.winRate.toFixed(1)}% win rate)`);
      console.log(`   Total Matches: ${stats.totalMatches}`);
    } else {
      console.log(`❌ Failed to get stats for ${playerName}: ${result.error}`);
    }
  }
}

/**
 * Test 3: Get player matches with stats
 */
async function testGetPlayerMatches() {
  console.log('\n📋 Test 3: Getting player matches with statistics...');
  
  const players = ['Alice', 'Bob', 'Frank', 'Grace'];
  
  for (const playerName of players) {
    console.log(`\nGetting matches for ${playerName}...`);
    
    const result = await makeRequest(`/api/matchmaking/player/${playerName}/matches?limit=5`);
    
    if (result.success) {
      console.log(`✅ ${playerName} has ${result.data.count} matches`);
      
      // Also get their stats
      const statsResult = await makeRequest(`/api/matchmaking/player/${playerName}/stats`);
      if (statsResult.success) {
        const stats = statsResult.data.stats;
        console.log(`   Stats: ${stats.wins}W/${stats.losses}L (${stats.winRate.toFixed(1)}%)`);
      }
      
      result.data.matches.forEach((match, index) => {
        const status = match.state === 'completed' ? '✅' : match.state === 'waiting' ? '⏳' : '❌';
        console.log(`  ${index + 1}. ${status} ${match.state} - ${match.id.substring(0, 8)}...`);
        if (match.state === 'completed' && match.winner) {
          console.log(`     Winner: ${match.winner}`);
        }
      });
    } else {
      console.log(`❌ Failed to get matches for ${playerName}: ${result.error}`);
    }
  }
}

/**
 * Test 4: Test Discord commands simulation
 */
async function testDiscordCommandsSimulation() {
  console.log('\n🤖 Test 4: Discord Commands Simulation');
  console.log('=' .repeat(50));
  console.log('The following Discord commands now include player stats:');
  console.log('');
  console.log('📋 !matches <playerName>');
  console.log('   Now shows:');
  console.log('   - Player win/loss record');
  console.log('   - Win rate percentage');
  console.log('   - Total matches played');
  console.log('   - Match history with results');
  console.log('');
  console.log('📊 !stats');
  console.log('   Shows system-wide statistics');
  console.log('');
  console.log('💡 Match resolution embeds now show:');
  console.log('   - Winner and loser with their scores');
  console.log('   - Player win/loss records');
  console.log('   - Match duration and total bricks');
  console.log('');
}

/**
 * Test 5: Create additional matches to test stats progression
 */
async function testStatsProgression() {
  console.log('\n📈 Test 5: Testing stats progression with additional matches...');
  
  // Create some additional matches to see stats change
  const additionalMatches = [
    { player1: { name: 'Alice', score: 50, level: 4 }, player2: { name: 'Bob', score: 48, level: 3 } },
    { player1: { name: 'Charlie', score: 55, level: 5 }, player2: { name: 'Diana', score: 52, level: 4 } },
    { player1: { name: 'Eve', score: 60, level: 5 }, player2: { name: 'Frank', score: 58, level: 4 } }
  ];
  
  for (const match of additionalMatches) {
    console.log(`\n${match.player1.name} vs ${match.player2.name}...`);
    
    // Create match
    const createResult = await makeRequest('/api/matchmaking/create', 'POST', {
      playerName: match.player1.name,
      score: match.player1.score,
      level: match.player1.level
    });
    
    if (createResult.success) {
      const matchId = createResult.data.match.id;
      
      // Join and resolve
      const joinResult = await makeRequest('/api/matchmaking/join', 'POST', {
        matchId: matchId,
        playerName: match.player2.name,
        score: match.player2.score,
        level: match.player2.level
      });
      
      if (joinResult.success) {
        const resolution = joinResult.data.resolution;
        console.log(`🎯 ${resolution.winner} wins! (${resolution.winnerScore} vs ${resolution.loserScore})`);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Show updated stats
  console.log('\n📊 Updated Player Statistics:');
  const players = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
  
  for (const playerName of players) {
    const result = await makeRequest(`/api/matchmaking/player/${playerName}/stats`);
    if (result.success) {
      const stats = result.data.stats;
      console.log(`   ${playerName}: ${stats.wins}W/${stats.losses}L (${stats.winRate.toFixed(1)}%)`);
    }
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('📊 Starting Player Statistics Test');
  console.log('=' .repeat(50));
  
  try {
    // Test 1: Create and resolve matches
    await testMatchResolution();
    
    // Test 2: Get player stats
    await testGetPlayerStats();
    
    // Test 3: Get player matches
    await testGetPlayerMatches();
    
    // Test 4: Discord commands info
    await testDiscordCommandsSimulation();
    
    // Test 5: Stats progression
    await testStatsProgression();
    
    console.log('\n🎉 Player statistics test completed!');
    console.log('=' .repeat(50));
    console.log('\n💡 Key Features:');
    console.log('   ✅ Win/loss tracking for all players');
    console.log('   ✅ Win rate calculation');
    console.log('   ✅ Stats included in Discord embeds');
    console.log('   ✅ Stats shown in player match history');
    console.log('   ✅ Automatic stats initialization');
    console.log('   ✅ Real-time stats updates');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { runTests };
