// netlify/functions/comprehensive-feed.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.handler = async function(event, context) {
  // Parse query parameters
  const params = event.queryStringParameters || {};
  const channelLimit = Math.min(parseInt(params.channelLimit || 20), 50); // How many channels to process
  const followerLimit = Math.min(parseInt(params.followerLimit || 10), 50); // Followers per channel
  const castLimit = Math.min(parseInt(params.castLimit || 5), 20); // Casts per follower
  const totalCastLimit = Math.min(parseInt(params.totalCastLimit || 100), 500); // Total casts to return
  
  try {
    // Step 1: Get all channels
    console.log('Fetching all channels...');
    const allChannelsResponse = await fetch('https://api.warpcast.com/v2/all-channels');
    
    if (!allChannelsResponse.ok) {
      throw new Error(`Failed to fetch all channels: ${allChannelsResponse.status} ${allChannelsResponse.statusText}`);
    }
    
    const allChannelsData = await allChannelsResponse.json();
    let channels = allChannelsData.result?.channels || [];
    
    // Sort channels by follower count and take top ones
    channels = channels
      .sort((a, b) => b.followerCount - a.followerCount)
      .slice(0, channelLimit);
    
    console.log(`Processing top ${channels.length} channels by follower count`);
    
    // Step 2: Get followers for each channel
    console.log('Fetching followers for each channel...');
    
    let allFollowerFids = new Set(); // Use a Set to avoid duplicates
    
    for (const channel of channels) {
      try {
        console.log(`Fetching followers for channel: ${channel.id}`);
        const followersResponse = await fetch(`https://api.warpcast.com/v1/channel-followers?channelId=${channel.id}&limit=${followerLimit}`);
        
        if (!followersResponse.ok) {
          console.error(`Failed to fetch followers for channel ${channel.id}: ${followersResponse.status}`);
          continue;
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
    }
    
    // Convert Set to Array
    const followerFids = Array.from(allFollowerFids);
    console.log(`Found ${followerFids.length} unique followers across ${channels.length} channels`);
    // Step 3: Get recent casts from each follower
    console.log('Fetching recent casts from followers...');
    
    let allCasts = [];
    
    // Process followers in smaller batches to avoid rate limiting
    const batchSize = 10;
    for (let i = 0; i < Math.min(followerFids.length, followerLimit); i += batchSize) {
      const batch = followerFids.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (fid) => {
        try {
          const castsResponse = await fetch(`https://api.warpcast.com/v2/casts?fid=${fid}&limit=${castLimit}`);
          
          if (!castsResponse.ok) {
            console.error(`Failed to fetch casts for user ${fid}: ${castsResponse.status}`);
            return;
          }
          
          const castsData = await castsResponse.json();
          const casts = castsData.result?.casts || [];
          
          // Add casts to our collection
          allCasts = allCasts.concat(casts);

          if (castsData.result?.casts && castsData.result.casts.length > 0) {
            console.log('Sample cast structure from Warpcast API:', 
              JSON.stringify(castsData.result.casts[0], null, 2));
          }
        } catch (error) {
          console.error(`Error fetching casts for user ${fid}:`, error);
        }
      }));
    }
    
    // Step 4: Sort casts by engagement (likes + recasts)
    allCasts = allCasts.map(cast => {
      console.log('Cast structure before formatting:', 
        JSON.stringify({
          text: cast.text,
          body: cast.body,
          castAddBody: cast.castAddBody,
          data: cast.data
        }, null, 2));
      
      return {
        ...cast,
        engagement: (cast.reactions?.count || 0) + (cast.recasts?.count || 0)
      };
    }).sort((a, b) => b.engagement - a.engagement)
      .slice(0, totalCastLimit);
    // Step 5: Format the data for API consumption
    const formattedCasts = allCasts.map(cast => ({
      id: cast.hash,
      author: {
        username: cast.author?.username,
        displayName: cast.author?.displayName,
        profileImage: cast.author?.pfp?.url,
        fid: cast.author?.fid
      },
      text: cast.text, 
      timestamp: cast.timestamp,
      engagement: {
        likes: cast.reactions?.count || 0,
        recasts: cast.recasts?.count || 0,
        replies: cast.replies?.count || 0,
        total: cast.engagement
      },
      embeds: cast.embeds || []
    }));
    
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
        message: error.message
      })
    };
  }
};