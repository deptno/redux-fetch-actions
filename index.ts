import {stringify} from 'querystring'
import * as fetch from 'isomorphic-fetch'

export interface FxHook<S> {
  (dispatch, getState: () => S, extraArgs: any, response: any): any
}
export interface Transform<S> {
  query?(getState: () => S, query: any): any
  body?(getState: () => S, body: any): any
}
export interface BaseOption<S> {
  query?: any
  headers?: (getState) => any|any
  transform?: Transform<S>
  success?: FxHook<S>
  fail?: FxHook<S>
  responseType?: 'json'|'text'

  condition?(...args): boolean
}

export type Actions = [string, string, string]
export interface ReduxFetchAction<T> {
  type: string
  query?: any
  body?: any
  error?: Error
  payload?: T
}
export interface GetOption<S> extends BaseOption<S> {
}
export interface PostOption<S> extends BaseOption<S> {
  body?: any
}
export interface PutOption<S> extends BaseOption<S> {
  body?: any
}
export interface PatchOption<S> extends BaseOption<S> {
  body?: any
}
export interface DeleteOption<S> extends BaseOption<S> {
}

export function GET<S>(url, actions: Actions, a: GetOption<S> = {}) {
  return common(url, actions, {...a, method: 'GET'} as any)
}
export function POST<S>(url, actions: Actions, a: PostOption<S> = {}) {
  return common(url, actions, {...a, method: 'POST'} as any)
}
export function PUT<S>(url, actions: Actions, a: PutOption<S> = {}) {
  return common(url, actions, {...a, method: 'PUT'} as any)
}
export function PATCH<S>(url, actions: Actions, a: PatchOption<S> = {}) {
  return common(url, actions, {...a, method: 'PATCH'} as any)
}
export function DELETE<S>(url, actions: Actions, a: DeleteOption<S> = {}) {
  return common(url, actions, {...a, method: 'DELETE'} as any)
}

interface RequestParam {
  query?: any
  body?: any
}

function _transform<S>(getState: () => S, params: RequestParam, transformer: Transform<S>) {
  const ret = {} as {query: any, body: any}
  for (let key in transformer) {
    ret[key] = transformer[key](getState, params[key])
  }
  return ret
}

function common<S>(url, actions: Actions, a: BaseOption<S> & { method: string, query: any, body: any } = {} as any) {
  const [pending, ok, err]                                                     = actions
  const {method, query, body, headers, condition, success, fail, transform, responseType = 'json'} = a

  return async (dispatch, getState, extraArgs) => {
    if (condition && !condition(dispatch, getState, extraArgs)) {
      return false
    }

    const originalParam = {query: a.query, body: a.body}
    const {query, body} = transform
      ? _transform(getState, originalParam, transform)
      : originalParam

    dispatch({type: pending, query})
    try {
      const target     = query ? `${url}?${stringify(query)}` : url
      const param: any = {
        method,
        headers: typeof headers === 'function' ? headers(getState) : headers
      }

      if (body) {
        param.body = JSON.stringify(body)
      }

      const response = await fetch(target, param)

      if (response.status >= 400) {
        throw await handleError(response)
      }

      const json    = await response[responseType]()
      const payload = success
        ? success(dispatch, getState, extraArgs, json)
        : json

      dispatch({type: ok, query, body, payload})
      return true
    } catch (error) {
      console.error(err, error)
      dispatch({
        type:  err,
        error: fail ? fail(dispatch, getState, extraArgs, error) : error,
        query,
        body
      })
      return false
    }
  }
}
async function handleError(response) {
  return new Error(JSON.stringify({
    code:    response.status,
    message: await response.json()
  }))
}

