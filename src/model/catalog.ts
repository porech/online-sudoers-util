import type { Tag } from './types'

export type DefaultType = 'flag' | 'integer' | 'string' | 'list'

export interface DefaultInfo {
  name: string
  type: DefaultType
  description: string
}

// A curated subset of common sudoers Defaults parameters. Unknown params are
// preserved and shown in the "Additional parameters" section of the UI.
const DEFAULTS: DefaultInfo[] = [
  { name: 'requiretty', type: 'flag', description: 'Require a real tty (not a pipe) to run sudo.' },
  { name: 'visiblepw', type: 'flag', description: 'Allow sudo to prompt for a password even when it would be echoed (no terminal).' },
  { name: 'always_set_home', type: 'flag', description: 'Set HOME to the target user’s home directory.' },
  { name: 'env_reset', type: 'flag', description: 'Reset the environment to a minimal set of variables.' },
  { name: 'mail_badpass', type: 'flag', description: 'Send mail to mailto when a user enters the wrong password.' },
  { name: 'insults', type: 'flag', description: 'Insult the user when they type an incorrect password.' },
  { name: 'rootpw', type: 'flag', description: 'Prompt for the root password instead of the invoking user’s.' },
  { name: 'targetpw', type: 'flag', description: 'Prompt for the target user’s password instead of the invoking user’s.' },
  { name: 'use_pty', type: 'flag', description: 'Run the command in a pseudo-terminal even when logging is not enabled.' },
  { name: 'secure_path', type: 'string', description: 'Path used for every command run by sudo, overriding the user’s PATH.' },
  { name: 'editor', type: 'string', description: 'Path(s) to the editor used by sudoedit/visudo.' },
  { name: 'mailto', type: 'string', description: 'Address that receives sudo notification mail.' },
  { name: 'badpass_message', type: 'string', description: 'Message shown when an incorrect password is entered.' },
  { name: 'lecture', type: 'string', description: 'When to show the sudo lecture: never, once, or always.' },
  { name: 'logfile', type: 'string', description: 'Path to the sudo log file.' },
  { name: 'passwd_tries', type: 'integer', description: 'Number of password attempts allowed before failure.' },
  { name: 'timestamp_timeout', type: 'integer', description: 'Minutes before sudo re-prompts for a password.' },
  { name: 'passwd_timeout', type: 'integer', description: 'Minutes before the password prompt times out (0 = no timeout).' },
  { name: 'env_keep', type: 'list', description: 'Environment variables preserved from the user’s environment.' },
  { name: 'env_check', type: 'list', description: 'Environment variables kept only if they pass a safety check.' },
  { name: 'env_delete', type: 'list', description: 'Environment variables removed before running a command.' },
]

const DEFAULTS_MAP = new Map(DEFAULTS.map((d) => [d.name, d]))

export const ALL_DEFAULTS = DEFAULTS

export function isKnownDefault(name: string): boolean {
  return DEFAULTS_MAP.has(name)
}

export function defaultParamInfo(name: string): DefaultInfo | undefined {
  return DEFAULTS_MAP.get(name)
}

const TAG_INFO: Record<Tag, string> = {
  NOPASSWD: 'Do not prompt for a password for these commands.',
  PASSWD: 'Prompt for a password (the default) — used to override an earlier NOPASSWD.',
  NOEXEC: 'Prevent the command from running further commands.',
  EXEC: 'Allow the command to run further commands (overrides NOEXEC).',
  SETENV: 'Allow the user to set environment variables on the command line.',
  NOSETENV: 'Disallow setting environment variables on the command line.',
  LOG_INPUT: 'Log all user input for the command.',
  NOLOG_INPUT: 'Do not log user input.',
  LOG_OUTPUT: 'Log all output from the command.',
  NOLOG_OUTPUT: 'Do not log command output.',
  MAIL: 'Send notification mail when the command is run.',
  NOMAIL: 'Do not send notification mail.',
  FOLLOW: 'Follow symbolic links when editing files with sudoedit.',
  NOFOLLOW: 'Do not follow symbolic links with sudoedit.',
  INTERCEPT: 'Intercept further commands run by the command for policy checks.',
  NOINTERCEPT: 'Do not intercept further commands.',
}

export const TAGS = Object.keys(TAG_INFO) as Tag[]

export function tagInfo(tag: Tag): string {
  return TAG_INFO[tag]
}

export function isTag(s: string): s is Tag {
  return (TAGS as string[]).includes(s)
}
