import type { Messages } from './index';

// Bahasa Melayu copy. Typed as Messages, so a key missing here (or one en.ts lacks) fails tsc.

export const ms: Messages = {
  profile: {
    title: 'Profil',
    pageTitle: 'Profil | My Expenses',
    loading: 'Memuatkan profil anda…',
    nameHeading: 'Nama anda',
    passwordHeading: 'Kata laluan',
    passwordHint: 'Menukarnya akan melog keluar anda daripada peranti lain.',
    language: {
      heading: 'Bahasa',
      hint: 'Digunakan pada setiap peranti yang anda log masuk.',
      malay: 'Bahasa Melayu',
      english: 'English',
      save: 'Simpan bahasa',
      saved: 'Bahasa disimpan.',
    },
  },
};
