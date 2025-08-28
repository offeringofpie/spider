# Spider - Web Article Parser
Spider is a powerful web article parser that transforms cluttered web pages into clean, readable content.

Visit [spider.jlopes.eu](https://spider.jlopes.eu) to try it out!

### Parsing Strategies

Spider supports multiple parsing strategies optimized for different types of websites:

- **auto** (default): Automatically selects the best strategy based on domain
- **googlebot**: Mimics Google's crawler for general content
- **facebook**: Uses Facebook's external hit agent
- **archive**: Optimized for archived or paywall content

### Custom Parsers

You can extend Spider with custom parsers for specific domains by modifying the `functions/node-fetch/node-fetch.mjs` file.

## Acknowledgments

- [Postlight](https://postlight.com) for the Mercury Parser
- [Astro team](https://astro.build) for the amazing framework
- [Tailwind CSS](https://tailwindcss.com) and [DaisyUI](https://daisyui.com) for the styling foundation
- [Netlify](https://netlify.com) for seamless deployment