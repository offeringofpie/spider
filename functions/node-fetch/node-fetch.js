const Parser = require('@postlight/mercury-parser');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const handler = async function (event) {
  const { q, ...parameters } = event.queryStringParameters;

  const url = new URL(q);

  if (!q) {
    return {
      statusCode: 200,
      body: JSON.stringify({ error: 'Invalid/No URL provided' }),
    };
  } else {
    parsers.forEach((parser) => {
      if (url.hostname.includes(parser.domain)) {
        Parser.addExtractor(parser);
      }
    });

    try {
      const response = await Parser.parse(`${url.href}?date=${Date.now()}`, {
        headers: {
          'Cache-Control': 'no-cache,no-store,max-age=1, must-revalidate',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          'Referer': 'https://www.google.com/'
        }
      });
      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (err) {
      return {
        statusCode: 500,

        body: JSON.stringify({ error: err }),
      };
    }
  }
};
module.exports = { handler };

const parsers = [];
