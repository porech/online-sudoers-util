export type Tag =
  | 'NOPASSWD' | 'PASSWD' | 'NOEXEC' | 'EXEC'
  | 'SETENV' | 'NOSETENV' | 'LOG_INPUT' | 'NOLOG_INPUT'
  | 'LOG_OUTPUT' | 'NOLOG_OUTPUT' | 'MAIL' | 'NOMAIL'
  | 'FOLLOW' | 'NOFOLLOW' | 'INTERCEPT' | 'NOINTERCEPT'

export interface RunasSpec {
  users: string[]
  groups: string[]
}

export interface CmndOption {
  name: string   // e.g. CWD, TIMEOUT, CHROOT
  value: string
}

export interface CmndSpec {
  runas?: RunasSpec
  tags: Tag[]
  options: CmndOption[]
  command: string // may be negated with a leading '!'
}

export interface SpecGroup {
  hosts: string[]
  cmndSpecs: CmndSpec[]
}

export interface DefaultsParam {
  name: string
  op: '=' | '+=' | '-=' | 'bool'
  value?: string
  negated?: boolean // for boolean flags written as !flag
  known: boolean
}

export interface DefaultsBinding {
  type: '@' | ':' | '!' | '>'
  value: string
}

export interface AliasDef {
  name: string
  items: string[]
}

interface Base {
  raw: string
  dirty: boolean
  inlineComment?: string
}

export interface UserSpecNode extends Base {
  kind: 'userspec'
  users: string[]
  specGroups: SpecGroup[]
}

export interface AliasNode extends Base {
  kind: 'alias'
  aliasKind: 'User_Alias' | 'Runas_Alias' | 'Host_Alias' | 'Cmnd_Alias'
  defs: AliasDef[]
}

export interface DefaultsNode extends Base {
  kind: 'defaults'
  binding?: DefaultsBinding
  params: DefaultsParam[]
}

export interface IncludeNode extends Base {
  kind: 'include'
  includeKind: '@include' | '@includedir' | '#include' | '#includedir'
  path: string
}

export interface CommentNode extends Base {
  kind: 'comment'
  text: string // content after the leading '#', not including it
}

export interface BlankNode extends Base {
  kind: 'blank'
}

export interface ErrorNode extends Base {
  kind: 'error'
  message: string
  line: number
}

export type Line =
  | UserSpecNode | AliasNode | DefaultsNode | IncludeNode
  | CommentNode | BlankNode | ErrorNode

export interface SudoersDocument {
  lines: Line[]
}

export const isUserSpec = (l: Line): l is UserSpecNode => l.kind === 'userspec'
export const isAlias = (l: Line): l is AliasNode => l.kind === 'alias'
export const isDefaults = (l: Line): l is DefaultsNode => l.kind === 'defaults'
export const isInclude = (l: Line): l is IncludeNode => l.kind === 'include'
export const isComment = (l: Line): l is CommentNode => l.kind === 'comment'
export const isBlank = (l: Line): l is BlankNode => l.kind === 'blank'
export const isError = (l: Line): l is ErrorNode => l.kind === 'error'

export const makeBlank = (): BlankNode => ({ kind: 'blank', raw: '', dirty: false })
