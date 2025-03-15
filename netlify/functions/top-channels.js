// netlify/functions/top-channels.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.handler = async function(event, context) {
  // Parse query parameters
  const params = event.queryStringParameters || {};
  const limit = Math.min(parseInt(params.limit || 10), 50); // Limit the number of channels
  
  try {
    // Step 1: Get all channels
    console.log('Fetching all channels...');
    const allChannelsResponse = await fetch('https://api.warpcast.com/v2/all-channels');
    
    if (!allChannelsResponse.ok) {
      throw new Error(`Failed to fetch all channels: ${allChannelsResponse.status} ${allChannelsResponse.statusText}`);
    }
    
    const allChannelsData = await allChannelsResponse.json();
    let channels = allChannelsData.result?.channels || [];
    
    // Step 2: Sort channels by follower count and take the top ones
    channels = channels
      .sort((a, b) => b.followerCount - a.followerCount)
      .slice(0, limit);
    
    console.log(`Found ${channels.length} channels, getting details for each...`);
    
    // Step 3: Get detailed info for each top channel
    const channelDetails = await Promise.all(
      channels.map(async (channel) => {
        try {
          const channelResponse = await fetch(`https://api.warpcast.com/v1/channel?channelId=${channel.id}`);
          
          if (!channelResponse.ok) {
            console.error(`Failed to fetch details for channel ${channel.id}: ${channelResponse.status}`);
            return {
              ...channel,
              error: `Failed to fetch details: ${channelResponse.status}`
            };
          }
          
          const channelData = await channelResponse.json();
          return channelData.result?.channel || channel;
        } catch (error) {
          console.error(`Error fetching details for channel ${channel.id}:`, error);
          return {
            ...channel,
            error: error.message
          };
        }
      })
    );
    
    // Return the results
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      },
      body: JSON.stringify({
        channels: channelDetails,
        count: channelDetails.length,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Error fetching top channels:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to fetch top channels',
        message: error.message
      })
    };
  }
};