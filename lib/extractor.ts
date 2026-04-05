export async function extractFromPdf(buffer: Buffer): Promise<string> {
  // Dynamically import pdf-parse to avoid issues with Next.js
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);
  return data.text;
}

export async function extractFromUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const html = await response.text();

    // Try readability first
    try {
      const { JSDOM } = await import('jsdom');
      const { Readability } = await import('@mozilla/readability');

      const dom = new JSDOM(html, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (article && article.textContent) {
        // Clean up text
        return cleanText(article.textContent);
      }
    } catch {
      // Fall through to simple extraction
    }

    // Fallback: simple text extraction from HTML
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM(html);
    const body = dom.window.document.body;

    // Remove script and style elements
    const scripts = body.querySelectorAll('script, style, nav, header, footer, aside');
    scripts.forEach((el: Element) => el.remove());

    return cleanText(body.textContent || '');
  } catch (error) {
    throw new Error(`Failed to extract content from URL: ${String(error)}`);
  }
}

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/^ /gm, '')
    .trim();
}
