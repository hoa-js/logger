import type { HoaContext } from 'hoa'

export type PrintFunc = (str: string, ...rest: string[]) => void

export type LoggerMiddleware = (ctx: HoaContext, next: () => Promise<void>) => Promise<void>

export function logger(fn?: PrintFunc): LoggerMiddleware

export default logger
