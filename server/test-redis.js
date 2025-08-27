import { createClient } from 'redis';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
});

// Test Redis connection and high score functionality
async function testRedis() {
  try {
    console.log('Connecting to Redis...');
    await redisClient.connect();
    console.log('✅ Successfully connected to Redis');

    // Test basic operations
    console.log('\n🧪 Testing basic Redis operations...');
    
    // Set a test key
    await redisClient.set('test:key', 'test:value');
    console.log('✅ Set test key');
    
    // Get the test key
    const testValue = await redisClient.get('test:key');
    console.log('✅ Retrieved test key:', testValue);
    
    // Test high score functionality
    console.log('\n🏆 Testing high score functionality...');
    
    const HIGH_SCORES_KEY = 'breakout:high_scores';
    const PLAYER_SCORES_KEY = 'breakout:player_scores';
    
    // Add some test scores (bricks destroyed)
    const testScores = [
      { playerName: 'Alice', score: 45, level: 3, timestamp: Date.now() },
      { playerName: 'Bob', score: 67, level: 4, timestamp: Date.now() },
      { playerName: 'Charlie', score: 52, level: 3, timestamp: Date.now() },
      { playerName: 'Alice', score: 58, level: 4, timestamp: Date.now() }, // Should update Alice's score
    ];
    
    for (const scoreData of testScores) {
      // Save individual player's best score
      const playerKey = `${PLAYER_SCORES_KEY}:${scoreData.playerName}`;
      const existingScore = await redisClient.get(playerKey);
      
      if (!existingScore || scoreData.score > JSON.parse(existingScore).score) {
        await redisClient.set(playerKey, JSON.stringify(scoreData));
        console.log(`✅ Updated ${scoreData.playerName}'s score to ${scoreData.score}`);
      } else {
        console.log(`⏭️  ${scoreData.playerName}'s score ${scoreData.score} is not higher than existing`);
      }
      
      // Add to global high scores
      await redisClient.zAdd(HIGH_SCORES_KEY, {
        score: scoreData.score,
        value: JSON.stringify(scoreData)
      });
    }
    
    // Get top scores
    const topScores = await redisClient.zRange(HIGH_SCORES_KEY, 0, 9, { REV: true });
    console.log('\n🏅 Top 10 Brick Destroyers:');
    topScores.forEach((score, index) => {
      const scoreData = JSON.parse(score);
      console.log(`${index + 1}. ${scoreData.playerName}: ${scoreData.score} bricks (Level ${scoreData.level})`);
    });
    
    // Get Alice's best score
    const aliceScore = await redisClient.get(`${PLAYER_SCORES_KEY}:Alice`);
    console.log('\n👤 Alice\'s best score:', aliceScore ? JSON.parse(aliceScore) : 'None');
    
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await redisClient.del('test:key');
    await redisClient.del(HIGH_SCORES_KEY);
    await redisClient.del(`${PLAYER_SCORES_KEY}:Alice`);
    await redisClient.del(`${PLAYER_SCORES_KEY}:Bob`);
    await redisClient.del(`${PLAYER_SCORES_KEY}:Charlie`);
    console.log('✅ Test data cleaned up');
    
    console.log('\n🎉 All Redis tests passed!');
    
  } catch (error) {
    console.error('❌ Redis test failed:', error);
  } finally {
    await redisClient.disconnect();
    console.log('🔌 Disconnected from Redis');
  }
}

// Run the test
testRedis();
