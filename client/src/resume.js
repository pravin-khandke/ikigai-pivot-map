export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_CHARS = 6000;

const ALLOWED_EXT = ['pdf', 'docx', 'txt'];
const REMOVED = '[removed]';
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;
// bare domains incl. linkedin.com/in/x, github.com/x, jane.dev
const BARE_DOMAIN = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|dev|io|net|org|me|co)\b(?:\/\S*)?/gi;
// number + 1-3 capitalised words + suffix (+ ", City"); case-sensitive to spare "at Dr Reddys"
const STREET = /\b\d{1,6}\s+(?:[A-Z][\w'.-]*\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl)\b\.?(?:,[ ]*[A-Z][a-z]+)?/g;
const PHONE = /(?<![\w])\+?\(?\d[\d\s().-]{7,}\d(?!\w)/g;
const MIN_PHONE_DIGITS = 10;

/** Strip PII, collapse whitespace, cap length. Pure; nothing is logged or stored. */
export function redact(text) {
  return String(text ?? '')
    .replace(EMAIL, REMOVED)
    .replace(URL_RE, REMOVED)
    .replace(BARE_DOMAIN, REMOVED)
    .replace(STREET, REMOVED)
    // ponytail: digit-count heuristic; year ranges stay, odd local formats may slip through
    .replace(PHONE, (m) => (m.replace(/\D/g, '').length >= MIN_PHONE_DIGITS ? REMOVED : m))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CHARS);
}

export function validateFile(file) {
  const ext = String(file.name).split('.').pop().toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) return { ok: false, error: 'Please upload a PDF, DOCX or TXT file.' };
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: 'File is too large. The limit is 2 MB.' };
  return { ok: true };
}

async function pdfText(file) {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    pages.push(content.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join(''));
  }
  return pages.join('\n');
}

async function docxText(file) {
  const mammoth = await import('mammoth');
  return (await (mammoth.default ?? mammoth).extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
}

/** Extract raw text from a File. Throws Error with a user-readable message. */
export async function extractText(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const readers = { txt: () => file.text(), pdf: () => pdfText(file), docx: () => docxText(file) };
  const label = ext.toUpperCase();
  try {
    if (!readers[ext]) throw new Error('unsupported');
    return await readers[ext]();
  } catch {
    throw new Error(`Could not read this ${label}. Try pasting the text instead.`);
  }
}
