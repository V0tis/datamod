This project is my personal AI maid.
When I enter keywords for a specific industry, it crawls the latest news, competitor trends, and user reviews, then summarizes them and generates a SWOT analysis report.

ui: v0 dev
dev: cursor claude 3.5 sonnet
deployed: vercel
firecrawl+claude

## Environment Variables

Create a `.env` file (see `.env.example` if present) and provide the following API keys so the research endpoint can proxy external services securely:

- `FIRECRAWL_API_KEY`: Server-side key for Firecrawl. Used to fetch recent market news and public chatter related to the search keyword.
- `ANTHROPIC_API_KEY`: Server-side key for Anthropic Claude. Used to synthesize Firecrawl findings into a short summary.

These values are only required on the server; do **not** expose them to the browser.

