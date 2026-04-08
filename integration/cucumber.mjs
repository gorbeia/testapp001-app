import { loadConfiguration } from "@cucumber/cucumber/api";

export default async function () {
  return await loadConfiguration({
    provided: {
      paths: ["integration/features/**/*.feature"],
      require: ["integration/steps/**/*.ts"],
      requireModule: ["ts-node/register"],
      publishQuiet: true,
      format: ["progress-bar"],
    },
  });
}
