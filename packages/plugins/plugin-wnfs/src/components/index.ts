//
// Copyright 2023 DXOS.org
//

import React from 'react';

// Lazily load components for content surfaces.
export const FileContainer = React.lazy(() => import('./FileContainer'));

export * from './FileInput';
