import React from 'react';

import Button from '@material-ui/core/Button';
import VideoOffIcon from '../../../icons/VideoOffIcon';
import VideoOnIcon from '../../../icons/VideoOnIcon';
import useANCToggle from '../../../hooks/useRNNoiseToggle/useANCToggle';

export default function ToggleRNNoiseButton(props: { disabled?: boolean; className?: string }) {
  const [isEnabled, toggle, noiseCancellationKind] = useANCToggle();
  return (
    <Button
      className={props.className}
      onClick={toggle}
      disabled={props.disabled}
      startIcon={isEnabled ? <VideoOnIcon /> : <VideoOffIcon />}
      data-cy-audio-toggle
    >
      {isEnabled ? `Disable ${noiseCancellationKind}` : `Enable ${noiseCancellationKind}`}
    </Button>
  );
}
