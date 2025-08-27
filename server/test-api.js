import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

// Test API endpoints
async function testAPI() {
  console.log('🧪 Testing API endpoints...\n');

  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch(`${BASE_URL}/api/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);
    console.log('');

    // Test posting a score
    console.log('2. Testing score posting...');
    const scoreData = {
      playerName: 'TestPlayer',
      score: 42, // bricks destroyed
      level: 5,
      bricksDestroyed: 42,
      discordUserId: 'test123'
    };
    
    const scoreResponse = await fetch(`${BASE_URL}/api/score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(scoreData)
    });
    
    if (scoreResponse.ok) {
      const scoreResult = await scoreResponse.json();
      console.log('✅ Score posted successfully:', scoreResult);
    } else {
      console.log('⚠️  Score posting failed (this is expected if Discord bot is not configured)');
      console.log('Status:', scoreResponse.status);
    }
    console.log('');

    // Test getting high scores
    console.log('3. Testing high scores endpoint...');
    const highscoresResponse = await fetch(`${BASE_URL}/api/highscores?limit=5`);
    const highscoresData = await highscoresResponse.json();
    console.log('✅ High scores:', highscoresData);
    console.log('');

    // Test getting player score
    console.log('4. Testing player score endpoint...');
    const playerResponse = await fetch(`${BASE_URL}/api/player/TestPlayer/score`);
    const playerData = await playerResponse.json();
    console.log('✅ Player score:', playerData);
    console.log('');

    // Test getting non-existent player
    console.log('5. Testing non-existent player...');
    const nonExistentResponse = await fetch(`${BASE_URL}/api/player/NonExistentPlayer/score`);
    console.log('✅ Non-existent player response status:', nonExistentResponse.status);
    console.log('');

    console.log('🎉 All API tests completed!');

  } catch (error) {
    console.error('❌ API test failed:', error.message);
    console.log('\n💡 Make sure the server is running on port 3001');
  }
}

// Run the test
testAPI();
