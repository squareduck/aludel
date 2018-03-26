import get from 'lodash.get'
import set from 'lodash.set'
import produce from 'immer'
import {
    Action,
    ActionMap,
    PathMap,
    Component,
    Instance,
    InstanceTools,
} from './component'

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
        if (change.hasOwnProperty(name))
            return set(acc, paths[name], change[name])
        return acc
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
 * Create Component Instance.
 *
 * Also does some bookkeeping:
 * - Registers component in context
 * - Updates all component dependencies
 * - Caches the new Instance
 * - When instance is rendered, caches the rendering value
 *
 */
function createInstance(
    state: Model,
    contextState: ContextState,
    component: Component,
    tools: InstanceTools,
    onUpdate: StateUpdateFn,
): Instance {
    // If instance is already cached we don't need to recalculate anything
    const cachedInstance = cachedInstanceFor(contextState.registry, component.signature)
    if (cachedInstance) return cachedInstance

    // Otherwise create a new instance and cache it
    //
    addDependency(contextState.registry, component)

    const child = Object.keys(component.template.children).reduce(
        (acc, name) => {
            acc[name] = createInstance(
                state,
                contextState,
                component.template.children[name],
                tools,
                onUpdate,
            )
            return acc
        },
        {},
    )

    const action = connectActions(
        state,
        contextState,
        component.paths,
        component.template.actions,
        onUpdate,
        component.signature,
    )

    if (action.$init) action.$init()

    const instance = (props: Model = {}, outlet: Instance = () => {}) => {
        if (shouldRender(contextState, component.signature)) {
            const model = localModel(state, component.paths)
            const rendering = component.template.render({
                model,
                action,
                child,
                props,
                outlet,
                navigate: tools.navigate,
                link: tools.link,
            })

            addCachedRender(
                contextState.registry,
                component.signature,
                rendering,
            )
            return rendering
        } else {
            return cachedRenderFor(contextState.registry, component.signature)
        }
    }

    addCachedInstance(contextState.registry, component.signature, instance)

    return instance
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
        cachedInstance?: Instance
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
) {
    if (registry[signature])
        registry[signature].cachedRender = rendering
}

function cachedRenderFor(
    registry: ComponentRegistry,
    signature: string,
): any {
    if (registry[signature]) return registry[signature].cachedRender
}

function addCachedInstance(
    registry: ComponentRegistry,
    signature: string,
    instance: Instance,
) {
    if (registry[signature])
        registry[signature].cachedInstance = instance
}

function cachedInstanceFor(
    registry: ComponentRegistry,
    signature: string,
): Instance {
    if (registry[signature]) return registry[signature].cachedInstance
}

/*
 * Checks if we can safely use previous render result instead of recalculating
 * the render function.
 *
 * If any one condition from the list below matches we rerender:
 * - Last action does not have defined owner
 * - Signature that we are trying to check is not registered in context
 * - Candidate does not have cached render result
 * - Candidate is the owner or depends on the owner of last action
 *
 */
function shouldRender(contextState: ContextState, signature: string): boolean {
    // Last action had to registered owner, so just render
    if (!contextState.lastActionOwner) return true

    const actionOwner = contextState.lastActionOwner
    const candidate = contextState.registry[signature]
    if (candidate) {
        // If we don't have cached render, just render
        if (!candidate.cachedRender) return true
        // If candidate is owner of action or depends on owner, just render
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
    createInstance: (component: Component, tools: InstanceTools) => Instance
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
        createInstance: (component: Component, tools: InstanceTools) =>
            createInstance(state, contextState, component, tools, onUpdate),
    }
}
