const Parser = require('@postlight/mercury-parser');
const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

const strategies = {
  googlebot: {
    'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.5',
    'cache-control': 'no-cache'
  },
  
  facebook: {
    'user-agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'cache-control': 'no-cache'
  },

  archive: {
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.5',
    'cache-control': 'no-cache'
  }
};

const parsers = [];

export const handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Preflight successful' })
    };
  }

  if (!event.queryStringParameters || !event.queryStringParameters.q) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Invalid/No URL provided',
        usage: 'Add ?q=URL_TO_PARSE to your request'
      })
    };
  }

  const { q: urlString, strategy = 'auto', ...parameters } = event.queryStringParameters;
  
  let url;
  try {
    url = new URL(urlString);
  } catch (error) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Invalid URL format',
        provided: urlString 
      })
    };
  }

  let selectedStrategy = strategy;
  if (strategy === 'auto') {
    if (url.hostname.includes('.be') || url.hostname.includes('tijd.be')) {
      selectedStrategy = 'googlebot';
    } else if (url.hostname.includes('ft.com') || url.hostname.includes('wsj.com')) {
      selectedStrategy = 'archive';
    } else {
      selectedStrategy = 'googlebot';
    }
  }

  const headers = strategies[selectedStrategy] || strategies.googlebot;
  
  // Add custom parsers if domain matches
  parsers.forEach((parser) => {
    if (url.hostname.includes(parser.domain)) {
      try {
        Parser.addExtractor(parser);
      } catch (error) {
        console.warn(`Failed to add parser for ${parser.domain}:`, error.message);
      }
    }
  });

  try {
    const response = await fetch(url.href, {
      headers: headers,
      timeout: 15000,
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const parsed = await Parser.parse(url.href, {
      html: html,
      contentType: 'html',
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ...parsed,
        meta: {
          originalUrl: url.href,
          strategy: selectedStrategy,
          userAgent: headers['user-agent'] || 'default',
          contentLength: html.length,
          timestamp: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('Parsing failed:', error);
    
    const errorResponse = {
      error: error.message || 'Unknown error occurred',
      url: url.href,
      strategy: selectedStrategy,
      timestamp: new Date().toISOString(),
      suggestion: selectedStrategy === 'auto' ? 
        'Try adding &strategy=archive or &strategy=facebook' : 
        'Try a different strategy parameter'
    };

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify(errorResponse)
    };
  }
};
