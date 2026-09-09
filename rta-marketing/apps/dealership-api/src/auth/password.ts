import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const keyLength = 64;
const cost = 16_384;
const blockSize = 8;
const parallelization = 1;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, keyLength, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: 64 * 1024 * 1024,
  });
  return ["scrypt", cost, blockSize, parallelization, salt.toString("base64"), hash.toString("base64")].join("$");
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [algorithm, n, r, p, saltValue, hashValue] = encoded.split("$");
  if (!algorithm || algorithm !== "scrypt" || !n || !r || !p || !saltValue || !hashValue) {
    return false;
  }

  const expected = Buffer.from(hashValue, "base64");
  const actual = scryptSync(password, Buffer.from(saltValue, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
