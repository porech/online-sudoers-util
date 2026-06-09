import type { Line } from './types'

export type NewKind = 'userspec' | 'alias' | 'defaults' | 'include' | 'comment'

export function newNode(kind: NewKind): Line {
  switch (kind) {
    case 'userspec':
      return {
        kind: 'userspec',
        raw: '',
        dirty: true,
        users: ['ALL'],
        specGroups: [{ hosts: ['ALL'], cmndSpecs: [{ tags: [], options: [], command: 'ALL' }] }],
      }
    case 'alias':
      return {
        kind: 'alias',
        raw: '',
        dirty: true,
        aliasKind: 'User_Alias',
        defs: [{ name: 'NAME', items: [] }],
      }
    case 'defaults':
      return { kind: 'defaults', raw: '', dirty: true, params: [] }
    case 'include':
      return {
        kind: 'include',
        raw: '',
        dirty: true,
        includeKind: '@includedir',
        path: '/etc/sudoers.d',
      }
    case 'comment':
      return { kind: 'comment', raw: '', dirty: true, text: '' }
  }
}
