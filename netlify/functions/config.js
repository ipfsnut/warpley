/**
 * Configuration settings for Warpcast API integration
 */
module.exports = {
  // API rate limiting and request parameters
  limits: {
    // Maximum number of channels to process
    maxChannelLimit: 50,
    defaultChannelLimit: 20,
    
    // Maximum number of followers to fetch per channel
    maxFollowerLimit: 50,
    defaultFollowerLimit: 10,
    
    // Maximum number of casts to fetch per follower
    maxCastLimit: 20,
    defaultCastLimit: 5,
    
    // Maximum total casts to return in the response
    maxTotalCastLimit: 500,
    defaultTotalCastLimit: 100,
    
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
