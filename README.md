# warpley

# Warpcast API for Chatbots

This repository contains serverless functions that provide easy access to public Warpcast data for integration with AI chatbots. The functions allow you to fetch trending casts and token balances without requiring API keys.

## Features

- **Trending Casts API**: Get the top 100 trending casts from Warpcast
- **Token Balances API**: Track user balances for specific tokens
- **No API Keys Required**: Uses Warpcast's public API endpoints
- **Serverless Architecture**: Deploy without managing servers

## Deployment

### Prerequisites

- Node.js 14+ installed
- Netlify CLI installed (`npm install -g netlify-cli`)
- (Optional) Etherscan API key for higher rate limits

### Steps

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/warpcast-chatbot-api
   cd warpcast-chatbot-api
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Test locally:
   ```bash
   npm run dev
   ```

4. Deploy to Netlify:
   ```bash
   netlify deploy --prod
   ```

## API Endpoints

### Trending Casts

```
GET /.netlify/functions/trending-casts
```

Parameters:
- `timeframe` (optional): Time window for trending posts (default: 24h)
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
- `username` (required): Warpcast username
- `tokenAddress` (required): Ethereum contract address of your token

Example:
```
GET /.netlify/functions/token-balances?username=vitalik&tokenAddress=0xYourTokenContractAddress
```

## Chatbot Integration

See the `usage-example.js` file for example code on how to integrate these APIs with your chatbot.

## Environment Variables

For the token balance endpoint, you may want to set the following environment variable in Netlify:

- `ETHERSCAN_API_KEY`: Your Etherscan API key (optional, for higher rate limits)

## Best Practices

1. **Implement Caching**: The APIs have a Cache-Control header set to 5 minutes, but you may want to implement additional caching in your chatbot.

2. **Error Handling**: Always handle API failures gracefully in your chatbot.

3. **Rate Limiting**: Be mindful of Warpcast and Etherscan API rate limits.

## License

MIT