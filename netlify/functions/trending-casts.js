// netlify/functions/trending-casts.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.handler = async function(event, context) {
  // Allow specifying time frame (default: 24h)
  const timeframe = event.queryStringParameters?.timeframe || '24h';
  // Allow specifying limit (default: 100, max: 100)
  const limit = Math.min(parseInt(event.queryStringParameters?.limit || 100), 100);
  // Optional topic filter
  const filter = event.queryStringParameters?.filter || '';
  
  try {
    // Use the correct Farcaster (Warpcast) API endpoint
    // Note: This endpoint might need an API key - checking public API docs
    let apiUrl = 'https://api.neynar.com/v2/farcaster/feed/trending';
    
    // Build query parameters
    const params = new URLSearchParams();
    if (timeframe === '24h') params.append('feed_type', 'popular');
    else if (timeframe === '7d') params.append('feed_type', 'popular_7d');
    else params.append('feed_type', 'popular'); // Default to popular
    
    params.append('limit', limit.toString());
    if (filter) params.append('with_recasts', 'true'); // We'll filter later
    
    // Add API key if available
    const apiKey = process.env.NEYNAR_API_KEY || 'NEYNAR_API_UR743U79VP';
    
    // Make the request to Farcaster API
    const response = await fetch(`${apiUrl}?${params.toString()}`, {
      headers: {
        'accept': 'application/json',
        'api_key': apiKey
      }
    });
    
    if (!response.ok) {
      throw new Error(`Farcaster API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Extract and format casts
    let casts = data.casts || [];
    
    // Apply manual filtering if needed
    if (filter) {
      const filterLower = filter.toLowerCase();
      casts = casts.filter(cast => 
        cast.text && cast.text.toLowerCase().includes(filterLower)
      );
    }
    
    // Limit to requested amount after filtering
    casts = casts.slice(0, limit);
    
    // Format to match our expected schema
    const formattedCasts = casts.map(cast => ({
      text: cast.text || '',
      timestamp: cast.timestamp,
      author: {
        username: cast.author.username || cast.author.display_name || 'unknown',
        displayName: cast.author.display_name || '',
        pfp: cast.author.pfp_url || ''
      },
      reactions: {
        count: cast.reactions.likes || 0
      },
      replies: {
        count: cast.replies.count || 0
      }
    }));
    
    // Return formatted response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      },
      body: JSON.stringify({
        casts: formattedCasts,
        timeframe,
        filter: filter || undefined,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Error fetching trending casts:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to fetch trending casts',
        message: error.message
      })
    };
  }
};