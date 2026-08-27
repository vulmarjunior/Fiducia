import { describe, expect, it } from 'vitest';
import { getVendorChunk } from './vite.config';

describe('getVendorChunk', () => {
  it.each([
    ['/project/node_modules/firebase/firestore/dist/index.mjs', 'firebase-runtime'],
    ['/project/node_modules/@firebase/auth/dist/esm2017/index.js', 'firebase-runtime'],
    ['C:\\project\\node_modules\\@firebase\\util\\dist\\index.esm2017.js', 'firebase-runtime'],
    ['/project/node_modules/react-dom/client.js', 'react-runtime'],
    ['/project/node_modules/react-router/dist/development/index.mjs', 'react-runtime'],
    ['/project/node_modules/@base-ui/react/dialog/index.js', 'ui-runtime'],
    ['/project/node_modules/sonner/dist/index.mjs', 'ui-runtime'],
  ])('assigns %s to %s', (moduleId, expectedChunk) => {
    expect(getVendorChunk(moduleId)).toBe(expectedChunk);
  });

  it('does not pull route-specific packages into the initial runtime', () => {
    expect(getVendorChunk('/project/node_modules/react-select/dist/react-select.esm.js')).toBeUndefined();
    expect(getVendorChunk('/project/src/pages/Dashboard.tsx')).toBeUndefined();
  });
});
