import {
  Config,
  JSONSourceCode,
  LiquidSourceCode,
  Offense,
  Theme,
  toSourceCode as commonToSourceCode,
  check as coreCheck,
  isIgnored,
  parseJSON,
} from '@shopify/theme-check-common';
import { ThemeLiquidDocsManager } from '@shopify/theme-check-docs-updater';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import glob = require('glob');

import { autofix } from './autofix';
import { findConfigPath, loadConfig as resolveConfig } from './config';
import { fileExists, fileSize } from './file-utils';

const defaultLocale = 'en';
const asyncGlob = promisify(glob);

export * from '@shopify/theme-check-common';
export * from './config/types';
export { PathHandler, findRoot, reusableFindRoot } from './find-root';

export const loadConfig: typeof resolveConfig = async (configPath, root) => {
  configPath ??= await findConfigPath(root);
  return resolveConfig(configPath, root);
};

export type ThemeCheckRun = {
  theme: Theme;
  config: Config;
  offenses: Offense[];
};

export async function toSourceCode(
  absolutePath: string,
): Promise<LiquidSourceCode | JSONSourceCode | undefined> {
  try {
    const source = await fs.readFile(absolutePath, 'utf8');
    return commonToSourceCode(absolutePath, source);
  } catch (e) {
    return undefined;
  }
}

export async function check(root: string, configPath?: string): Promise<Offense[]> {
  const run = await themeCheckRun(root, configPath);
  return run.offenses;
}

export async function checkAndAutofix(root: string, configPath?: string) {
  const { theme, offenses } = await themeCheckRun(root, configPath);
  await autofix(theme, offenses);
}

const useDebugLogging = () => process.env.SHOPIFY_FLAG_VERBOSE || process.env.ACTIONS_RUNNER_DEBUG;

export async function themeCheckRun(root: string, configPath?: string): Promise<ThemeCheckRun> {
  const { theme, config } = await getThemeAndConfig(root, configPath);
  const defaultTranslationsFile = theme.find((sc) => sc.absolutePath.endsWith('default.json'));
  const defaultTranslations = parseJSON(defaultTranslationsFile?.source ?? '{}', {});
  const defaultSchemaTranslationsFile = theme.find((sc) =>
    sc.absolutePath.endsWith('default.schema.json'),
  );
  const defaultSchemaTranslations = parseJSON(defaultSchemaTranslationsFile?.source ?? '{}', {});
  const logger = useDebugLogging() ? console.error.bind(console) : () => {};
  const themeLiquidDocsManager = new ThemeLiquidDocsManager(logger);

  const offenses = await coreCheck(theme, config, {
    fileExists,
    fileSize,
    themeDocset: themeLiquidDocsManager,
    jsonValidationSet: themeLiquidDocsManager,
    getDefaultTranslations: async () => defaultTranslations,
    getDefaultLocale: async () => {
      if (!defaultTranslationsFile) {
        return defaultLocale;
      }
      // assumes the path is normalized and '/' are used as separators
      const defaultTranslationsFileLocale = defaultTranslationsFile.absolutePath.match(
        /locales\/(.*)\.default\.json$/,
      )?.[1];
      return defaultTranslationsFileLocale || defaultLocale;
    },
    getDefaultSchemaTranslations: async () => defaultSchemaTranslations,
    getDefaultSchemaLocale: async () => {
      if (!defaultSchemaTranslationsFile) {
        return defaultLocale;
      }
      // assumes the path is normalized and '/' are used as separators
      const defaultTranslationsFileLocale = defaultSchemaTranslationsFile.absolutePath.match(
        /locales\/(.*)\.default\.schema\.json$/,
      )?.[1];
      return defaultTranslationsFileLocale || defaultLocale;
    },
  });

  return {
    theme,
    config,
    offenses,
  };
}

async function getThemeAndConfig(
  root: string,
  configPath?: string,
): Promise<{ theme: Theme; config: Config }> {
  const config = await loadConfig(configPath, root);
  const theme = await getTheme(config);
  return {
    theme,
    config,
  };
}

export async function getTheme(config: Config): Promise<Theme> {
  // On windows machines - the separator provided by path.join is '\'
  // however the glob function fails silently since '\' is used to escape glob charater
  // as mentioned in the documentation of node-glob

  // the path is normalised and '\' are replaced with '/' and then passed to the glob function
  const normalizedGlob = path
    .normalize(path.join(config.root, '**/*.{liquid,json}'))
    .replace(/\\/g, '/');
  const paths = await asyncGlob(normalizedGlob).then((result) =>
    // Global ignored paths should not be part of the theme
    result.filter((filePath) => !isIgnored(filePath, config)),
  );
  const sourceCodes = await Promise.all(paths.map(toSourceCode));
  return sourceCodes.filter((x): x is LiquidSourceCode | JSONSourceCode => x !== undefined);
}
