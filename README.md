# Warpley: Farcaster API Integration for AI Chatbots

Warpley is a serverless application that provides easy access to Farcaster (Warpcast) data for integration with AI chatbots. It allows you to fetch trending content, channel information, and user data with minimal setup.

## Features

- **Channel Information**: Get details about specific Farcaster channels
- **User Address Lookup**: Retrieve Ethereum addresses for Farcaster users
- **Comprehensive Feed**: Generate a curated feed of trending content from top channels
- **Serverless Architecture**: Deploy without managing servers
- **Web Interface**: Included UI for testing and visualizing API data

## Deployment

### Prerequisites

- A Netlify account
- (Optional) Etherscan API key for higher rate limits when querying token balances

### Deploying to Netlify

1. Fork this repository to your GitHub account
2. Connect to Netlify and deploy from GitHub
3. Set up environment variables (optional):
   - `TOKEN_ADDRESS`: Default token address to check balances

## API Endpoints

### Channel Information

```
GET /.netlify/functions/warpcast-api?channelId=CHANNEL_ID
```

Parameters:
- `channelId` (required): ID of the channel to fetch (e.g., "page", "memes", "wake")

Example:
```
GET /.netlify/functions/warpcast-api?channelId=memes
```

### User Address Lookup

```
GET /.netlify/functions/warpcast-api?username=USERNAME
```

Parameters:
- `username` (required): Farcaster username
- `tokenAddress` (optional): Ethereum contract address of token to check balance

Example:
```
GET /.netlify/functions/warpcast-api?username=vitalik&tokenAddress=0xYourTokenContractAddress
```

### All Channels

```
GET /.netlify/functions/warpcast-api?allChannels=true
```

Parameters:
- `limit` (optional): Number of channels to retrieve (default: 100, max: 100)

Example:
```
GET /.netlify/functions/warpcast-api?allChannels=true&limit=50
```

### Comprehensive Feed

```
GET /.netlify/functions/warpcast-api?comprehensiveFeed=true
```

Parameters:
- `channelLimit`: Number of top channels to analyze (default: 20, max: 50)
- `followerLimit`: Number of followers per channel (default: 10, max: 50)
- `castLimit`: Number of casts per follower (default: 5, max: 20)
- `totalCastLimit`: Total casts to return (default: 100, max: 500)

Example:
```
GET /.netlify/functions/warpcast-api?comprehensiveFeed=true&channelLimit=10&totalCastLimit=50
```

## Web Interface

The included HTML interface allows you to:
- Look up channel information
- Find Ethereum addresses for Farcaster users
- Browse all channels
- Generate a comprehensive feed of trending content

Access it by opening your Netlify domain in a web browser.

## Chatbot Integration

You can integrate these API endpoints with your AI chatbot by making HTTP requests when relevant topics come up in conversation:

```javascript
async function getFarcasterTrends(limit = 5) {
  try {
    const response = await fetch('https://your-netlify-app.netlify.app/.netlify/functions/warpcast-api?comprehensiveFeed=true&totalCastLimit=' + limit);
    const data = await response.json();
    
    if (data.casts && data.casts.length > 0) {
      // Format the trending casts for your chatbot
      return data.casts.map(cast => ({
        author: `@${cast.author.username}`,
        content: cast.content,
        engagement: cast.engagement.total
      }));
    } else {
      return "No trending content found at the moment.";
    }
  } catch (error) {
    console.error("Error fetching Farcaster trends:", error);
    return "Sorry, I couldn't fetch trending content from Farcaster right now.";
  }
}

// Example usage in a chatbot
async function handleUserMessage(message) {
  if (message.includes("trending") || message.includes("popular") || message.includes("farcaster")) {
    const trends = await getFarcasterTrends(3);
    
    if (Array.isArray(trends)) {
      let response = "Here's what's trending on Farcaster right now:\n\n";
      
      trends.forEach((cast, index) => {
        response += `${index + 1}. ${cast.author}: "${cast.content}"\n`;
      });
      
      return response;
    } else {
      return trends; // Error message
    }
  }
  
  // Handle other messages...
}
```

## Using with Your Token

To use with your own token:
1. Deploy your token contract to Ethereum or a compatible chain
2. Use the contract address in API calls or set as the `TOKEN_ADDRESS` environment variable
3. Update the web interface to display your token's name and adjust decimals as needed

## API Changes and Limitations

The Warpcast/Farcaster API is subject to change. This implementation uses the public Warpcast API endpoints which may have rate limits or change without notice. If you encounter issues, check the [Farcaster documentation](https://docs.farcaster.xyz/) for the latest API information.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

CC0 1.0 Universal - Public Domain Dedication

To the extent possible under law, the author has waived all copyright and related or neighboring rights to this work. This work is published from the United States.
