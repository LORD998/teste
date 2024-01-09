const moduleAlias = require('module-alias');
const path = require('path');

const prettierMajor = process.env.PRETTIER_MAJOR;
const prettierPath =
  prettierMajor === '3'
    ? path.join(__dirname, '..', '..', '..', '..', 'node_modules', 'prettier3')
    : path.join(__dirname, '..', '..', '..', '..', 'node_modules', 'prettier2');

export function setup() {
  moduleAlias.addAlias('prettier', prettierPath);
  console.error('====================================');
  console.error(`Prettier version: ${require('prettier').version}`);
  console.error('====================================');
}
