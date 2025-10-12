import type { HoaMiddleware } from 'hoa'

export type PrintFunc = (str: string, ...rest: string[]) => void

export function logger(fn?: PrintFunc): HoaMiddleware

export default logger
