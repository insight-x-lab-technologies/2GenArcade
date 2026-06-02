import 'i18next';

// 'shell' is the default namespace, so t('navHome') resolves there and
// t('common:play') / t('blockDrop:hudScore') address other namespaces.
// Keys are intentionally typed loosely (string): much of the UI looks them up
// dynamically from data (game titles, pack names, trophy keys), which a strict
// literal-key union would reject. Resources still live in typed locale modules.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'shell';
    allowObjectInHTMLChildren: false;
  }
}
