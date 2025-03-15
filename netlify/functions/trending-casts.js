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
    // Construct the API URL
    let apiUrl = `https://api.warpcast.com/v2/trending-casts?timeframe=${timeframe}&limit=${limit}`;
    if (filter) {
      apiUrl += `&filter=${encodeURIComponent(filter)}`;
    }
    
    // Make the request to Warpcast's public API
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Warpcast API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Return formatted response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        // Add cache headers to respect rate limits
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      },
      body: JSON.stringify({
        casts: data.result.casts || [],
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