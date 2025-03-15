(function() {
  // API base URL - will use the current domain
  const apiBaseUrl = `${window.location.origin}/.netlify/functions/warpcast-api`;

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    setupTabSwitching();
    setupEventListeners();
  });

  // Tab switching functionality
  function setupTabSwitching() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        // Remove active class from all tabs
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        // Add active class to clicked tab
        tab.classList.add('active');
        document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
      });
    });
  }

  // Set up all event listeners
  function setupEventListeners() {
    // Channel info
    document.getElementById('fetchChannelBtn')?.addEventListener('click', handleFetchChannel);
    
    // User address
    document.getElementById('fetchAddressBtn')?.addEventListener('click', handleFetchAddress);
    
    // All channels
    document.getElementById('fetchAllChannelsBtn')?.addEventListener('click', handleFetchAllChannels);
    
    // Show/hide replies options
    document.getElementById('includeReplies')?.addEventListener('change', handleToggleRepliesOptions);
    
    // Comprehensive feed
    document.getElementById('fetchComprehensiveBtn')?.addEventListener('click', handleFetchComprehensiveFeed);
    
    // Cast replies
    document.getElementById('fetchRepliesBtn')?.addEventListener('click', handleFetchCastReplies);
    
    // Cast mentions
    document.getElementById('fetchMentionsBtn')?.addEventListener('click', handleFetchCastMentions);
    
    // Global event listener for pagination buttons
    document.addEventListener('click', handlePaginationButtons);
  }

  // Toggle replies options visibility
  function handleToggleRepliesOptions() {
    const repliesOptions = document.getElementById('repliesOptionsContainer');
    if (repliesOptions) {
      repliesOptions.style.display = this.checked ? 'block' : 'none';
    }
  }

  // Handle fetch channel button click
  async function handleFetchChannel() {
    const channelId = document.getElementById('channelId')?.value.trim();
    if (!channelId) {
      showError('channelResult', 'Please enter a channel ID');
      return;
    }

    const resultElem = document.getElementById('channelResult');
    if (!resultElem) return;
    
    showLoading(resultElem);
    disableButton(this);

    try {
      const response = await fetch(`${apiBaseUrl}?channelId=${encodeURIComponent(channelId)}`);
      const data = await response.json();
      resultElem.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    } catch (error) {
      showError(resultElem, error.message);
    } finally {
      enableButton(this);
    }
  }

  // Handle fetch user address button click
  async function handleFetchAddress() {
    const username = document.getElementById('username')?.value.trim();
    const tokenAddress = document.getElementById('tokenAddress')?.value.trim();
    
    if (!username) {
      showError('addressResult', 'Please enter a username');
      return;
    }

    const resultElem = document.getElementById('addressResult');
    if (!resultElem) return;
    
    showLoading(resultElem);
    disableButton(this);

    try {
      let url = `${apiBaseUrl}?username=${encodeURIComponent(username)}`;
      if (tokenAddress) {
        url += `&tokenAddress=${encodeURIComponent(tokenAddress)}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      resultElem.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    } catch (error) {
      showError(resultElem, error.message);
    } finally {
      enableButton(this);
    }
  }

  // Handle fetch all channels button click
  async function handleFetchAllChannels() {
    const limit = document.getElementById('limit')?.value || 10;
    
    const resultElem = document.getElementById('allChannelsResult');
    if (!resultElem) return;
    
    showLoading(resultElem);
    disableButton(this);

    try {
      const response = await fetch(`${apiBaseUrl}?allChannels=true&limit=${limit}`);
      const data = await response.json();
      resultElem.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    } catch (error) {
      showError(resultElem, error.message);
    } finally {
      enableButton(this);
    }
  }

  // Handle fetch comprehensive feed button click
  async function handleFetchComprehensiveFeed() {
    const channelLimit = document.getElementById('channelLimit')?.value || 20;
    const totalCastLimit = document.getElementById('totalCastLimit')?.value || 100;
    const includeReplies = document.getElementById('includeReplies')?.checked || false;
    const repliesPerCast = document.getElementById('repliesPerCast')?.value || 3;
    const replySortBy = document.querySelector('input[name="replySortBy"]:checked')?.value || 'engagement';
    
    const resultElem = document.getElementById('comprehensiveResult');
    if (!resultElem) return;
    
    showLoading(resultElem, 'Loading trending content...');
    disableButton(this);
    
    try {
      let apiUrl = `${apiBaseUrl}?comprehensiveFeed=true&channelLimit=${channelLimit}&totalCastLimit=${totalCastLimit}`;
      
      if (includeReplies) {
        apiUrl += `&includeReplies=true&repliesPerCast=${repliesPerCast}&replySortBy=${replySortBy}`;
      }
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Display stats
      let html = `
        <div class="success">
          Analyzed ${data.channelsAnalyzed || 0} channels with ${data.uniqueFollowers || 0} unique followers.
          Found ${data.casts?.length || 0} trending casts.
          ${includeReplies ? 'Replies are included.' : ''}
        </div>
      `;
      
      // Display casts in a formatted way
      if (data.casts && data.casts.length > 0) {
        html += `<h3>Top Trending Casts</h3>`;
        html += data.casts.map(cast => renderCast(cast)).join('');
      } else {
        html += `<p>No casts found.</p>`;
      }
      
      resultElem.innerHTML = html;
    } catch (error) {
      showError(resultElem, error.message);
    } finally {
      enableButton(this);
    }
  }

  // Handle fetch cast replies button click
  async function handleFetchCastReplies() {
    const fid = document.getElementById('parentFid')?.value.trim();
    const hash = document.getElementById('parentHash')?.value.trim();
    const url = document.getElementById('castUrl')?.value.trim();
    const limit = document.getElementById('replyLimit')?.value || 20;
    
    if ((!fid || !hash) && !url) {
      showError('repliesResult', 'Please provide either (FID and Hash) or URL');
      return;
    }
    
    const resultElem = document.getElementById('repliesResult');
    if (!resultElem) return;
    
    showLoading(resultElem, 'Loading replies...');
    disableButton(this);
    
    try {
      let apiUrl = `${apiBaseUrl}?castReplies=true`;
      
      if (url) {
        apiUrl += `&castUrl=${encodeURIComponent(url)}&limit=${limit}`;
      } else {
        apiUrl += `&parentFid=${fid}&parentHash=${hash}&limit=${limit}`;
      }
      
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      renderItemsWithPagination(resultElem, data.replies, 'replies', apiUrl, data.nextCursor);
    } catch (error) {
      showError(resultElem, error.message);
    } finally {
      enableButton(this);
    }
  }

  // Handle fetch cast mentions button click
  async function handleFetchCastMentions() {
    const fid = document.getElementById('mentionFid')?.value.trim();
    const limit = document.getElementById('mentionLimit')?.value || 20;
    
    if (!fid) {
      showError('mentionsResult', 'Please provide an FID');
      return;
    }
    
    const resultElem = document.getElementById('mentionsResult');
    if (!resultElem) return;
    
    showLoading(resultElem, 'Loading mentions...');
    disableButton(this);
    
    try {
      const apiUrl = `${apiBaseUrl}?castMentions=true&mentionFid=${fid}&limit=${limit}`;
      
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      renderItemsWithPagination(resultElem, data.mentions, 'mentions', apiUrl, data.nextCursor);
    } catch (error) {
      showError(resultElem, error.message);
    } finally {
      enableButton(this);
    }
  }

  // Handle pagination button clicks
  async function handlePaginationButtons(event) {
    const target = event.target;
    
    // Check if the clicked element is a load more button
    if (target.classList.contains('load-more-btn')) {
      const type = target.dataset.type;
      const apiUrl = target.dataset.url;
      const cursor = target.dataset.cursor;
      const resultElem = target.closest('.result');
      
      if (!resultElem || !apiUrl || !cursor) return;
      
      target.disabled = true;
      target.textContent = 'Loading...';
      
      try {
        const response = await fetch(`${apiUrl}&cursor=${cursor}`);
        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error);
        }
        
        // Remove the current button
        target.remove();
        
        // Get the items array based on type
        const items = type === 'replies' ? data.replies : data.mentions;
        
        // Append new items
        const itemsHtml = items.map(item => renderCast(item)).join('');
        resultElem.querySelector('.items-container').insertAdjacentHTML('beforeend', itemsHtml);
        
        // Add new pagination button if needed
        if (data.nextCursor) {
          const paginationHtml = `
            <button class="btn load-more-btn" data-type="${type}" data-url="${apiUrl}" data-cursor="${data.nextCursor}">
              Load More ${type === 'replies' ? 'Replies' : 'Mentions'}
            </button>
          `;
          resultElem.querySelector('.items-container').insertAdjacentHTML('afterend', paginationHtml);
        }
      } catch (error) {
        resultElem.insertAdjacentHTML('beforeend', `<div class="error">Error loading more: ${error.message}</div>`);
      }
    }
  }

  // Render items with pagination
  function renderItemsWithPagination(container, items, type, apiUrl, nextCursor) {
    // Display the results
    let html = `
      <div class="success">
        Found ${items.length} ${type}.
        ${nextCursor ? 'More ' + type + ' available.' : ''}
      </div>
    `;
    
    // Display items in a formatted way
    if (items && items.length > 0) {
      html += `<h3>${type.charAt(0).toUpperCase() + type.slice(1)}</h3>`;
      html += `<div class="items-container">`;
      html += items.map(item => renderCast(item)).join('');
      html += `</div>`;
      
      // Add pagination if there's a next cursor
      if (nextCursor) {
        html += `
          <button class="btn load-more-btn" data-type="${type}" data-url="${apiUrl}" data-cursor="${nextCursor}">
            Load More ${type === 'replies' ? 'Replies' : 'Mentions'}
          </button>
        `;
      }
    } else {
      html += `<p>No ${type} found.</p>`;
    }
    
    container.innerHTML = html;
  }

  // Render a single cast
  function renderCast(cast) {
    return `
      <div class="cast ${cast.isReply ? 'reply-cast' : ''}">
        <div class="cast-header">
          <img class="cast-avatar" src="${cast.author?.pfp?.url || 'https://via.placeholder.com/40'}" alt="Avatar">
          <div>
            <div class="cast-username">${cast.author?.username || 'Unknown User'}</div>
            <div>${cast.author?.displayName || ''}</div>
          </div>
        </div>
        
        ${cast.isReply ? `
          <div class="reply-parent">
            <small>Replying to @${cast.parentAuthor?.username || 'unknown'}</small>
          </div>
        ` : ''}
        
        <div class="cast-text">${cast.text}</div>
        
        <div class="cast-stats">
          ❤️ ${cast.reactions?.count || 0} •
          🔄 ${cast.recasts?.count || 0} •
          💬 ${cast.replies?.count || 0} •
          ${cast.sourceChannel ? `Channel: ${cast.sourceChannel.name}` : ''}
        </div>
      </div>
    `;
  }

  // Helper functions
  function showLoading(element, message = 'Loading...') {
    if (typeof element === 'string') {
      element = document.getElementById(element);
    }
    if (element) {
      element.innerHTML = `<div class="loading">${message}</div>`;
    }
  }

  function showError(element, message) {
    if (typeof element === 'string') {
      element = document.getElementById(element);
    }
    if (element) {
      element.innerHTML = `<div class="error">Error: ${message}</div>`;
    }
  }

  function disableButton(button) {
    if (button) {
      button.disabled = true;
      button.dataset.originalText = button.textContent;
      button.textContent = 'Loading...';
    }
  }

  function enableButton(button) {
    if (button && button.dataset.originalText) {
      button.disabled = false;
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
})();
