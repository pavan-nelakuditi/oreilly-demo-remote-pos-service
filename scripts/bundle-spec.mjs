import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const sourcePath = path.join(rootDir, 'api/openapi.yaml');
const sharedContractsPath = path.join(rootDir, 'shared-contracts/common-schemas.yaml');
const distPath = path.join(rootDir, 'api/openapi.bundled.yaml');
const sharedContractsRefPrefix = '../shared-contracts/common-schemas.yaml';

try {
  await access(sharedContractsPath);
} catch {
  throw new Error(
    'Missing shared-contracts/common-schemas.yaml. Populate shared-contracts/ before bundling.'
  );
}

const [sourceSpec, sharedContractsSpec] = await Promise.all([
  readFile(sourcePath, 'utf8').then((content) => YAML.parse(content)),
  readFile(sharedContractsPath, 'utf8').then((content) => YAML.parse(content))
]);

const bundledSpec = structuredClone(sourceSpec);
const importedSharedComponents = new Set();

function parseComponentPointer(pointer) {
  if (!pointer.startsWith('#/components/')) {
    return null;
  }

  const [, componentsKey, category, name] = pointer.split('/');
  if (componentsKey !== 'components' || !category || !name) {
    return null;
  }

  return { category, name };
}

function addOriginMetadata(value, pointer) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return;
  }

  value['x-origin'] = {
    source: '../shared-contracts/common-schemas.yaml',
    component: pointer
  };
}

function importSharedComponent(pointer) {
  const parsedPointer = parseComponentPointer(pointer);
  if (!parsedPointer) {
    throw new Error(`Unsupported shared component pointer: ${pointer}`);
  }

  const componentKey = `${parsedPointer.category}/${parsedPointer.name}`;
  if (importedSharedComponents.has(componentKey)) {
    return;
  }

  const sharedComponent = sharedContractsSpec.components?.[parsedPointer.category]?.[parsedPointer.name];
  if (sharedComponent === undefined) {
    throw new Error(`Shared component ${pointer} was not found in shared-contracts/common-schemas.yaml`);
  }

  bundledSpec.components ??= {};
  bundledSpec.components[parsedPointer.category] ??= {};

  if (
    bundledSpec.components[parsedPointer.category][parsedPointer.name] !== undefined &&
    !importedSharedComponents.has(componentKey)
  ) {
    throw new Error(`Shared component ${pointer} conflicts with an existing local component.`);
  }

  importedSharedComponents.add(componentKey);
  const importedComponent = structuredClone(sharedComponent);
  addOriginMetadata(importedComponent, pointer);
  rewriteRefs(importedComponent, 'shared');
  bundledSpec.components[parsedPointer.category][parsedPointer.name] = importedComponent;
}

function rewriteRef(refValue, context) {
  if (refValue.startsWith(sharedContractsRefPrefix)) {
    const pointer = refValue.slice(sharedContractsRefPrefix.length);
    importSharedComponent(pointer);
    return pointer;
  }

  if (context === 'shared' && refValue.startsWith('#/components/')) {
    importSharedComponent(refValue);
  }

  return refValue;
}

function rewriteRefs(value, context) {
  if (Array.isArray(value)) {
    for (const item of value) {
      rewriteRefs(item, context);
    }
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  if (typeof value.$ref === 'string') {
    value.$ref = rewriteRef(value.$ref, context);
  }

  for (const nestedValue of Object.values(value)) {
    rewriteRefs(nestedValue, context);
  }
}

rewriteRefs(bundledSpec, 'service');

await mkdir(path.dirname(distPath), { recursive: true });
await writeFile(distPath, YAML.stringify(bundledSpec), 'utf8');

console.log(`Bundled spec written to ${path.relative(rootDir, distPath)}`);
