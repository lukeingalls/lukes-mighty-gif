export function concat(a: Uint8Array, b: Uint8Array) {
  const c = new Uint8Array(a.length + b.length);
  c.set(a);
  c.set(b, a.length);
  return c;
}

export function bits(input: number, startBit: number, length = 1) {
  let string = input.toString(2);
  while (string.length < 8) string = '0' + string;
  string = string.substring(startBit, startBit + length);

  return parseInt(string, 2);
}
