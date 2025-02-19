//
// Copyright 2022 DXOS.org
//

import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { useAsyncEffect } from './useAsyncEffect';

const doAsync = async <T,>(value: T) =>
  await new Promise<T>((resolve) => {
    resolve(value);
  });

const Test = () => {
  const [value, setValue] = useState<string>();
  useAsyncEffect(async (isMounted) => {
    const value = await doAsync('DXOS');
    if (isMounted()) {
      void act(() => {
        setValue(value);
      });
    }
  }, []);

  return <h1>{value}</h1>;
};

let rootContainer: HTMLElement;

describe('useAsyncEffect', () => {
  beforeEach(() => {
    rootContainer = document.createElement('div');
    document.body.appendChild(rootContainer);
  });

  afterEach(() => {
    document.body.removeChild(rootContainer!);
  });

  test('gets async value.', async () => {
    await act(() => {
      createRoot(rootContainer).render(<Test />);
    });

    const h1 = rootContainer.querySelector('h1');
    expect(h1?.textContent).toEqual('DXOS');
  });
});
