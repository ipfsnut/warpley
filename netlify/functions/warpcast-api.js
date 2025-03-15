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
        // For URL-based queries, we'll need to extract the FID and hash from the URL
        // This is a placeholder - you might need a different approach
        apiUrl = `https://api.warpcast.com/v2/casts-by-url?url=${encodeURIComponent(url)}&limit=${limit}`;
      } else {
        // Using the pattern from working comprehensive-feed.js
        apiUrl = `https://api.warpcast.com/v2/casts?parentFid=${fid}&parentHash=${hash}&limit=${limit}`;
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
      
      // Using the pattern from working comprehensive-feed.js but with mentions
      let apiUrl = `https://api.warpcast.com/v2/casts?mentionedFid=${fid}&limit=${limit}`;
      
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
      
      // Using the working endpoint from comprehensive-feed.js
      const response = await fetch('https://api.warpcast.com/v2/all-channels');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch channels: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Sort channels by follower count and take top ones if limit is specified
      let channels = data.result?.channels || [];
      if (limit) {
        channels = channels
          .sort((a, b) => b.followerCount - a.followerCount)
          .slice(0, limit);
      }
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          channels: channels
        })
      };
    }
    
    // CHANNEL INFORMATION
    if (params.channelId) {
      const channelId = params.channelId;
      
      // Using the pattern from working comprehensive-feed.js
      // First get all channels, then filter for the one we want
      const response = await fetch('https://api.warpcast.com/v2/all-channels');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch channels: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const channels = data.result?.channels || [];
      const channel = channels.find(c => c.id === channelId);
      
      if (!channel) {
        return {
          statusCode: 404,
          body: JSON.stringify({
            error: `Channel with ID ${channelId} not found`
          })
        };
      }
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          channel: channel
        })
      };
    }
    
    // USER INFORMATION (without token balance)
    if (params.username && !params.tokenAddress && !process.env.TOKEN_ADDRESS) {
      const username = params.username;
      
      // Step 1: Find the user by username
      const userResponse = await fetch(`https://api.warpcast.com/v2/user-by-username?username=${username}`);
      
      if (!userResponse.ok) {
        throw new Error(`Failed to find user: ${userResponse.status} ${userResponse.statusText}`);
      }
      
      const userData = await userResponse.json();
      const user = userData.result?.user;
      
      if (!user) {
        return {
          statusCode: 404,
          body: JSON.stringify({
            error: 'User not found'
          })
        };
      }
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          user: user
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
