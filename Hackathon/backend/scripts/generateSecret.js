// Imprime un secreto aleatorio apto para JWT_SECRET o ADMIN_API_KEY.
// Uso: npm run secret
import crypto from 'node:crypto';

console.log(crypto.randomBytes(48).toString('hex'));
