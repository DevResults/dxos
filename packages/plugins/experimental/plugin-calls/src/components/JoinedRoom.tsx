//
// Copyright 2024 DXOS.org
//

import { PhoneX } from '@phosphor-icons/react';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { Flipper } from 'react-flip-toolkit';
import { useMeasure, useMount } from 'react-use';

import { Button } from '@dxos/react-ui';
import { nonNullable } from '@dxos/util';

import { CameraButton } from './CameraButton';
import { MicButton } from './MicButton';
import { Participant } from './Participant';
import { PullAudioTracks } from './PullAudioTracks';
import { PullVideoTrack } from './PullVideoTrack';
import { useBroadcastStatus } from './hooks/useBroadcastStatus';
import { useRoomContext } from './hooks/useRoomContext';
import { calculateLayout } from './utils/calculateLayout';

export const useDebugEnabled = () => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'd' && e.ctrlKey) {
        e.preventDefault();
        setEnabled(!enabled);
      }
    };
    document.addEventListener('keypress', handler);

    return () => {
      document.removeEventListener('keypress', handler);
    };
  }, [enabled]);

  return enabled;
};

export const JoinedRoom = () => {
  const {
    userMedia,
    peer,
    dataSaverMode,
    pushedTracks,
    setJoined,
    room: { otherUsers, updateUserState, identity },
  } = useRoomContext()!;

  const [containerRef, { width: containerWidth, height: containerHeight }] = useMeasure<HTMLDivElement>();
  const [firstFlexChildRef, { width: firstFlexChildWidth }] = useMeasure<HTMLDivElement>();
  const debugEnabled = useDebugEnabled();

  const totalUsers = 1 + otherUsers.length;

  useMount(() => {
    if (otherUsers.length > 5) {
      userMedia.turnMicOff();
    }
  });

  useBroadcastStatus({
    userMedia,
    peer,
    updateUserState,
    identity,
    pushedTracks,
  });

  const [pinnedId, setPinnedId] = useState<string>();

  const flexContainerWidth = useMemo(
    () =>
      100 /
        calculateLayout({
          count: totalUsers,
          height: containerHeight,
          width: containerWidth,
        }).cols +
      '%',
    [totalUsers, containerHeight, containerWidth],
  );

  return (
    <PullAudioTracks audioTracks={otherUsers.map((u) => u.tracks?.audio).filter(nonNullable)}>
      <div className='flex flex-col h-full bg-white dark:bg-zinc-800'>
        <Flipper flipKey={totalUsers} className='relative flex-grow overflow-hidden isolate'>
          <div
            className='absolute inset-0 h-full w-full bg-black isolate flex flex-wrap justify-around gap-[--gap] p-[--gap]'
            style={
              {
                '--gap': '1rem',
                // the flex basis that is needed to achieve row layout
                '--flex-container-width': flexContainerWidth,
                // the size of the first user's flex container
                '--participant-max-width': firstFlexChildWidth + 'px',
              } as any
            }
            ref={containerRef}
          >
            {identity && userMedia.audioStreamTrack && (
              <Participant
                user={identity}
                isSelf
                flipId={'identity user'}
                ref={firstFlexChildRef}
                videoTrack={userMedia.videoStreamTrack}
                audioTrack={userMedia.audioStreamTrack}
                pinnedId={pinnedId}
                setPinnedId={setPinnedId}
                showDebugInfo={debugEnabled}
              />
            )}

            {otherUsers.map(
              (user) =>
                user.joined && (
                  <Fragment key={user.id}>
                    <PullVideoTrack video={dataSaverMode ? undefined : user.tracks?.video} audio={user.tracks?.audio}>
                      {({ videoTrack, audioTrack }) => (
                        <Participant
                          user={user}
                          flipId={user.id!}
                          videoTrack={videoTrack}
                          audioTrack={audioTrack}
                          pinnedId={pinnedId}
                          setPinnedId={setPinnedId}
                          showDebugInfo={debugEnabled}
                        ></Participant>
                      )}
                    </PullVideoTrack>
                    {user.tracks?.screenshare && user.tracks?.screenShareEnabled && (
                      <PullVideoTrack video={user.tracks?.screenshare}>
                        {({ videoTrack }) => (
                          <Participant
                            user={user}
                            videoTrack={videoTrack}
                            flipId={user.id + 'screenshare'}
                            isScreenShare
                            pinnedId={pinnedId}
                            setPinnedId={setPinnedId}
                            showDebugInfo={debugEnabled}
                          />
                        )}
                      </PullVideoTrack>
                    )}
                  </Fragment>
                ),
            )}
          </div>
        </Flipper>
        <div className='flex flex-wrap items-center justify-center gap-2 p-2 text-sm md:gap-4 md:p-5 md:text-base'>
          <MicButton />
          <CameraButton />
          <Button variant='destructive' onClick={() => setJoined(false)}>
            <VisuallyHidden>Leave</VisuallyHidden>
            <PhoneX />
          </Button>
        </div>
      </div>
    </PullAudioTracks>
  );
};
