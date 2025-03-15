// netlify/functions/comprehensive-feed.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const config = require('./config');

eexports.handler = async function(event, context) {
  // Parse query parameters without max limits
  const params = event.queryStringParameters || {};
  const channelLimit = parseInt(params.channelLimit || 200); // How many channels to process
  const followerLimit = parseInt(params.followerLimit || 100); // Followers per channel
  const castLimit = parseInt(params.castLimit || 50); // Casts per follower
  const totalCastLimit = parseInt(params.totalCastLimit || 1000); // Total casts to return
  
  try {
    // Step 1: Get all channels
    console.log('Fetching all channels...');
    const allChannelsResponse = await fetch(endpoints.allChannels);
    
    if (!allChannelsResponse.ok) {
      throw new Error(`Failed to fetch all channels: ${allChannelsResponse.status} ${allChannelsResponse.statusText}`);
    }
    
    const allChannelsData = await allChannelsResponse.json();
    let channels = allChannelsData.result?.channels || [];
    
    if (channels.length === 0) {
      console.log('No channels returned from API. Raw response:', JSON.stringify(allChannelsData));
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          meta: {
            error: "No channels found",
            timestamp: new Date().toISOString()
          },
          casts: []
        })
      };
    }
    
    // Sort channels by follower count and take top ones
    channels = channels
      .sort((a, b) => b.followerCount - a.followerCount)
      .slice(0, channelLimit);
    
    console.log(`Processing top ${channels.length} channels by follower count`);
    
    // Step 2: Get followers for each channel
    console.log('Fetching followers for each channel...');
    
    let allFollowerFids = new Set(); // Use a Set to avoid duplicates
    
    // Process channels in smaller batches to avoid rate limiting
    const channelBatchSize = limits.channelBatchSize;
    for (let i = 0; i < channels.length; i += channelBatchSize) {
      const channelBatch = channels.slice(i, i + channelBatchSize);
      
      await Promise.all(channelBatch.map(async (channel) => {
        try {
          console.log(`Fetching followers for channel: ${channel.id}`);
          const followersResponse = await fetch(`${endpoints.channelFollowers}?channelId=${channel.id}&limit=${followerLimit}`);
          
          if (!followersResponse.ok) {
            console.error(`Failed to fetch followers for channel ${channel.id}: ${followersResponse.status}`);
            return;
          }
          
          const followersData = await followersResponse.json();
          const followers = followersData.result?.users || [];
          
          // Add followers to our set
          followers.forEach(follower => {
            if (follower.fid) {
              allFollowerFids.add(follower.fid);
            }
          });
        } catch (error) {
          console.error(`Error fetching followers for channel ${channel.id}:`, error);
        }
      }));
      
      // Add a small delay between batches to avoid rate limiting
      if (i + channelBatchSize < channels.length) {
        await new Promise(resolve => setTimeout(resolve, limits.channelBatchDelay));
      }
    }
    
    // Convert Set to Array
    const followerFids = Array.from(allFollowerFids);
    console.log(`Found ${followerFids.length} unique followers across ${channels.length} channels`);
    
    // If no followers found, return early with an informative message
    if (followerFids.length === 0) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          meta: {
            channels: channels.length,
            uniqueFollowers: 0,
            totalCastsCollected: 0,
            timestamp: new Date().toISOString(),
            message: "No followers found for the selected channels"
          },
          casts: []
        })
      };
    }
    
    // Step 3: Get recent casts from each follower
    console.log('Fetching recent casts from followers...');
    
    let allCasts = [];
    
    // Process followers in smaller batches to avoid rate limiting
    const followerBatchSize = limits.followerBatchSize;
    const maxFollowers = Math.min(followerFids.length, followerLimit);
    
    for (let i = 0; i < maxFollowers; i += followerBatchSize) {
      const batch = followerFids.slice(i, i + followerBatchSize);
      
      const batchPromises = batch.map(async (fid) => {
        try {
          const castsResponse = await fetch(`${endpoints.userCasts}?fid=${fid}&limit=${castLimit}`);
          
          if (!castsResponse.ok) {
            console.error(`Failed to fetch casts for user ${fid}: ${castsResponse.status}`);
            return [];
          }
          
          const castsData = await castsResponse.json();
          return castsData.result?.casts || [];
        } catch (error) {
          console.error(`Error fetching casts for user ${fid}:`, error);
          return [];
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(casts => {
        allCasts = allCasts.concat(casts);
      });
      
      // Add a small delay between batches to avoid rate limiting
      if (i + followerBatchSize < maxFollowers) {
        await new Promise(resolve => setTimeout(resolve, limits.followerBatchDelay));
      }
    }
    
    console.log(`Fetched ${allCasts.length} casts in total`);
    
    // If no casts found, return early with an informative message
    if (allCasts.length === 0) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          meta: {
            channels: channels.length,
            uniqueFollowers: followerFids.length,
            totalCastsCollected: 0,
            timestamp: new Date().toISOString(),
            message: "No casts found from the followers"
          },
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
        "Access-Control-Allow-Origin": "*" // Allow cross-origin requests
      },
      body: JSON.stringify({
        meta: {
          channels: channels.length,
          uniqueFollowers: followerFids.length,
          totalCastsCollected: allCasts.length,
          timestamp: new Date().toISOString()
        },
        casts: formattedCasts
      })
    };
  } catch (error) {
    console.error('Error in comprehensive feed:', error);
    
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        error: 'Failed to generate comprehensive feed',
        message: error.message,
        stack: error.stack // Include stack trace for debugging
      })
    };
  }
};