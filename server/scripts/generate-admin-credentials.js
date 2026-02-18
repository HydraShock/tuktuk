const crypto = require('crypto');

function generatePassword(length = 26) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+[]{}';
  const bytes = crypto.randomBytes(length * 2);
  let out = '';
  for (let i = 0; i < bytes.length && out.length < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function createScryptHash(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

const email = `admin.${crypto.randomBytes(3).toString('hex')}@tuktukroma.com`;
const password = generatePassword();
const passwordHash = createScryptHash(password);

console.log('Nuove credenziali admin generate:');
console.log(`EMAIL: ${email}`);
console.log(`PASSWORD: ${password}`);
console.log('');
console.log('Variabili da inserire nel file .env:');
console.log(`ADMIN_EMAIL=${email}`);
console.log(`ADMIN_PASSWORD_HASH=${passwordHash}`);
console.log('ADMIN_PASSWORD=');
