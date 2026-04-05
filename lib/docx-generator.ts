import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Packer,
} from 'docx';
import type { Job, Chunk } from '@/types';

export async function generateDocx(
  job: Job,
  chunks: Chunk[],
  version: 'draft' | 'final'
): Promise<Buffer> {
  const docTitle = job.source_name || job.source_url || 'Translation';
  const versionLabel = version === 'draft' ? '번역 초안' : '후처리본';
  const langPairLabel = job.language_pair === 'en->ko' ? '영어 → 한국어' : '한국어 → 영어';

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: docTitle,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    })
  );

  // Subtitle info
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `번역 버전: ${versionLabel} | 언어: ${langPairLabel} | 스타일: ${job.translation_style}`,
          italics: true,
          color: '666666',
        }),
      ],
      alignment: AlignmentType.CENTER,
    })
  );

  // Separator
  children.push(
    new Paragraph({
      text: '',
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 6,
          color: 'CCCCCC',
        },
      },
    })
  );

  // Content chunks
  for (const chunk of chunks) {
    const translatedText =
      version === 'final'
        ? chunk.translated_text_final || chunk.translated_text_draft || ''
        : chunk.translated_text_draft || '';

    // Section title
    if (chunk.section_title) {
      children.push(
        new Paragraph({
          text: chunk.section_title,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        })
      );
    } else {
      children.push(new Paragraph({ text: '' }));
    }

    // Original text label
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: '원문',
            bold: true,
            color: '2563EB',
            size: 20,
          }),
        ],
        spacing: { before: 200, after: 100 },
      })
    );

    // Original text content
    const originalLines = chunk.original_text.split('\n');
    for (const line of originalLines) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line || ' ',
              color: '374151',
            }),
          ],
          indent: { left: 360 },
        })
      );
    }

    // Translation label
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: '번역',
            bold: true,
            color: '16A34A',
            size: 20,
          }),
        ],
        spacing: { before: 200, after: 100 },
      })
    );

    // Translation content
    if (translatedText) {
      const translatedLines = translatedText.split('\n');
      for (const line of translatedLines) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line || ' ',
                color: '374151',
              }),
            ],
            indent: { left: 360 },
          })
        );
      }
    } else {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: chunk.status === 'failed' ? '[번역 실패]' : '[번역 없음]',
              color: 'DC2626',
              italics: true,
            }),
          ],
          indent: { left: 360 },
        })
      );
    }

    // Divider between chunks
    children.push(
      new Paragraph({
        text: '',
        spacing: { after: 200 },
      })
    );
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Malgun Gothic',
            size: 22,
          },
        },
      },
    },
    sections: [
      {
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
