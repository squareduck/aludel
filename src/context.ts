import get from 'lodash.get'
import set from 'lodash.set'
import produce from 'immer'
import { Action, ActionMap, PathMap, Component, Instance } from './component'

export type Model = { [key: string]: any }

/*
 * Produce a local model by resolving each path against state object.
 *
 */
function localModel(state, paths) {
    return Object.keys(paths).reduce((acc, key) => {
        const path = paths[key]
        acc[key] = get(state, path)
        return acc
    }, {})
}

/*
 * Apply local model to global state.
 *
 * This should be the only place that mutates state.
 *
 */
function applyLocalModel(state: Model, paths: PathMap, change: Model): Model {
    return Object.keys(paths).reduce((acc, name) => {
        return set(acc, paths[name], change[name])
    }, state)
}

/*
 * Connect action functions to context
 *
 * We use Immer library here to make local model immutable.
 *
 */

export type ConnectedAction = (...args) => void
export type ConnectedActionMap = { [key: string]: ConnectedAction }

function connectActions(
    state: Model,
    paths: PathMap,
    actions: ActionMap,
    onUpdate: StateUpdateFn,
): ConnectedActionMap {
    return Object.keys(actions).reduce((acc, name) => {
        const action = actions[name]
        const connectedAction = (...args) => {
            const model = localModel(state, paths)
            Promise.resolve(action(...args)(model)).then(change => {
                state = applyLocalModel(state, paths, change)
                onUpdate(state)
            })
        }
        acc[name] = connectedAction
        return acc
    }, {})
}

export type StateUpdateFn = (state: Model) => void

export type Context = {
    localModel: (paths: PathMap) => Model
    connectActions: (paths: PathMap, actions: ActionMap) => ConnectedActionMap
}

/*
 * Create context and return a bunch of context-aware functions.
 *
 * Context takes in initial state and update callback.
 *
 * Update callback will be called after every action. In practice only
 * actions can change global state. Global state is available inside of
 * update callback, but it's not recommended to mutate it there. Such 
 * mutations will not be tracked.
 *
 */

export function createContext(
    initialState: Model,
    onUpdate: StateUpdateFn = () => {},
): Context {
    // Internals of this state object will be mutated, but it should never leak
    // outside on its own.
    const state = Object.assign({}, initialState)

    return {
        localModel: (paths: PathMap) => localModel(state, paths),
        connectActions: (paths: PathMap, actions: ActionMap) =>
            connectActions(state, paths, actions, onUpdate),
    }
}
