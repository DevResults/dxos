//
// Copyright 2022 DXOS.org
//

import '@dxos-theme';

import React, { type ReactNode, useState } from 'react';

import { Toast } from './Toast';
import { withTheme } from '../../testing';
import { Button } from '../Buttons';

type ActionTriggerProps = { altText: string; trigger: ReactNode };

type StorybookToastProps = Partial<{
  openTrigger: string;
  title: string;
  description: string;
  actionTriggers: ActionTriggerProps[];
  closeTrigger: ReactNode;
}>;

const StorybookToast = (props: StorybookToastProps) => {
  const [open, setOpen] = useState(true);
  return (
    <Toast.Provider>
      <Button onClick={() => setOpen(true)}>{props.openTrigger}</Button>
      <Toast.Viewport />
      <Toast.Root open={open} onOpenChange={setOpen}>
        <Toast.Body>
          <Toast.Title>{props.title}</Toast.Title>
          <Toast.Description>{props.description}</Toast.Description>
        </Toast.Body>
        <Toast.Actions>
          <Toast.Close asChild={typeof props.closeTrigger !== 'string'}>{props.closeTrigger}</Toast.Close>
          {(props.actionTriggers || []).map(({ altText, trigger }: ActionTriggerProps, index: number) => (
            <Toast.Action key={index} altText={altText} asChild={typeof trigger !== 'string'}>
              {trigger}
            </Toast.Action>
          ))}
        </Toast.Actions>
      </Toast.Root>
    </Toast.Provider>
  );
};

export default {
  title: 'ui/react-ui-core/Toast',
  component: Toast,
  render: StorybookToast,
  decorators: [withTheme],
  parameters: { chromatic: { disableSnapshot: false } },
};

export const Default = {
  args: {
    openTrigger: 'Open toast',
    title: 'Hi, this is a toast',
    description: 'This goes away on its own with a timer.',
    actionTriggers: [{ altText: 'Press F5 to reload the page', trigger: <Button variant='primary'>Reload</Button> }],
    closeTrigger: <Button>Close</Button>,
  },
  parameters: {
    chromatic: { delay: 800 },
  },
};
