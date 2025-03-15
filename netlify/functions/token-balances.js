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
    // First, get the user's Ethereum address using the Neynar API
    const apiKey = process.env.NEYNAR_API_KEY || 'NEYNAR_API_UR743U79VP';
    const userEndpoint = `https://api.neynar.com/v2/farcaster/user/search?q=${username}&limit=1`;
    
    const userResponse = await fetch(userEndpoint, {
      headers: {
        'accept': 'application/json',
        'api_key': apiKey
      }
    });
    
    if (!userResponse.ok) {
      throw new Error(`Neynar API returned ${userResponse.status}: ${userResponse.statusText}`);
    }
    
    const userData = await userResponse.json();
    
    if (!userData.users || userData.users.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'User not found'
        })
      };
    }
    
    const user = userData.users[0];
    
    // Get the user's verified ETH addresses
    const verifications = user.verifications || [];
    
    if (verifications.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'User has no verified Ethereum addresses'
        })
      };
    }
    
    const ethAddress = verifications[0]; // Get first verified address
    
    // Now fetch the token balance using a public Ethereum API (example with Etherscan API)
    const etherscanApiKey = process.env.ETHERSCAN_API_KEY || ''; // Optional, higher rate limits with API key
    const tokenBalanceResponse = await fetch(
      `https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=${tokenAddress}&address=${ethAddress}&tag=latest${etherscanApiKey ? `&apikey=${etherscanApiKey}` : ''}`
    );
    
    if (!tokenBalanceResponse.ok) {
      throw new Error(`Etherscan API returned ${tokenBalanceResponse.status}: ${tokenBalanceResponse.statusText}`);
    }
    
    const balanceData = await tokenBalanceResponse.json();
    
    // Format and return the balance info
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      },
      body: JSON.stringify({
        username: user.username,
        displayName: user.display_name,
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
        message: error.message
      })
    };
  }
};