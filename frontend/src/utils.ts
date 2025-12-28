export function humanSize(bytes: number | undefined): string {
  if (bytes === undefined) return '';
  const b = Number(bytes);
  if (b < 1024) return b + ' B';
  const kb = b / 1024;
  if (kb < 1024) return Math.round(kb) + ' KB';
  const mb = kb / 1024;
  if (mb < 1024) return Math.round(mb) + ' MB';
  const gb = mb / 1024;
  return Math.round(gb) + ' GB';
}
