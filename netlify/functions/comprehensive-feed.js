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
        
        // Add follower FIDs to our set
        followers.forEach(follower => {
          allFollowerFids.add(follower.fid);
        });
        
        console.log(`Added ${followers.length} followers from channel ${channel.id}`);
      } catch (error) {
        console.error(`Error processing followers for channel ${channel.id}:`, error);
      }
    }
    
    // Convert Set to Array
    const followerFids = Array.from(allFollowerFids);
    console.log(`Found ${followerFids.length} unique followers across all channels`);
    
    // Step 3: Get casts from each follower
    console.log('Fetching casts from followers...');
    
    let allCasts = [];
    
    // Process followers in batches to avoid overloading the API
    const batchSize = 10;
    for (let i = 0; i < followerFids.length; i += batchSize) {
      const batch = followerFids.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (fid) => {
          try {
            const castsResponse = await fetch(`https://hub.farcaster.xyz/v1/castsByFid?fid=${fid}`);
            
            if (!castsResponse.ok) {
              console.error(`Failed to fetch casts for FID ${fid}: ${castsResponse.status}`);
              return [];
            }
            
            const castsData = await castsResponse.json();
            const casts = castsData.messages || [];
            
            // Format and return most recent casts
            return casts
              .slice(0, castLimit)
              .map(cast => ({
                fid: cast.data.fid,
                timestamp: cast.data.timestamp,
                text: cast.data.castAddBody?.text || '',
                hash: cast.hash,
                mentions: cast.data.castAddBody?.mentions || [],
                embeds: cast.data.castAddBody?.embeds || []
              }));
          } catch (error) {
            console.error(`Error fetching casts for FID ${fid}:`, error);
            return [];
          }
        })
      );
      
      // Add batch results to all casts
      allCasts = allCasts.concat(batchResults.flat());
      
      console.log(`Processed batch ${i/batchSize + 1}/${Math.ceil(followerFids.length/batchSize)}, total casts: ${allCasts.length}`);
      
      // Respect total cast limit
      if (allCasts.length >= totalCastLimit) {
        allCasts = allCasts.slice(0, totalCastLimit);
        break;
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Sort all casts by timestamp (newest first)
    allCasts.sort((a, b) => b.timestamp - a.timestamp);
    
    // Return the comprehensive feed
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      },
      body: JSON.stringify({
        channels: channels.length,
        uniqueFollowers: followerFids.length,
        castsCollected: allCasts.length,
        casts: allCasts,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Error building comprehensive feed:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to build comprehensive feed',
        message: error.message
      })
    };
  }
};