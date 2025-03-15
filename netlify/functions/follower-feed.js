// netlify/functions/follower-feed.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const config = require('./config');

exports.handler = async function(event, context) {
  // Parse query parameters
  const params = event.queryStringParameters || {};
  const channelId = params.channelId; // Required parameter
  const followerLimit = parseInt(params.followerLimit || 100); // Default to 100, no artificial max
  const castLimit = parseInt(params.castLimit || 10); // Casts per follower
  const totalCastLimit = parseInt(params.totalCastLimit || 100); // Total casts to return
  
  // Validate required parameters
  if (!channelId) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        error: "Missing required parameter: channelId"
      })
    };
  }
  
  try {
    // Step 1: Get channel details
    console.log(`Fetching details for channel: ${channelId}...`);
    const channelResponse = await fetch(`${endpoints.channelDetails}?channelId=${channelId}`);
    
    if (!channelResponse.ok) {
      throw new Error(`Failed to fetch channel details: ${channelResponse.status} ${channelResponse.statusText}`);
    }
    
    const channelData = await channelResponse.json();
    const channel = channelData.result?.channel;
    
    if (!channel) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          error: `Channel not found: ${channelId}`
        })
      };
    }
    
    // Step 2: Get followers for the channel
    console.log(`Fetching followers for channel: ${channelId}`);
    const followersResponse = await fetch(`${endpoints.channelFollowers}?channelId=${channelId}&limit=${followerLimit}`);
    
    if (!followersResponse.ok) {
      throw new Error(`Failed to fetch followers: ${followersResponse.status} ${followersResponse.statusText}`);
    }
    
    const followersData = await followersResponse.json();
    const followers = followersData.result?.users || [];
    
    if (followers.length === 0) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          meta: {
            channel: {
              id: channel.id,
              name: channel.name,
              followerCount: channel.followerCount
            },
            followersCount: 0,
            totalCastsCollected: 0,
            timestamp: new Date().toISOString(),
            message: "No followers found for this channel"
          },
          followers: [],
          casts: []
        })
      };
    }
    
    console.log(`Found ${followers.length} followers for channel ${channelId}`);
    
    // Step 3: Get recent casts from each follower
    console.log('Fetching recent casts from followers...');
    
    let allCasts = [];
    
    // Process followers in smaller batches to avoid rate limiting
    const followerBatchSize = limits.followerBatchSize;
    
    for (let i = 0; i < followers.length; i += followerBatchSize) {
      const batch = followers.slice(i, i + followerBatchSize);
      
      const batchPromises = batch.map(async (follower) => {
        try {
          if (!follower.fid) return [];
          
          const castsResponse = await fetch(`${endpoints.userCasts}?fid=${follower.fid}&limit=${castLimit}`);
          
          if (!castsResponse.ok) {
            console.error(`Failed to fetch casts for user ${follower.fid}: ${castsResponse.status}`);
            return [];
          }
          
          const castsData = await castsResponse.json();
          return castsData.result?.casts || [];
        } catch (error) {
          console.error(`Error fetching casts for user ${follower.fid}:`, error);
          return [];
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(casts => {
        allCasts = allCasts.concat(casts);
      });
      
      // Add a small delay between batches to avoid rate limiting
      if (i + followerBatchSize < followers.length) {
        await new Promise(resolve => setTimeout(resolve, limits.followerBatchDelay));
      }
    }
    
    console.log(`Fetched ${allCasts.length} casts in total`);
    
    // Format the followers data for the response
    const formattedFollowers = followers.map(follower => ({
      fid: follower.fid,
      username: follower.username,
      displayName: follower.displayName,
      pfp: follower.pfp?.url,
      bio: follower.profile?.bio?.text,
      followerCount: follower.followerCount,
      followingCount: follower.followingCount
    }));
    
    // If no casts found, return early with followers but empty casts
    if (allCasts.length === 0) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          meta: {
            channel: {
              id: channel.id,
              name: channel.name,
              followerCount: channel.followerCount
            },
            followersCount: followers.length,
            totalCastsCollected: 0,
            timestamp: new Date().toISOString(),
            message: "No casts found from the followers"
          },
          followers: formattedFollowers,
          casts: []
        })
      };
    }
    
    // Step 4: Sort casts by engagement (likes + recasts)
    allCasts = allCasts.map(cast => {
      const engagement = (cast.reactions?.count || 0) + (cast.recasts?.count || 0);
      return {
        ...cast,
        engagement
      };
    }).sort((a, b) => b.engagement - a.engagement)
      .slice(0, totalCastLimit);
    
    // Step 5: Format the data for API consumption
    const formattedCasts = allCasts.map(cast => {
      // Extract text from the appropriate field
      let text = '';
      if (cast.text) {
        text = cast.text;
      } else if (cast.castAddBody && cast.castAddBody.text) {
        text = cast.castAddBody.text;
      } else if (cast.body && cast.body.text) {
        text = cast.body.text;
      }
      
      return {
        id: cast.hash,
        author: {
          username: cast.author?.username,
          displayName: cast.author?.displayName,
          profileImage: cast.author?.pfp?.url,
          fid: cast.author?.fid
        },
        text: text,
        timestamp: cast.timestamp,
        engagement: {
          likes: cast.reactions?.count || 0,
          recasts: cast.recasts?.count || 0,
          replies: cast.replies?.count || 0,
          total: cast.engagement
        },
        embeds: cast.embeds || []
      };
    });
    
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        meta: {
          channel: {
            id: channel.id,
            name: channel.name,
            followerCount: channel.followerCount
          },
          followersCount: followers.length,
          totalCastsCollected: allCasts.length,
          timestamp: new Date().toISOString()
        },
        followers: formattedFollowers,
        casts: formattedCasts
      })
    };
  } catch (error) {
    console.error('Error in follower feed:', error);
    
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        error: 'Failed to generate follower feed',
        message: error.message
      })
    };
  }
};

const { endpoints, limits } = config;
