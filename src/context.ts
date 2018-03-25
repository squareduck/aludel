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
 * Connect action functions to context.
 *
 * We wrap action into function that executes it in context of global state.
 * If signature was passed we put it into contextState.lastActionOwner to
 * indicate which component is responsible for last completed action.
 *
 */

export type ConnectedAction = (...args) => void
export type ConnectedActionMap = { [key: string]: ConnectedAction }

function connectActions(
    state: Model,
    contextState: ContextState,
    paths: PathMap,
    actions: ActionMap,
    onUpdate: StateUpdateFn,
    signature?: string,
): ConnectedActionMap {
    return Object.keys(actions).reduce((acc, name) => {
        const action = actions[name]
        const connectedAction = (...args) => {
            const model = localModel(state, paths)
            Promise.resolve(action(...args)(model)).then(change => {
                contextState.lastActionOwner = signature
                state = applyLocalModel(state, paths, change)
                onUpdate(state)
            })
        }
        acc[name] = connectedAction
        return acc
    }, {})
}

/*
 * Check if two components have any paths that match.
 *
 * For example:
 * ['users', 'list'] and ['users'] match
 * ['users', 'list'] and ['users', 'profile'] don't match
 * ['users', 'list'] and ['books', 'list'] don't match
 *
 */
function hasMatchingPaths(component: Component, candidate: Component): boolean {
    if (component.signature === candidate.signature) return false

    let hasDependency = false

    Object.values(component.paths).forEach(componentPath => {
        Object.values(candidate.paths).forEach(candidatePath => {
            let pathsMatch = true
            for (
                let componentPathIndex = 0;
                componentPathIndex < componentPath.length;
                componentPathIndex++
            ) {
                for (
                    let candidatePathIndex = 0;
                    candidatePathIndex < candidatePath.length;
                    candidatePathIndex++
                ) {
                    if (
                        componentPath[componentPathIndex] !==
                        candidatePath[componentPathIndex]
                    )
                        pathsMatch = false
                }
            }
            if (pathsMatch) {
                hasDependency = true
            }
        })
    })

    return hasDependency
}

export type ComponentRegistry = {
    [key: string]: {
        component: Component
        dependencies: string[]
        cachedRender?: any
    }
}

/*
 * Add component to dependency map
 *
 * Looks at component paths and calculates which other components rely
 * on the same data.
 *
 * Later when some action executes we can look at dependent components of
 * action owner and recalculate render function only for them.
 *
 */

function addDependency(registry: ComponentRegistry, component: Component) {
    const signature = component.signature
    if (!registry[signature])
        registry[signature] = {
            component,
            dependencies: [],
        }

    // If paths match we say that components depend on each other
    Object.keys(registry).forEach(depSignature => {
        const candidate = registry[depSignature].component

        if (hasMatchingPaths(component, candidate)) {
            registry[depSignature].dependencies.push(signature)
            registry[signature].dependencies.push(depSignature)
        }
    })
}

function dependenciesFor(
    registry: ComponentRegistry,
    signature: string,
): string[] {
    if (registry[signature]) return registry[signature].dependencies
}

function addCachedRender(
    registry: ComponentRegistry,
    signature: string,
    rendering: any,
): string[] {
    if (registry[signature])
        return (registry[signature].cachedRender = rendering)
}

function cachedRenderFor(
    registry: ComponentRegistry,
    signature: string,
): string[] {
    if (registry[signature]) return registry[signature].cachedRender
}

function shouldRender(contextState: ContextState, signature: string): boolean {
    // Last action had to registered owner, so just render
    if (!contextState.lastActionOwner) return true

    const actionOwner = contextState.lastActionOwner
    const candidate = contextState.registry[signature]
    if (candidate) {
        if (
            candidate.component.signature === actionOwner ||
            candidate.dependencies.includes(actionOwner)
        )
            return true
        return false
    }

    // Candidate is not found, so just render
    return true
}

export type StateUpdateFn = (state: Model) => void

export type ContextState = {
    lastActionOwner?: string // Signature of component owner of last action
    registry: ComponentRegistry // Registry of all instantiated components
}

export type Context = {
    localModel: (paths: PathMap) => Model
    connectActions: (
        paths: PathMap,
        actions: ActionMap,
        signature?: string,
    ) => ConnectedActionMap
    shouldRender: (signature: string) => boolean
    addDependency: (component: Component) => void
    dependenciesFor: (signature: string) => string[]
    addCachedRender: (signature: string, rendering: any) => void
    cachedRenderFor: (signature: string) => any
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
    const contextState: ContextState = {
        registry: {},
    }

    return {
        localModel: (paths: PathMap) => localModel(state, paths),
        connectActions: (
            paths: PathMap,
            actions: ActionMap,
            signature?: string,
        ) =>
            connectActions(
                state,
                contextState,
                paths,
                actions,
                onUpdate,
                signature,
            ),
        shouldRender: (signature: string) =>
            shouldRender(contextState, signature),
        addDependency: (component: Component) =>
            addDependency(contextState.registry, component),
        dependenciesFor: (signature: string) =>
            dependenciesFor(contextState.registry, signature),
        addCachedRender: (signature: string, rendering: any) =>
            addCachedRender(contextState.registry, signature, rendering),
        cachedRenderFor: (signature: string) =>
            cachedRenderFor(contextState.registry, signature),
    }
}
