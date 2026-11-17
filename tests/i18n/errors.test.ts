import { describe, expect, it } from 'vitest';
import { messages } from '@/i18n/messages';
import { AppError, errorText, ForbiddenError, problemText, ValidationError } from '@/lib/errors';
import { repeatError, waitText } from '@/lib/form-state';

describe('keyed errors', () => {
  it('keep their English message for logs and existing callers', () => {
    const error = new ValidationError('total', 'totalMax', { max: 'RM 1,000,000.00' });
    expect(error.message).toBe('Enter a total up to RM 1,000,000.00.');
    expect(error.field).toBe('total');
    expect(new ForbiddenError().message).toBe('You are not allowed to do that.');
  });

  it('are shown in the viewer’s language', () => {
    const error = new ValidationError('total', 'totalMax', { max: 'RM 1,000,000.00' });
    expect(errorText(error, 'ms')).toBe('Masukkan jumlah sehingga RM 1,000,000.00.');
    expect(errorText(error, 'en')).toBe('Enter a total up to RM 1,000,000.00.');
    expect(errorText(new ForbiddenError('onlyOwnTransactions'), 'ms')).toBe(messages.ms.errors.onlyOwnTransactions);
  });

  it('accept a problem object from a check helper', () => {
    const error = new ValidationError('name', { key: 'tooLong', params: { max: 40 } });
    expect(error.message).toBe('Use 40 characters or fewer.');
    expect(problemText({ key: 'tooLong', params: { max: 40 } }, 'ms')).toBe('Gunakan 40 aksara atau kurang.');
  });

  it('leave an error without a key as it is', () => {
    expect(errorText(new AppError('bad_request', 'plain'), 'ms')).toBe('plain');
  });
});

describe('form helpers', () => {
  it('say how long to wait in the viewer’s language', () => {
    expect(waitText(90, 'ms')).toBe('2 minit');
    expect(waitText(30)).toBe('1 minute');
    expect(waitText(900)).toBe('15 minutes');
  });

  it('check the repeated password in the viewer’s language', () => {
    expect(repeatError('a', 'b', 'ms')).toBe(messages.ms.errors.passwordsDiffer);
    expect(repeatError('a', '', 'ms')).toBe(messages.ms.errors.typePasswordAgain);
    expect(repeatError('a', 'b')).toBe('The two passwords are not the same.');
    expect(repeatError('', 'b', 'ms')).toBeNull();
  });
});
