import { loadConfiguration } from '@cucumber/cucumber/api';

export default async function () {
  return await loadConfiguration({
    provided: {
      paths: ['e2e/features/**/*.feature'],
      require: ['e2e/steps/**/*.ts'],
      requireModule: ['ts-node/register'],
      publishQuiet: true,
      format: ['progress'],
    },
  });
}
