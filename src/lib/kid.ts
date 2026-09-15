export function createKid(invoiceNumber: number) {
  const base = String(invoiceNumber);
  let sum = 0; let factor = 2;
  for (let index = base.length - 1; index >= 0; index--) { const product = Number(base[index]) * factor; sum += Math.floor(product / 10) + (product % 10); factor = factor === 2 ? 1 : 2; }
  return `${base}${(10 - (sum % 10)) % 10}`;
}
