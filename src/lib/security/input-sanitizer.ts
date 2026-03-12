const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
}

export function sanitizeInput(input: string, maxLength = 10000): string {
  if (input.length > maxLength) {
    input = input.slice(0, maxLength);
  }
  // Strip null bytes
  input = input.replace(/\0/g, '');
  return input;
}

export function sanitizeForDisplay(input: string): string {
  return escapeHtml(sanitizeInput(input));
}
