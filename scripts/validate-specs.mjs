import SwaggerParser from '@apidevtools/swagger-parser';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const sourcePath = path.join(rootDir, 'api/openapi.yaml');
const sharedContractsPath = path.join(rootDir, 'shared-contracts/common-schemas.yaml');
const bundledPath = path.join(rootDir, 'api/openapi.bundled.yaml');

try {
  await access(sharedContractsPath);
} catch {
  throw new Error(
    'Missing shared-contracts/common-schemas.yaml. Populate shared-contracts/ before validating specs.'
  );
}

await SwaggerParser.validate(sourcePath);
console.log('Validated source spec: api/openapi.yaml');

await import(path.join(rootDir, 'scripts/bundle-spec.mjs'));
await SwaggerParser.validate(bundledPath);
console.log('Validated bundled spec: api/openapi.bundled.yaml');

