import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const baselinePath = path.join(rootDir, 'baselines/openapi.yaml');
const currentPath = path.join(rootDir, 'api/openapi.yaml');

function loadYaml(filePath) {
  return readFile(filePath, 'utf8').then((content) => YAML.parse(content));
}

function compareValues(base, current, context, issues) {
  if (base === undefined) {
    return;
  }

  if (typeof base === 'string' || typeof base === 'number' || typeof base === 'boolean') {
    if (base !== current) {
      issues.push(`${context} changed from ${JSON.stringify(base)} to ${JSON.stringify(current)}`);
    }
    return;
  }

  if (Array.isArray(base)) {
    if (!Array.isArray(current)) {
      issues.push(`${context} changed from array to non-array`);
      return;
    }

    const baseIsScalar = base.every((item) => ['string', 'number', 'boolean'].includes(typeof item));
    if (baseIsScalar) {
      const currentSet = new Set(current.map((item) => JSON.stringify(item)));
      for (const item of base) {
        if (!currentSet.has(JSON.stringify(item))) {
          issues.push(`${context} is missing value ${JSON.stringify(item)}`);
        }
      }
      return;
    }

    for (let index = 0; index < base.length; index += 1) {
      compareValues(base[index], current[index], `${context}[${index}]`, issues);
    }
    return;
  }

  if (base && typeof base === 'object') {
    if (!current || typeof current !== 'object') {
      issues.push(`${context} changed from object to non-object`);
      return;
    }

    for (const key of Object.keys(base)) {
      compareValues(base[key], current[key], `${context}.${key}`, issues);
    }
  }
}

function comparePaths(basePaths, currentPaths, issues) {
  for (const pathName of Object.keys(basePaths)) {
    if (!currentPaths?.[pathName]) {
      issues.push(`Path removed: ${pathName}`);
      continue;
    }

    for (const method of Object.keys(basePaths[pathName])) {
      if (!currentPaths[pathName][method]) {
        issues.push(`Operation removed: ${method.toUpperCase()} ${pathName}`);
      }
    }
  }
}

function compareSchemas(baseSchemas, currentSchemas, issues) {
  for (const schemaName of Object.keys(baseSchemas)) {
    if (!currentSchemas?.[schemaName]) {
      issues.push(`Schema removed: ${schemaName}`);
      continue;
    }

    compareValues(
      baseSchemas[schemaName],
      currentSchemas[schemaName],
      `components.schemas.${schemaName}`,
      issues
    );
  }
}

const [baseline, current] = await Promise.all([
  loadYaml(baselinePath),
  loadYaml(currentPath)
]);

const issues = [];
comparePaths(baseline.paths ?? {}, current.paths ?? {}, issues);
compareSchemas(
  baseline.components?.schemas ?? {},
  current.components?.schemas ?? {},
  issues
);

if (issues.length > 0) {
  console.error('Breaking changes detected:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log('No breaking changes detected against baseline.');

