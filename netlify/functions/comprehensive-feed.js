const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.handler = async function(event, context) {
  // Parse query parameters
  const params = event.queryStringParameters || {};
  
  // Configuration parameters
  const channelLimit = Math.min(parseInt(params.channelLimit || 20), 50);
  const followerLimit = Math.min(parseInt(params.followerLimit || 10), 50);
  const castLimit = Math.min(parseInt(params.castLimit || 5), 20);
  const totalCastLimit = Math.min(parseInt(params.totalCastLimit || 100), 500);
  
  // New parameters for replies
  const includeReplies = params.includeReplies === 'true';
  const repliesPerCast = Math.min(parseInt(params.repliesPerCast || 3), 10);
  const replySortBy = params.replySortBy || 'engagement'; // 'engagement', 'recent'
  
  try {
    console.log('Generating comprehensive feed...');
    
    // Fetch top channels
    console.log(`Fetching top ${channelLimit} channels...`);
    const channelsResponse = await fetch(`https://api.warpcast.com/v2/channels?limit=${channelLimit}`);
    
    if (!channelsResponse.ok) {
      throw new Error(`Failed to fetch channels: ${channelsResponse.status} ${channelsResponse.statusText}`);
    }
    
    const channelsData = await channelsResponse.json();
    const topChannels = channelsData.result?.channels || [];
    
    // Array to store all casts
    let allCasts = [];
    
    // Process each channel
    for (const channel of topChannels) {
      console.log(`Processing channel: ${channel.name}`);
      
      // Get channel casts
      const castsResponse = await fetch(`https://api.warpcast.com/v2/channel-casts?channelId=${channel.id}&limit=${castLimit}`);
      
      if (!castsResponse.ok) {
        console.error(`Failed to fetch casts for channel ${channel.name}: ${castsResponse.status} ${castsResponse.statusText}`);
        continue;
      }
      
      const castsData = await castsResponse.json();
      const channelCasts = castsData.result?.casts || [];
      
      // Add channel information to each cast
      channelCasts.forEach(cast => {
        cast.sourceChannel = {
          id: channel.id,
          name: channel.name
        };
        cast.isReply = false; // Mark as original cast, not a reply
      });
      
      // If including replies, fetch them for each cast
      if (includeReplies) {
        for (const cast of channelCasts) {
          try {
            console.log(`Fetching replies for cast by @${cast.author.username}...`);
            
            const repliesResponse = await fetch(
              `https://api.warpcast.com/v2/cast-replies?fid=${cast.author.fid}&hash=${cast.hash}&limit=${repliesPerCast}`
            );
            
            if (!repliesResponse.ok) {
              console.error(`Failed to fetch replies: ${repliesResponse.status} ${repliesResponse.statusText}`);
              continue;
            }
            
            const repliesData = await repliesResponse.json();
            const replies = repliesData.result?.casts || [];
            
            // Mark as replies and add parent information
            replies.forEach(reply => {
              reply.isReply = true;
              reply.parentCast = {
                fid: cast.author.fid,
                hash: cast.hash,
                username: cast.author.username,
                text: cast.text
              };
              reply.sourceChannel = cast.sourceChannel;
            });
            
            // Sort replies based on the specified sort method
            if (replySortBy === 'recent') {
              replies.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            } else {
              // Default: sort by engagement
              replies.sort((a, b) => {
                const engagementA = (a.reactions?.count || 0) + (a.replies?.count || 0) + (a.recasts?.count || 0);
                const engagementB = (b.reactions?.count || 0) + (b.replies?.count || 0) + (b.recasts?.count || 0);
                return engagementB - engagementA;
              });
            }
            
            // Add replies to the cast
            cast.fetchedReplies = replies;
            
            // Also add replies to the main array
            allCasts = allCasts.concat(replies);
            
          } catch (error) {
            console.error(`Error fetching replies for cast ${cast.hash}:`, error);
          }
        }
      }
      
      // Add channel casts to the main array
      allCasts = allCasts.concat(channelCasts);
    }
    
    // Sort all casts by engagement (could be parameterized in the future)
    allCasts.sort((a, b) => {
      const engagementA = (a.reactions?.count || 0) + (a.replies?.count || 0) + (a.recasts?.count || 0);
      const engagementB = (b.reactions?.count || 0) + (b.replies?.count || 0) + (b.recasts?.count || 0);
      return engagementB - engagementA;
    });
    
    // Limit to requested number of casts
    allCasts = allCasts.slice(0, totalCastLimit);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        casts: allCasts,
        includesReplies: includeReplies,
        channelsAnalyzed: topChannels.length,
        totalCasts: allCasts.length
      })
    };
    
  } catch (error) {
    console.error('Error generating comprehensive feed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to generate comprehensive feed',
        details: error.message
      })
    };
  }
};