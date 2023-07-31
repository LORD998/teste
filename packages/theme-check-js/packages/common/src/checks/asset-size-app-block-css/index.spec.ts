import { expect, describe, it } from 'vitest';
import { AssetSizeAppBlockCSS } from '.';
import { check, MockTheme } from '../../test';
import { SchemaProp } from '../../types';

describe('Module: AssetSizeAppBlockCSS', () => {
  const extensionFiles: MockTheme = {
    'assets/app.css': '* { color: green } ',
    'blocks/app.liquid': `
      {% schema %}
      {
        "stylesheet": "app.css"
      }
      {% endschema %}
    `,
  };

  it('should not report any offenses if CSS is smaller than threshold', async () => {
    const offenses = await check(extensionFiles, [AssetSizeAppBlockCSS]);

    expect(offenses).toHaveLength(0);
  });

  it('should skip the check if context.fileSize is undefined', async () => {
    const context = {
      fileSize: undefined,
    };

    const offenses = await check(extensionFiles, [AssetSizeAppBlockCSS], context);
    expect(offenses).toHaveLength(0);
  });

  it('should report an offense if CSS is larger than threshold', async () => {
    const CustomAssetSizeAppBlockCSS = {
      ...AssetSizeAppBlockCSS,
      meta: {
        ...AssetSizeAppBlockCSS.meta,
        schema: {
          thresholdInBytes: SchemaProp.number(1),
        },
      },
    };

    const offenses = await check(extensionFiles, [CustomAssetSizeAppBlockCSS]);

    expect(offenses).toHaveLength(1);
    expect(offenses[0]).toMatchObject({
      message: 'The CSS file size exceeds the configured threshold.',
      absolutePath: '/blocks/app.liquid',
      start: { index: 51 },
      end: { index: 57 },
    });
  });

  it('should report an offense if the CSS file does not exist', async () => {
    const extensionFiles: MockTheme = {
      'blocks/app.liquid': `
        {% schema %}
        {
          "stylesheet": "nonexistent.css"
        }
        {% endschema %}
      `,
    };

    const offenses = await check(extensionFiles, [AssetSizeAppBlockCSS]);

    expect(offenses).toHaveLength(1);
    expect(offenses[0]).toMatchObject({
      message: `'nonexistent.css' does not exist.`,
      absolutePath: '/blocks/app.liquid',
      start: { index: 57 },
      end: { index: 71 },
    });
  });
});
