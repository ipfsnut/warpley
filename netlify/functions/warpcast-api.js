// netlify/functions/warpcast-api.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.handler = async function(event, context) {
  // Parse query parameters
  const params = event.queryStringParameters || {};
  
  try {
    // Check which API endpoint to call
    if (params.allChannels === 'true') {
      // Get all channels
      return await getAllChannels(params);
    } else if (params.channelId) {
      // Get specific channel info
      return await getChannel(params.channelId);
    } else if (params.username) {
      // Get user address info
      return await getUserAddress(params.username, params.tokenAddress);
    } else {
      // Default response with available endpoints
      return {
        statusCode: 200,
        body: JSON.stringify({
          available_endpoints: {
            "allChannels": "Get all channels with ?allChannels=true",
            "channelId": "Get specific channel with ?channelId=CHANNEL_ID",
            "username": "Get user address with ?username=USERNAME and optional &tokenAddress=TOKEN_ADDRESS"
          },
          timestamp: new Date().toISOString()
        })
      };
    }
  } catch (error) {
    console.error('Error in Warpcast API:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to fetch from Warpcast API',
        message: error.message
      })
    };
  }
};

/**
 * Get all channels - Note: This is a hypothetical function that might not work
 * as we haven't confirmed an endpoint that lists all channels
 */
async function getAllChannels(params = {}) {
  const limit = Math.min(parseInt(params.limit || 100), 100);
  
  try {
    // We're attempting this endpoint based on API naming patterns, but it might not work
    const response = await fetch(`https://api.warpcast.com/v2/all-channels`);
    
    if (!response.ok) {
      throw new Error(`Warpcast API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Sort channels by follower count if requested
    let channels = data.result?.channels || [];
    
    if (params.sortBy === 'followers' || !params.sortBy) {
      channels = channels.sort((a, b) => b.followerCount - a.followerCount);
    }
    
    // Limit the results
    channels = channels.slice(0, limit);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      },
      body: JSON.stringify({
        channels,
        count: channels.length,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Error fetching all channels:', error);
    throw error;
  }
}

/**
 * Get specific channel information - This is confirmed to work
 */
async function getChannel(channelId) {
  if (!channelId) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Missing required parameter: channelId'
      })
    };
  }
  
  try {
    // Use the confirmed working endpoint
    const response = await fetch(`https://api.warpcast.com/v1/channel?channelId=${channelId}`);
    
    if (!response.ok) {
      throw new Error(`Warpcast API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      },
      body: JSON.stringify({
        channel: data.result?.channel,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error(`Error fetching channel ${channelId}:`, error);
    throw error;
  }
}

/**
 * Get user's Ethereum address and token balance - This is confirmed to work
 * but requires a way to get FID from username
 */
async function getUserAddress(username, tokenAddress) {
  if (!username) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Missing required parameter: username'
      })
    };
  }
  
  try {
    // First, try to get the user's information to find their FID
    // This is hypothetical and needs to be confirmed
    const userResponse = await fetch(`https://api.warpcast.com/v2/user-by-username?username=${username}`);
    
    if (!userResponse.ok) {
      throw new Error(`Warpcast API returned ${userResponse.status}: ${userResponse.statusText}`);
    }
    
    const userData = await userResponse.json();
    const fid = userData.result?.user?.fid;
    
    if (!fid) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'User not found or FID not available'
        })
      };
    }
    
    // Now get the user's Ethereum address - this endpoint is confirmed to work
    const addressResponse = await fetch(`https://api.warpcast.com/fc/primary-address?fid=${fid}&protocol=ethereum`);
    
    if (!addressResponse.ok) {
      throw new Error(`Warpcast API returned ${addressResponse.status}: ${addressResponse.statusText}`);
    }
    
    const addressData = await addressResponse.json();
    const ethAddress = addressData.result?.address?.address;
    
    if (!ethAddress) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'User has no Ethereum address'
        })
      };
    }
    
    // If token address was provided, get token balance
    let tokenBalance = null;
    if (tokenAddress) {
      // Use Etherscan API to get token balance
      const etherscanApiKey = process.env.ETHERSCAN_API_KEY || '';
      const balanceUrl = `https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=${tokenAddress}&address=${ethAddress}&tag=latest${etherscanApiKey ? `&apikey=${etherscanApiKey}` : ''}`;
      
      const balanceResponse = await fetch(balanceUrl);
      
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        if (balanceData.status === '1') {
          tokenBalance = balanceData.result;
        }
      }
    }
    
    // Return the user address and optional token balance
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      },
      body: JSON.stringify({
        username,
        fid,
        ethAddress,
        tokenAddress,
        tokenBalance,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error(`Error fetching address for ${username}:`, error);
    throw error;
  }
}