const MAX_CHUNK_SIZE = 1500;

interface TextChunk {
  title: string;
  text: string;
}

export function chunkText(text: string): TextChunk[] {
  // Split text into sections by headings
  const sections = splitIntoSections(text);

  // Further split each section if it's too long
  const chunks: TextChunk[] = [];

  for (const section of sections) {
    if (section.text.length <= MAX_CHUNK_SIZE) {
      chunks.push(section);
    } else {
      // Split long sections by paragraphs
      const subChunks = splitByParagraphs(section.text, section.title);
      chunks.push(...subChunks);
    }
  }

  // Filter out empty chunks
  return chunks.filter((c) => c.text.trim().length > 0);
}

function isHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Markdown headings: # Heading
  if (/^#{1,6}\s+/.test(trimmed)) return true;

  // ALL CAPS lines (at least 3 chars, not a single word acronym scenario that could be code)
  if (trimmed.length >= 5 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed) && !/^\d+$/.test(trimmed)) {
    return true;
  }

  // Numbered section headers: 1. Title, 1.1 Title, Chapter 1, Section 2, etc.
  if (/^(\d+\.)+\d*\s+\S/.test(trimmed)) return true;
  if (/^(chapter|section|part|제\d+장|제\d+절|제\d+조)\s+/i.test(trimmed)) return true;

  return false;
}

function extractHeadingTitle(line: string): string {
  const trimmed = line.trim();
  // Remove markdown heading markers
  return trimmed.replace(/^#{1,6}\s+/, '').trim();
}

function splitIntoSections(text: string): TextChunk[] {
  const lines = text.split('\n');
  const sections: TextChunk[] = [];

  let currentTitle = '';
  let currentLines: string[] = [];

  for (const line of lines) {
    if (isHeading(line)) {
      // Save previous section
      if (currentLines.length > 0) {
        const sectionText = currentLines.join('\n').trim();
        if (sectionText.length > 0) {
          sections.push({ title: currentTitle, text: sectionText });
        }
      }
      currentTitle = extractHeadingTitle(line);
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // Save last section
  if (currentLines.length > 0) {
    const sectionText = currentLines.join('\n').trim();
    if (sectionText.length > 0) {
      sections.push({ title: currentTitle, text: sectionText });
    }
  }

  // If no sections were found (no headings), treat the whole text as one section
  if (sections.length === 0 && text.trim().length > 0) {
    sections.push({ title: '', text: text.trim() });
  }

  return sections;
}

function splitByParagraphs(text: string, title: string): TextChunk[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: TextChunk[] = [];

  let currentText = '';
  let isFirst = true;

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) continue;

    if (currentText.length + trimmedParagraph.length + 2 > MAX_CHUNK_SIZE && currentText.length > 0) {
      chunks.push({ title: isFirst ? title : `${title} (계속)`, text: currentText.trim() });
      currentText = trimmedParagraph;
      isFirst = false;
    } else {
      if (currentText.length > 0) {
        currentText += '\n\n' + trimmedParagraph;
      } else {
        currentText = trimmedParagraph;
      }
    }
  }

  if (currentText.trim().length > 0) {
    chunks.push({ title: isFirst ? title : `${title} (계속)`, text: currentText.trim() });
  }

  // Handle individual paragraphs that exceed max size
  const finalChunks: TextChunk[] = [];
  for (const chunk of chunks) {
    if (chunk.text.length > MAX_CHUNK_SIZE) {
      const splitSentences = splitBySentences(chunk.text, chunk.title);
      finalChunks.push(...splitSentences);
    } else {
      finalChunks.push(chunk);
    }
  }

  return finalChunks;
}

function splitBySentences(text: string, title: string): TextChunk[] {
  // Split by sentence boundaries
  const sentenceRegex = /[.!?。！？]\s+/g;
  const sentences: string[] = [];
  let lastIndex = 0;
  let match;

  while ((match = sentenceRegex.exec(text)) !== null) {
    const sentence = text.slice(lastIndex, match.index + match[0].length);
    sentences.push(sentence);
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    sentences.push(text.slice(lastIndex));
  }

  if (sentences.length === 0) {
    // Force split by character count
    const chunks: TextChunk[] = [];
    let i = 0;
    let partNum = 1;
    while (i < text.length) {
      chunks.push({
        title: partNum === 1 ? title : `${title} (${partNum})`,
        text: text.slice(i, i + MAX_CHUNK_SIZE),
      });
      i += MAX_CHUNK_SIZE;
      partNum++;
    }
    return chunks;
  }

  const chunks: TextChunk[] = [];
  let currentText = '';
  let partNum = 1;

  for (const sentence of sentences) {
    if (currentText.length + sentence.length > MAX_CHUNK_SIZE && currentText.length > 0) {
      chunks.push({ title: partNum === 1 ? title : `${title} (${partNum})`, text: currentText.trim() });
      currentText = sentence;
      partNum++;
    } else {
      currentText += sentence;
    }
  }

  if (currentText.trim().length > 0) {
    chunks.push({ title: partNum === 1 ? title : `${title} (${partNum})`, text: currentText.trim() });
  }

  return chunks;
}
