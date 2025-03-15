// netlify/functions/token-balance.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.handler = async function(event, context) {
  // Parse query parameters
  const params = event.queryStringParameters || {};
  const username = params.username;
  const tokenAddress = params.tokenAddress || process.env.TOKEN_ADDRESS;
  
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
        error: 'Missing required parameter: tokenAddress (or set TOKEN_ADDRESS environment variable)'
      })
    };
  }
  
  try {
    // Step 1: Find the user's FID by username
    console.log(`Looking up FID for username: ${username}`);
    
    // This is a hypothetical endpoint - we need to confirm it works
    const userResponse = await fetch(`https://api.warpcast.com/v2/user-by-username?username=${username}`);
    
    if (!userResponse.ok) {
      throw new Error(`Failed to find user: ${userResponse.status} ${userResponse.statusText}`);
    }
    
    const userData = await userResponse.json();
    const fid = userData.result?.user?.fid;
    
    if (!fid) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'User not found or FID not available'
        })
      };
    }
    
    console.log(`Found FID ${fid} for username ${username}`);
    
    // Step 2: Get the user's Ethereum address
    console.log(`Getting Ethereum address for FID: ${fid}`);
    const addressResponse = await fetch(`https://api.warpcast.com/fc/primary-address?fid=${fid}&protocol=ethereum`);
    
    if (!addressResponse.ok) {
      throw new Error(`Failed to get Ethereum address: ${addressResponse.status} ${addressResponse.statusText}`);
    }
    
    const addressData = await addressResponse.json();
    const ethAddress = addressData.result?.address?.address;
    
    if (!ethAddress) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'User has no verified Ethereum address'
        })
      };
    }
    
    console.log(`Found Ethereum address ${ethAddress} for FID ${fid}`);
    
    // Step 3: Get token balance from Etherscan
    console.log(`Getting token balance for address: ${ethAddress}`);
    const etherscanApiKey = process.env.ETHERSCAN_API_KEY || '';
    const balanceUrl = `https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=${tokenAddress}&address=${ethAddress}&tag=latest${etherscanApiKey ? `&apikey=${etherscanApiKey}` : ''}`;
    
    const balanceResponse = await fetch(balanceUrl);
    
    if (!balanceResponse.ok) {
      throw new Error(`Failed to get token balance: ${balanceResponse.status} ${balanceResponse.statusText}`);
    }
    
    const balanceData = await balanceResponse.json();
    
    if (balanceData.status !== '1') {
      throw new Error(`Etherscan API error: ${balanceData.message}`);
    }
    
    const rawBalance = balanceData.result;
    
    // Format token balance (assuming 18 decimals, which is standard for most ERC20 tokens)
    const formattedBalance = parseFloat(rawBalance) / 1e18;
    
    // Return the user's token balance information
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      },
      body: JSON.stringify({
        username,
        fid,
        ethAddress,
        tokenAddress,
        balance: {
          raw: rawBalance,
          formatted: formattedBalance
        },
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error(`Error fetching token balance for ${username}:`, error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to fetch token balance',
        message: error.message
      })
    };
  }
};