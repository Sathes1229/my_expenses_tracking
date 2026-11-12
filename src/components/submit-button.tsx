'use client';

import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from './button';

/** A form's submit button that shows the busy mark while its form's action runs. */
export function SubmitButton(props: Omit<ButtonProps, 'type' | 'pending'>) {
  const { pending } = useFormStatus();
  return <Button {...props} type="submit" pending={pending} />;
}
