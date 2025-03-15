// netlify/functions/warpcast-api.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Import handlers for specialized functionality
const comprehensiveFeedHandler = require('./comprehensive-feed');
const tokenBalancesHandler = require('./token-balances');

exports.handler = async function(event, context) {
  // Parse query parameters
  const params = event.queryStringParameters || {};
  
  try {
    // Route based on the parameters provided
    
    // COMPREHENSIVE FEED
    if (params.comprehensiveFeed === 'true') {
      return await comprehensiveFeedHandler.handler(event, context);
    }
    
    // TOKEN BALANCES
    if (params.username && (params.tokenAddress || process.env.TOKEN_ADDRESS)) {
      return await tokenBalancesHandler.handler(event, context);
    }
    
    // CAST REPLIES - New functionality
    if (params.castReplies === 'true' || (params.parentFid && params.parentHash) || params.castUrl) {
      const fid = params.parentFid;
      const hash = params.parentHash;
      const url = params.castUrl;
      const limit = Math.min(parseInt(params.limit || 20), 100);
      const cursor = params.cursor || '';
      
      if ((!fid || !hash) && !url) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: 'Missing required parameters: either (parentFid AND parentHash) OR castUrl must be provided'
          })
        };
      }
      
      let apiUrl;
      if (url) {
        apiUrl = `https://api.warpcast.com/v2/cast-replies-by-url?url=${encodeURIComponent(url)}&limit=${limit}`;
      } else {
        apiUrl = `https://api.warpcast.com/v2/cast-replies?fid=${fid}&hash=${hash}&limit=${limit}`;
      }
      
      if (cursor) {
        apiUrl += `&cursor=${cursor}`;
      }
      
      console.log(`Fetching cast replies from: ${apiUrl}`);
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch cast replies: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          replies: data.result?.casts || [],
          nextCursor: data.result?.next?.cursor || null
        })
      };
    }
    
    // CAST MENTIONS - New functionality
    if (params.castMentions === 'true' || params.mentionFid) {
      const fid = params.mentionFid;
      const limit = Math.min(parseInt(params.limit || 20), 100);
      const cursor = params.cursor || '';
      
      if (!fid) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: 'Missing required parameter: mentionFid'
          })
        };
      }
      
      let apiUrl = `https://api.warpcast.com/v2/mentions?fid=${fid}&limit=${limit}`;
      
      if (cursor) {
        apiUrl += `&cursor=${cursor}`;
      }
      
      console.log(`Fetching mentions from: ${apiUrl}`);
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch mentions: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          mentions: data.result?.casts || [],
          nextCursor: data.result?.next?.cursor || null
        })
      };
    }
    
    // ALL CHANNELS
    if (params.allChannels === 'true') {
      const limit = Math.min(parseInt(params.limit || 100), 100);
      
      const response = await fetch(`https://api.warpcast.com/v2/channels?limit=${limit}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch channels: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          channels: data.result?.channels || []
        })
      };
    }
    
    // CHANNEL INFORMATION
    if (params.channelId) {
      const channelId = params.channelId;
      
      const response = await fetch(`https://api.warpcast.com/v2/channel?id=${channelId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch channel: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          channel: data.result?.channel || null
        })
      };
    }
    
    // USER INFORMATION (without token balance)
    if (params.username && !params.tokenAddress && !process.env.TOKEN_ADDRESS) {
      const username = params.username;
      
      // Step 1: Find the user's FID by username
      const userResponse = await fetch(`https://api.warpcast.com/v2/user-by-username?username=${username}`);
      
      if (!userResponse.ok) {
        throw new Error(`Failed to find user: ${userResponse.status} ${userResponse.statusText}`);
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
      
      // Step 2: Get the user's Ethereum address
      const addressResponse = await fetch(`https://api.warpcast.com/v2/user-by-fid?fid=${fid}`);
      
      if (!addressResponse.ok) {
        throw new Error(`Failed to get user details: ${addressResponse.status} ${addressResponse.statusText}`);
      }
      
      const addressData = await addressResponse.json();
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          user: addressData.result?.user || null
        })
      };
    }
    
    // If no valid parameters were provided
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Missing or invalid parameters. Please specify one of: comprehensiveFeed, allChannels, channelId, username, castReplies, or castMentions'
      })
    };
    
  } catch (error) {
    console.error('Error processing request:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to process request',
        details: error.message
      })
    };
  }
};