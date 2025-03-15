# Warpcast API for Chatbots

This repository contains serverless functions that provide easy access to Farcaster (Warpcast) data for integration with AI chatbots. The functions allow you to fetch trending casts and token balances with minimal setup.

## Features

- **Trending Casts API**: Get trending casts from Farcaster
- **Token Balances API**: Track user balances for specific tokens
- **Serverless Architecture**: Deploy without managing servers
- **Web Interface**: Included UI for visualizing the API data

## API Changes (March 2025)

The Warpcast/Farcaster API has changed since the original guide was written. This implementation now uses:

1. **Neynar API**: For accessing Farcaster data (with a free API key)
2. **Etherscan API**: For accessing token balances (optional API key)

## Deployment

### Prerequisites

- A Netlify account
- (Optional) Neynar API key - a default test key is included but you should get your own for production
- (Optional) Etherscan API key for higher rate limits

### Deploying to Netlify

1. Push this repository to GitHub
2. Connect to Netlify and deploy from GitHub
3. Set up environment variables (optional):
   - `NEYNAR_API_KEY`: Your Neynar API key
   - `ETHERSCAN_API_KEY`: Your Etherscan API key
   - `TOKEN_ADDRESS`: Default token address to check balances

## API Endpoints

### Trending Casts

```
GET /.netlify/functions/trending-casts
```

Parameters:
- `timeframe` (optional): Time window (default: 24h, options: 24h, 7d)
- `limit` (optional): Number of casts to retrieve (default: 100, max: 100)
- `filter` (optional): Keyword filter to apply

Example:
```
GET /.netlify/functions/trending-casts?timeframe=24h&limit=50&filter=ethereum
```

### Token Balances

```
GET /.netlify/functions/token-balances
```

Parameters:
- `username` (required): Farcaster username
- `tokenAddress` (required): Ethereum contract address of token

Example:
```
GET /.netlify/functions/token-balances?username=vitalik&tokenAddress=0xYourTokenContractAddress
```

## Web Interface

The included HTML interface allows you to:
- Browse trending casts with various filters
- Look up token balances for specific users
- Test API functionality directly in your browser

Access it by opening your Netlify domain in a web browser.

## Chatbot Integration

You can integrate these API endpoints with your AI chatbot by making HTTP requests when relevant topics come up in conversation:

```javascript
async function enhanceChatbotWithFarcasterData(userQuery) {
  if (userQuery.includes("trending") || userQuery.includes("popular")) {
    // Fetch trending data when user asks about popular content
    const trends = await fetch('https://your-netlify-app.netlify.app/api/trending-casts?limit=5');
    const data = await trends.json();
    
    // Include this data in your chatbot's context
    return `Here are some trending topics from Farcaster: ${data.casts.map(c => c.text).join(', ')}`;
  }
  
  // ... other integrations
}
```

## Using with Your Token

To use with your own token:
1. Deploy your token contract to Ethereum or a compatible chain
2. Use the contract address in API calls or set as the `TOKEN_ADDRESS` environment variable
3. Update the web interface to display your token's name and adjust decimals as needed

## License

CC0 1.0 Universal