import { buildProduction } from './build-deployment.js';

buildProduction().catch((error) => {
  console.error('Failed to run build-deployment:', error);
  process.exit(1);
});
