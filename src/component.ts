import hash from 'object-hash'
import { Context, Model, ConnectedActionMap } from './context'
import { NavigateMap, LinkMap } from './router'

export type Partial<T> = { [P in keyof T]?: T[P] }

// Component Template
export type Template = {
    sockets: string[]
    actions: ActionMap
    children: ComponentMap
    render: (tools: RenderTools) => any
}

// Object with useful tools available to every Template render function
export type RenderTools = {
    model: Model
    action: ConnectedActionMap
    child: InstanceMap
    props: Model
    outlet: Instance
    navigate: NavigateMap
    link: LinkMap
}

// Actions update Template's local model
export type Action = (...args) => (model: Model) => Model
export type ActionMap = { [key: string]: Action }

/*
 * Create template.
 * 
 * Puts default values for omitted fields. 
 * 
 */
export function createTemplate(config: Partial<Template>): Template {
    return Object.assign(
        {
            sockets: [],
            actions: {},
            children: {},
            render: () => {},
        },
        config,
    )
}

// A map of paths into Global State for each socket
export type PathMap = { [key: string]: (string | number)[] }

// Component
export type Component = {
    signature: string
    template: Template
    paths: PathMap
}

// A map of components where each component is associated with some name
export type ComponentMap = { [key: string]: Component }

/*
 * Create Component
 * 
 * Specify path into Global State for each socket.
 * Doing this step separately allows us to create many components 
 * from one template by changing socket paths.
 * 
 * Validates that all sockets got a path.
 * 
 * Also calculates unique Component signature. Two identical components
 * will have the same signature. This allows us to cache component
 * instances.
 * 
 */
export function createComponent(template: Template, paths: PathMap): Component {
    // Check that we have same amount of paths and sockets
    const equalAmount = Object.keys(paths).length === template.sockets.length
    // Check that we have a path for each socket
    const allSocketsCovered =
        template.sockets.filter(
            socket => Object.keys(paths).indexOf(socket) < 0,
        ).length === 0

    // If either is false we throw error
    if (!equalAmount || !allSocketsCovered)
        throw new Error(`Paths and sockets don't match.`)

    const signature = hash({ template, paths })

    paths.$local = ['$local', signature]

    return {
        template,
        paths,
        signature,
    }
}

// Component Instance that will render the "view" if invoked
// props - local parameters passed from parent component
// outlet - possible child component from next section of the routing hierarchy
export type Instance = (props?: Model, outlet?: Instance) => any
// A map of instances
export type InstanceMap = { [key: string]: Instance }
// Tools useful in creating new instances
// navigate - a map of functions that change browser URL according to named routes
// link - a map of functions that produce a valid URL from named route and params
export type InstanceTools = {
    navigate?: NavigateMap
    link?: LinkMap
}

/*
 * Create instance
 *
 * This is just convenience function. We delegate actual creation to Context.
 * 
 */
export function createInstance(
    context: Context,
    component: Component,
    tools: InstanceTools = {
        navigate: {},
        link: {},
    },
): Instance {
    return context.createInstance(component, tools)
}
