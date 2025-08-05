export function generateCode(length = 7): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < length; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}
