import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

const rootDir = process.cwd();
const specPath = path.join(rootDir, 'api/openapi.yaml');

const requiredInfoExtensions = [
  'x-owner',
  'x-domain',
  'x-workshop-pattern',
  'x-api-lifecycle'
];

const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function looksLikeSemver(value) {
  return /^\d+\.\d+\.\d+(?:[-+].+)?$/.test(value);
}

function hasSuccessResponse(operation) {
  return Object.keys(operation.responses ?? {}).some((statusCode) => /^2\d\d$/.test(statusCode));
}

function collectProblems(spec) {
  const problems = [];

  if (!isNonEmptyString(spec?.openapi)) {
    problems.push('Spec must declare an OpenAPI version.');
  }

  if (!isNonEmptyString(spec?.info?.title)) {
    problems.push('`info.title` is required.');
  }

  if (!isNonEmptyString(spec?.info?.version) || !looksLikeSemver(spec.info.version)) {
    problems.push('`info.version` must be a non-empty semver string like `1.0.0`.');
  }

  for (const extension of requiredInfoExtensions) {
    if (!isNonEmptyString(spec?.info?.[extension])) {
      problems.push(`\`info.${extension}\` is required for workshop governance.`);
    }
  }

  if (!Array.isArray(spec?.tags) || spec.tags.length === 0) {
    problems.push('At least one top-level tag is required.');
  }

  const tagNames = new Set((spec.tags ?? []).map((tag) => tag?.name).filter(isNonEmptyString));

  if (!spec?.paths || typeof spec.paths !== 'object') {
    problems.push('Spec must define at least one path.');
    return problems;
  }

  for (const [routePath, pathItem] of Object.entries(spec.paths)) {
    if (!routePath.startsWith('/')) {
      problems.push(`Path \`${routePath}\` must start with \`/\`.`);
    }

    for (const method of httpMethods) {
      const operation = pathItem?.[method];
      if (!operation) continue;

      const opLabel = `${method.toUpperCase()} ${routePath}`;

      if (!isNonEmptyString(operation.summary)) {
        problems.push(`${opLabel} is missing \`summary\`.`);
      }

      if (!isNonEmptyString(operation.operationId)) {
        problems.push(`${opLabel} is missing \`operationId\`.`);
      }

      if (!Array.isArray(operation.tags) || operation.tags.length === 0) {
        problems.push(`${opLabel} must declare at least one tag.`);
      } else {
        for (const tag of operation.tags) {
          if (!tagNames.has(tag)) {
            problems.push(`${opLabel} uses unknown tag \`${tag}\`.`);
          }
        }
      }

      if (!operation.responses || typeof operation.responses !== 'object') {
        problems.push(`${opLabel} must define responses.`);
      } else if (!hasSuccessResponse(operation)) {
        problems.push(`${opLabel} must define at least one 2xx response.`);
      }
    }
  }

  return problems;
}

const rawSpec = await fs.readFile(specPath, 'utf8');
const spec = YAML.parse(rawSpec);
const problems = collectProblems(spec);

if (problems.length > 0) {
  console.error('Governance check failed:');
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log('Governance check passed.');
