const Parser = require("@postlight/mercury-parser");

const handler = async function (event) {
  const { q, ...parameters } = event.queryStringParameters;

  const url = new URL(q);

  if (!q) {
    return {
      statusCode: 200,
      body: JSON.stringify({ error: "Invalid/No URL provided" }),
    };
  } else {
    parsers.forEach((parser) => {
      if (url.hostname.includes(parser.domain)) {
        Parser.addExtractor(parser);
      }
    });

    try {
      const response = await Parser.parse(url.href);

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
