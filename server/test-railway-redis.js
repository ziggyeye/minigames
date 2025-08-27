import { createClient } from 'redis';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🚂 Railway Redis Connection Test');
console.log('================================');

// Log environment info
console.log('Environment Variables:');
console.log('- REDIS_URL:', process.env.REDIS_URL ? 'Set' : 'Not set');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'Not set');
console.log('');

// Create Redis client with Railway-specific settings
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  socket: {
    connectTimeout: 30000, // 30 seconds for Railway
    lazyConnect: true,
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.log('Too many Redis reconnection attempts, giving up');
        return false;
      }
      const delay = Math.min(retries * 1000, 5000);
      console.log(`Redis reconnection attempt ${retries} in ${delay}ms`);
      return delay;
    }
  }
});

// Enhanced error handling
redisClient.on('error', (err) => {
  console.log('❌ Redis Error:', err.message);
  console.log('Error Code:', err.code);
  console.log('Error Address:', err.address);
  console.log('Error Port:', err.port);
});

redisClient.on('connect', () => {
  console.log('🔗 Redis Connected');
});

redisClient.on('ready', () => {
  console.log('✅ Redis Ready');
});

redisClient.on('end', () => {
  console.log('🔌 Redis Disconnected');
});

// Test connection
async function testRailwayRedis() {
  try {
    console.log('🔄 Attempting to connect to Redis...');
    
    if (process.env.REDIS_URL) {
      console.log('📍 Using Railway Redis URL');
    } else {
      console.log('📍 Using localhost Redis (for testing)');
    }
    
    await redisClient.connect();
    console.log('✅ Successfully connected to Redis!');
    
    // Test basic operations
    console.log('\n🧪 Testing basic operations...');
    
    // Set a test key
    await redisClient.set('railway:test', 'Hello from Railway!');
    console.log('✅ Set test key');
    
    // Get the test key
    const value = await redisClient.get('railway:test');
    console.log('✅ Retrieved test key:', value);
    
    // Test high score functionality
    console.log('\n🏆 Testing high score functionality...');
    
    const testScore = {
      playerName: 'RailwayTest',
      score: 89, // bricks destroyed
      level: 10,
      timestamp: Date.now()
    };
    
    // Save to high scores
    await redisClient.zAdd('breakout:high_scores', {
      score: testScore.score,
      value: JSON.stringify(testScore)
    });
    console.log('✅ Added test score to high scores');
    
    // Get high scores
    const scores = await redisClient.zRange('breakout:high_scores', 0, 9, { REV: true });
    console.log('✅ Retrieved high scores:', scores.length, 'scores found');
    
    // Clean up
    await redisClient.del('railway:test');
    await redisClient.zRem('breakout:high_scores', JSON.stringify(testScore));
    console.log('✅ Cleaned up test data');
    
    console.log('\n🎉 Railway Redis test completed successfully!');
    
  } catch (error) {
    console.error('❌ Railway Redis test failed:', error.message);
    console.log('\n💡 Troubleshooting tips:');
    console.log('1. Make sure Redis volume is added to your Railway project');
    console.log('2. Check that REDIS_URL environment variable is set');
    console.log('3. Verify the Redis service is running in Railway');
    console.log('4. Check Railway logs for Redis connection issues');
  } finally {
    if (redisClient.isOpen) {
      await redisClient.disconnect();
      console.log('🔌 Disconnected from Redis');
    }
  }
}

// Run the test
testRailwayRedis();
