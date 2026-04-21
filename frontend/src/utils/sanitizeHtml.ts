import DOMPurify from 'dompurify';

const SANITIZE_OPTIONS = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'blockquote',
    'code',
    'pre',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'a',
    'img',
    'span',
  ],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel', 'class'],
  ALLOW_DATA_ATTR: false,
};

export const sanitizeRichHtml = (value: string) => DOMPurify.sanitize(value, SANITIZE_OPTIONS);
