// Game services for Discord activity integration
export async function sendScoreToService(score) {
  try {
    // Get the server URL from environment or use a default
    const serverUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:3001' 
      : window.location.protocol + '//' + window.location.hostname; // Use same domain for production

    // Get player name from Discord activity or use a default
    const playerName = getPlayerName();
    
    // Send score to server
    const response = await fetch(`${serverUrl}/api/score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        playerName: playerName,
        score: score,
        level: 1, // Default level for circus game
        gameType: 'circus'
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('Score submitted successfully:', data);
      
      // Send message to parent window (Discord activity)
      window.parent.postMessage({
        type: 'submitHighScore',
        score: score,
        playerName: playerName,
        success: true
      }, '*');
      
      return data;
    } else {
      console.error('Failed to submit score:', data);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Error submitting score:', error);
    
    // Still send message to parent window even if server fails
    window.parent.postMessage({
      type: 'submitHighScore',
      score: score,
      success: false,
      error: error.message
    }, '*');
    
    return { success: false, error: error.message };
  }
}

// Get player name from Discord activity or use a default
function getPlayerName() {
  // Try to get player name from Discord activity context
  if (window.parent && window.parent !== window) {
    try {
      // This would be set by Discord activity
      const discordUser = window.parent.discordUser;
      if (discordUser && discordUser.username) {
        return discordUser.username;
      }
    } catch (e) {
      console.log('Could not get Discord user info:', e);
    }
  }
  
  // Fallback to a default name
  return 'Anonymous Player';
}

// Get high scores from server
export async function getHighScores(limit = 10) {
  try {
    const serverUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:3001' 
      : window.location.protocol + '//' + window.location.hostname; // Use same domain for production

    const response = await fetch(`${serverUrl}/api/highscores?limit=${limit}`);
    const data = await response.json();
    
    if (data.success) {
      return data.scores;
    } else {
      console.error('Failed to get high scores:', data);
      return [];
    }
  } catch (error) {
    console.error('Error getting high scores:', error);
    return [];
  }
} 