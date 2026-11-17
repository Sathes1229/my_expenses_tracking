/** Fills `{name}` placeholders. A placeholder with no value stays as it is, so a gap is visible. */
export function fmt(template: string, params?: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    params && name in params ? String(params[name]) : placeholder,
  );
}
