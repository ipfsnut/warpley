// netlify/functions/token-balances.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.handler = async function(event, context) {
  const username = event.queryStringParameters?.username;
  // Get token address from parameters or environment variable
  const tokenAddress = event.queryStringParameters?.tokenAddress || process.env.TOKEN_ADDRESS;
  
  if (!username) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Missing required parameter: username'
      })
    };
  }
  
  if (!tokenAddress) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Missing required parameter: tokenAddress'
      })
    };
  }
  
  try {
    console.log(`Fetching user data for username: ${username}`);
    
    // First, get the user's Ethereum address from their Warpcast profile
    const userResponse = await fetch(`https://warpcast.com/~/api/user-by-username?username=${username}`);
    
    if (!userResponse.ok) {
      throw new Error(`Warpcast API returned ${userResponse.status}: ${userResponse.statusText}`);
    }
    
    const userData = await userResponse.json();
    console.log(`User API response status: ${userResponse.status}`);
    
    const ethAddress = userData.result?.user?.verifications?.ethereum;
    
    if (!ethAddress) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'User has no verified Ethereum address'
        })
      };
    }
    
    console.log(`Found ETH address for ${username}: ${ethAddress}`);
    
    // Now fetch the token balance using a public Ethereum API (example with Etherscan API)
    const etherscanApiKey = process.env.ETHERSCAN_API_KEY || ''; // Optional, higher rate limits with API key
    const tokenBalanceUrl = `https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=${tokenAddress}&address=${ethAddress}&tag=latest${etherscanApiKey ? `&apikey=${etherscanApiKey}` : ''}`;
    
    console.log(`Requesting token balance from: ${tokenBalanceUrl}`);
    
    const tokenBalanceResponse = await fetch(tokenBalanceUrl);
    
    if (!tokenBalanceResponse.ok) {
      throw new Error(`Etherscan API returned ${tokenBalanceResponse.status}: ${tokenBalanceResponse.statusText}`);
    }
    
    const balanceData = await tokenBalanceResponse.json();
    console.log(`Token balance API response: ${JSON.stringify(balanceData)}`);
    
    // Format and return the balance info
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      },
      body: JSON.stringify({
        username,
        ethAddress,
        tokenAddress,
        balance: balanceData.result,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Error fetching token balance:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to fetch token balance',
        message: error.message,
        stack: error.stack
      })
    };
  }
};