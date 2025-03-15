/**
 * Configuration settings for Warpcast API integration
 */
module.exports = {
  // API rate limiting and request parameters
  limits: {
    // Maximum number of channels to process
    defaultChannelLimit: 200,
    
    // Maximum number of followers to fetch per channel
    defaultFollowerLimit: 100,
    
    // Maximum number of casts to fetch per follower
    defaultCastLimit: 50,
    
    // Maximum total casts to return in the response
    defaultTotalCastLimit: 1000,
    
    // Batch sizes for processing to avoid rate limiting
    channelBatchSize: 5,
    followerBatchSize: 3,
    
    // Delays between batches (in milliseconds)
    channelBatchDelay: 300,
    followerBatchDelay: 500
  },
  
  // API endpoints
  endpoints: {
    allChannels: 'https://api.warpcast.com/v2/all-channels',
    channelFollowers: 'https://api.warpcast.com/v1/channel-followers',
    userCasts: 'https://api.warpcast.com/v2/casts'
  }
};
