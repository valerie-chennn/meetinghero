export function parseNewsTitle(title: string) {
  const match = title.match(/【(.+?)】(.+)/);
  if (match) {
    return { source: match[1], headline: match[2] };
  }
  return { source: '', headline: title };
}

export function formatCount(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function highlightSegments(text: string, highlights: string[]) {
  if (!highlights.length) return [{ text, highlighted: false }];

  const sorted = [...highlights].sort((a, b) => b.length - a.length);
  const escaped = sorted.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');

  return text.split(regex).filter(Boolean).map((part) => ({
    text: part,
    highlighted: sorted.some((item) => item.toLowerCase() === part.toLowerCase()),
  }));
}

export function renderMentionText(text: string, userName?: string | null) {
  return text.replace(/@\{username\}/g, `@${userName || 'you'}`);
}
