import bcrypt from 'bcryptjs';

const plain = process.argv[2];
if (!plain) {
  console.error('Uso: npm run hash -- <contraseña>');
  process.exit(1);
}

console.log(bcrypt.hashSync(plain, 10));
